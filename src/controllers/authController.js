const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Register a new user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Hash password securely (12 salt rounds per documentation specifications)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create the user in your MongoDB database
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'donor' // Automatically defaults to donor if not provided
    });

    // 4. Respond with success
    res.status(201).json({
      message: 'User registered successfully. Next step: verification.',
      userId: user._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};