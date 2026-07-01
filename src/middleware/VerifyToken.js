const jwt = require('jsonwebtoken');

// Reads the JWT from the HTTP-only cookie and attaches it to req.user
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attaches { userId, role, iat, exp }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
};

// Strict Role Guard Middleware to prevent cross-role actions
const requireRole = (allowedRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized. Authentication required.' });
    }

    if (req.user.role !== allowedRole) {
      return res.status(403).json({ 
        message: `Forbidden. This action is restricted strictly to ${allowedRole} accounts.` 
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireRole
};