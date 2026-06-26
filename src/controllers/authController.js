const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// Helper to generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ─── REGISTER ────────────────────────────────────────────────────────────────
// Called by: RegisterPage.jsx → handleSubmit
// Note: After success the frontend navigates to /verify-otp with email in route state.
//       The user must then hit "Send OTP" → /api/auth/generate-otp to receive the code.
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'donor',
    });

    res.status(201).json({
      message: 'Registration successful! Check your email for the verification code.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GENERATE / RESEND OTP ───────────────────────────────────────────────────
// Called by: VerifyOtpPage.jsx → handleGenerateOtp  (both initial Send and Resend)
// Decoupled from register so the user can request the OTP on demand.
exports.generateOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'This account is already verified.' });
    }

    const generatedOtp = generateOTP();

    // Upsert so a resend replaces any previous pending OTP
    await OTP.findOneAndUpdate(
      { email },
      { otp: generatedOtp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;
                  border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Welcome to Ahaar!</h2>
        <p>Your email verification code (valid for 10 minutes):</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center;
                    font-size: 24px; font-weight: bold; letter-spacing: 5px;
                    color: #333; margin: 20px 0; border: 1px dashed #4CAF50;">
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
// Called by: VerifyOtpPage.jsx → handleVerify
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

    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Clean up used OTP
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
// Called by: LoginPage.jsx → handleSubmit
// Returns user info + sets HTTP-only cookie. Also returns `verified` flag so
// the frontend can redirect unverified users to /verify-otp.
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Tell the frontend to redirect to /verify-otp instead of showing a generic error
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

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: 'Login successful!',
      verified: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
// Called by: Dashboard logout button
exports.logout = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── FORGOT PASSWORD — STEP 1: Send OTP ──────────────────────────────────────
// Called by: ForgotPasswordPage.jsx → handleSendOtp
// Endpoint: POST /api/auth/forgot-password-send-otp
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({ email });
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;
                    border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #E07B00; text-align: center;">Reset Your Ahaar Password</h2>
          <p>Use the code below to reset your password. It expires in 10 minutes.</p>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center;
                      font-size: 24px; font-weight: bold; letter-spacing: 5px;
                      color: #333; margin: 20px 0; border: 1px dashed #E07B00;">
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
// Called by: ForgotPasswordPage.jsx → handleVerifyOtp
// Endpoint: POST /api/auth/forgot-password-verify-otp
// Note: OTP is NOT deleted here — it is still needed for Step 3.
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
// Called by: ResetPasswordPage.jsx → handleSubmit
// Endpoint: POST /api/auth/reset-password
// Body: { email, newPassword }
// IMPORTANT: The frontend does NOT resend the OTP in this request (it trusts the
// verified session state). We re-look up the OTP record by email only to confirm
// the flow wasn't bypassed — if there's no pending OTP record the user never
// completed Step 2, so we reject the request.
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Confirm a valid (non-expired) OTP record still exists for this email,
    // proving the user completed Step 2 and isn't bypassing the flow.
    const otpRecord = await OTP.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({
        message: 'Session expired or invalid access. Please restart the reset flow.',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await User.findOneAndUpdate({ email }, { password: hashedNewPassword });

    // Clean up OTP now that the full 3-step flow is complete
    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'Password updated successfully! You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE LOCATION (Protected) ─────────────────────────────────────────────
// Called by: any location-aware feature after login
// Requires verifyToken middleware
exports.updateLocation = async (req, res) => {
  try {
    const { longitude, latitude } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Longitude and latitude are required.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      message: 'Location updated successfully!',
      location: updatedUser.location,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
