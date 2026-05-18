const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const mongoose = require('mongoose');

const MAX_FREE_CREDITS_PER_DAY = 5;

const checkUsageLimit = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // Skip DB check if disconnected to prevent timeouts
      return next();
    }
    // If user is authenticated, use credit system
    if (req.user) {
      const user = await User.findById(req.user.id);
      
      // Reset credits if it's a new day (for free users)
      const now = new Date();
      const lastReset = new Date(user.lastCreditReset);
      
      if (now.toDateString() !== lastReset.toDateString()) {
        if (!user.isPremium) {
          user.credits = MAX_FREE_CREDITS_PER_DAY;
        }
        user.lastCreditReset = now;
        await user.save();
      }

      if (!user.isPremium && user.credits <= 0) {
        return res.status(402).json({
          success: false,
          error: 'Out of credits. Please upgrade to Pro for unlimited removals.',
        });
      }

      // We'll deduct the credit in the actual route handler after success
      req.userObj = user; // Pass user object to route handler
      return next();
    }

    // Fallback for non-logged in users (IP-based limit)
    const ip = req.ip || req.connection.remoteAddress;
    const today = new Date().toISOString().split('T')[0];

    let log = await UsageLog.findOne({ ip, date: today });
    if (!log) {
      log = new UsageLog({ ip, date: today, count: 0 });
    }

    if (log.count >= MAX_FREE_CREDITS_PER_DAY) {
      return res.status(402).json({
        success: false,
        error: 'Guest limit reached (5 per day). Please sign up to get more or upgrade.',
      });
    }

    log.count += 1;
    await log.save();
    next();
  } catch (err) {
    console.error('Usage check error:', err);
    next();
  }
};

module.exports = checkUsageLimit;
