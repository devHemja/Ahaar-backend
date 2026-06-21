const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt= require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// Helper to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Saves the user safely, but unverified
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'donor'
    });

    const generatedOtp = generateOTP();

    // Store OTP temporarily in DB
    await OTP.create({ email, otp: generatedOtp });

    // Send email immediately
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Welcome to Ahaar!</h2>
        <p>Your verification OTP code is valid for 10 minutes:</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0; border: 1px dashed #4CAF50;">
          ${generatedOtp}
        </div>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Verify Your Ahaar Account',
      text: `Your OTP is: ${generatedOtp}`,
      html: emailHtml
    });

    res.status(201).json({
      message: 'Registration successful! Proceed to open your frontend verification popup.',
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP or code has expired' });
    }

    // Flip the user validation state to true
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clean up OTP token
    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
      message: 'Account verified successfully! Your frontend can now redirect to dashboard.',
      isVerified: user.isVerified
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate request inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // 2. Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3. CRITICAL: Check if the user has verified their email via OTP
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email address before logging in.' });
    }

    // 4. Check if the typed password matches the hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 5. Generate a JWT Token signed with user payload (valid for 7 days)
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 6. Set the token inside an HTTP-Only Cookie 🌟
    res.cookie('token', token, {
      httpOnly: true,     // Prevents frontend JS from reading it (Stops XSS)
      secure: process.env.NODE_ENV === 'production', // true in production (HTTPS required)
      sameSite: 'strict', // Protects against CSRF attacks
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });

    // 7. Respond with user info (Notice 'token' is dropped from the JSON body)
    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// ============================================================
// STEP 1: Send Reset OTP
// ============================================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.findOneAndUpdate(
      { email },
      { otp: resetOtp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    await sendEmail({
      to: email,
      subject: 'Ahaar Password Reset - OTP',
      text: `Your password reset code is: ${resetOtp}`,
      html: `<p>Your password reset OTP is: <b>${resetOtp}</b>. Valid for 10 minutes.</p>`
    });

    res.status(200).json({ message: 'Password reset OTP sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================================
// STEP 2: Verify OTP First (Stand-alone check before password reset)
// ============================================================
exports.verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Check if the OTP is valid
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP or code has expired' });
    }

    // Do NOT delete the OTP record yet! We need it to verify step 3.
    res.status(200).json({ 
      message: 'OTP verified successfully! You can now proceed to change your password.',
      success: true 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================================
// STEP 3: Final Password Reset (Only works if OTP matches)
// ============================================================
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify the OTP one last time to make sure they didn't bypass Step 2
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Session expired or invalid token access.' });
    }

    // Hash and update
    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await User.findOneAndUpdate({ email }, { password: hashedNewPassword });
    
    // Cleanup OTP record now that the entire flow is finished
    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: 'Password updated successfully! You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout User & Clear Cookie
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    // Clear the 'token' cookie by setting its expiration to immediately
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({ message: 'Logged out successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update User Location Coordinates
// @route   PUT /api/auth/location
// @access  Private (Requires JWT verification)
exports.updateLocation = async (req, res) => {
  try {
    const { longitude, latitude } = req.body;

    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Longitude and latitude are required' });
    }

    // Update user location in GeoJSON Point format
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId, // Decoded from your auth middleware
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        }
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      message: 'Location synchronized successfully!',
      location: updatedUser.location
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};