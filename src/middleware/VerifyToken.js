const jwt = require('jsonwebtoken');

// Reads the JWT from the HTTP-only cookie set during login and attaches
// the decoded payload to req.user for use in protected route handlers.
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, iat, exp }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
};

module.exports = verifyToken;
