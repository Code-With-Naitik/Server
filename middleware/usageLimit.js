const UsageLog = require('../models/UsageLog');

const MAX_FREE_IMAGES_PER_DAY = 5;

const checkUsageLimit = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    let log = await UsageLog.findOne({ ip, date: today });

    if (!log) {
      log = new UsageLog({ ip, date: today, count: 0 });
    }

    if (log.count >= MAX_FREE_IMAGES_PER_DAY) {
      return res.status(429).json({
        success: false,
        error: 'Daily limit reached. Please upgrade to premium for unlimited background removal.',
      });
    }

    // Increment count
    log.count += 1;
    await log.save();

    next();
  } catch (err) {
    console.error('Error checking usage limit:', err);
    // On error, let them pass through rather than blocking the service
    next();
  }
};

module.exports = checkUsageLimit;
