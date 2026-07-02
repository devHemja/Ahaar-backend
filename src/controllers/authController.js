const Donor = require('../models/Donor');
const NGO = require('../models/NGO');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// Helper to generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to dynamically locate a user across both independent databases
const findUserByEmail = async (email) => {
  let user = await Donor.findOne({ email });
  if (user) return { user, Model: Donor, role: 'donor' };
  
  user = await NGO.findOne({ email });
  if (user) return { user, Model: NGO, role: 'ngo' };
  
  return { user: null, Model: null, role: null };
};

// Helper to dynamically locate a user across both databases by ID
const findUserById = async (id) => {
  let user = await Donor.findById(id);
  if (user) return { user, Model: Donor };

  user = await NGO.findById(id);
  if (user) return { user, Model: NGO };

  return { user: null, Model: null };
};

// Hardcoded array of authorized registration numbers (Simulation Mode)
const VALID_NGO_REGISTRATIONS = [
  "NGO-DELHI-2026-01",
  "NGO-MUMBAI-2026-99",
  "AHAAR-LEGAL-NGO",
  "ROTI-BANK-DL"
];

// ─── REGISTER ────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, regNumber } = req.body;
    const assignedRole = role === 'ngo' ? 'ngo' : 'donor';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    // Strict safety cross-check across both data models
    const donorExists = await Donor.findOne({ email });
    const ngoExists = await NGO.findOne({ email });
    if (donorExists || ngoExists) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (assignedRole === 'ngo') {
      if (!regNumber) {
        return res.status(400).json({ message: 'NGO registration number is required.' });
      }

      // 🌟 Step A: Check if the string matches our legal allowlist registry
      const isValidRegNo = VALID_NGO_REGISTRATIONS.includes(regNumber.trim());
      if (!isValidRegNo) {
        return res.status(403).json({ 
          message: 'Verification failed. The registration number entered is not recognized as a legal or authorized NGO profile.' 
        });
      }

      // 🌟 Step B: Ensure that this registration number isn't already claimed by another user
      const regNoTaken = await NGO.findOne({ regNumber: regNumber.trim() });
      if (regNoTaken) {
        return res.status(400).json({ message: 'This registration number is already tied to an active account.' });
      }

      await NGO.create({
        orgName: name, // Maps frontend 'name' field to 'orgName' schema variable
        email,
        password: hashedPassword,
        regNumber: regNumber.trim(),
        role: 'ngo',
        isVerified: false // Remains false until they complete the OTP verification step next!
      });
    } else {
      await Donor.create({
        name,
        email,
        password: hashedPassword,
        role: 'donor',
        isVerified: false
      });
    }

    // Automatically triggers your existing email verification pipeline
    res.status(201).json({
      message: 'Registration successful! Check your email for the verification code.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GENERATE / RESEND OTP ───────────────────────────────────────────────────
exports.generateOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const { user } = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'This account is already verified.' });
    }

    const generatedOtp = generateOTP();

    await OTP.findOneAndUpdate(
      { email },
      { otp: generatedOtp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Welcome to Ahaar!</h2>
        <p>Your email verification code (valid for 10 minutes):</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0; border: 1px dashed #4CAF50;">
          ${generatedOtp}
        </div>
        <p style="color: #777; font-size: 12px;">If you did not create an Ahaar account, ignore this email.</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Verify Your Ahaar Account',
      text: `Your OTP is: ${generatedOtp}`,
      html: emailHtml,
    });

    res.status(200).json({ message: 'OTP sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── VERIFY OTP ──────────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP or the code has expired.' });
    }

    const { user, Model } = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.isVerified = true;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
      message: 'Account verified successfully!',
      isVerified: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { user, role } = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        verified: false,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Embeds the precise database identity structure within the token payload
    const token = jwt.sign(
      { userId: user._id, role: role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Login successful!',
      verified: true,
      user: {
        id: user._id,
        name: user.name || user.orgName,
        email: user.email,
        role: role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── FORGOT PASSWORD — STEP 1: Send OTP ──────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const { user } = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    const resetOtp = generateOTP();

    await OTP.findOneAndUpdate(
      { email },
      { otp: resetOtp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    await sendEmail({
      to: email,
      subject: 'Ahaar Password Reset — OTP',
      text: `Your password reset code is: ${resetOtp}. Valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #E07B00; text-align: center;">Reset Your Ahaar Password</h2>
          <p>Use the code below to reset your password. It expires in 10 minutes.</p>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0; border: 1px dashed #E07B00;">
            ${resetOtp}
          </div>
          <p style="color: #777; font-size: 12px;">If you did not request this, ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ message: 'Password reset OTP sent to your email.', success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── FORGOT PASSWORD — STEP 2: Verify OTP ────────────────────────────────────
exports.verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired verification code.' });
    }

    res.status(200).json({
      message: 'OTP verified! You may now set a new password.',
      verified: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── FORGOT PASSWORD — STEP 3: Reset Password ────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const otpRecord = await OTP.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({
        message: 'Session expired or invalid access. Please restart the reset flow.',
      });
    }

    const { user } = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User database record missing.' });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'Password updated successfully! You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── VERIFY NGO REGISTRATION NUMBER (post-OTP confirmation step) ────────────
exports.verifyNgoRegistration = async (req, res) => {
  try {
    const { email, regNumber } = req.body;
    if (!email || !regNumber) {
      return res.status(400).json({ message: 'Email and registration number are required.' });
    }

    const ngo = await NGO.findOne({ email });
    if (!ngo) {
      return res.status(404).json({ message: 'No NGO account found with this email.' });
    }

    if (ngo.regNumber.trim().toUpperCase() !== regNumber.trim().toUpperCase()) {
      return res.status(400).json({ message: 'Registration number does not match our records for this account.' });
    }

    res.status(200).json({ message: 'NGO registration confirmed!', verified: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE LOCATION (Protected) ─────────────────────────────────────────────
exports.updateLocation = async (req, res) => {
  try {
    const { longitude, latitude } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Longitude and latitude are required.' });
    }

    const { user } = await findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found across endpoints.' });
    }

    user.location = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };
    await user.save();

    res.status(200).json({
      message: 'Location updated successfully!',
      location: user.location,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};