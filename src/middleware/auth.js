const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Read token directly from cookies thanks to cookie-parser
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Please log in first.' });
  }

  try {
    // Decode and verify token integrity
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Attaches { userId, role } to req object
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
};

module.exports = { verifyToken };