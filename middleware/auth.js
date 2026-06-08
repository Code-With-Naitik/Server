const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Required auth
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.toLowerCase().startsWith('bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.warn(`[Auth Middleware] Authorization header missing or format invalid. URL: ${req.originalUrl}`);
    return res.status(401).json({ success: false, message: 'Not authorized: Token missing or invalid format' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = jwt.verify(token, secret);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      console.warn(`[Auth Middleware] User not found in DB for Decoded ID: ${decoded.id}`);
      return res.status(401).json({ success: false, message: 'Not authorized: User not found' });
    }

    next();
  } catch (err) {
    console.error(`[Auth Middleware] JWT Verification Failed: ${err.message}`);
    return res.status(401).json({ success: false, message: `Not authorized: ${err.message}` });
  }
};

// Optional auth (doesn't fail if no token)
const getAuthUser = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.toLowerCase().startsWith('bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'secret';
      const decoded = jwt.verify(token, secret);
      req.user = await User.findById(decoded.id);
      if (req.user) {
        console.log(`[Auth Middleware] Optional Auth succeeded for user: ${req.user.email}`);
      }
    } catch (err) {
      console.warn(`[Auth Middleware] Optional Auth Token failed verification: ${err.message}`);
      // Ignore invalid token for optional auth
    }
  }

  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized`,
      });
    }
    next();
  };
};

module.exports = { protect, getAuthUser, authorize };
