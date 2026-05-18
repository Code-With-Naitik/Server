const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const BlogPost = require('../models/BlogPost');
const ContactMessage = require('../models/ContactMessage');
const UsageLog = require('../models/UsageLog');
const GalleryItem = require('../models/GalleryItem');

// @desc    Get public statistics for homepage
// @route   GET /api/admin/public-stats
// @access  Public
router.get('/public-stats', async (req, res) => {
  try {
    const totalBlogs = await BlogPost.countDocuments({ published: true });
    const totalMessages = await ContactMessage.countDocuments(); // We can hide this or use a multiplier
    const totalRemovals = await UsageLog.countDocuments();
    const totalGallery = await GalleryItem.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalBlogs,
        totalRemovals,
        totalGallery,
        totalHappyUsers: Math.floor(totalRemovals * 0.8) + 500 // Some logic to make it look active
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const totalBlogs = await BlogPost.countDocuments();
    const totalMessages = await ContactMessage.countDocuments();
    const totalRemovals = await UsageLog.countDocuments();
    const totalGallery = await GalleryItem.countDocuments();

    // Get recent activity (e.g., last 5 messages)
    const recentMessages = await ContactMessage.find().sort({ createdAt: -1 }).limit(5);
    const recentRemovals = await UsageLog.find().sort({ createdAt: -1 }).limit(5);

    res.status(200).json({
      success: true,
      stats: {
        totalBlogs,
        totalMessages,
        totalRemovals,
        totalGallery
      },
      recentActivity: {
        messages: recentMessages,
        removals: recentRemovals
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get detailed analytics
// @route   GET /api/admin/analytics
// @access  Private
router.get('/analytics', protect, async (req, res) => {
  try {
    // Get usage trends for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const usageTrends = await UsageLog.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Format for charts
    const formattedTrends = usageTrends.map(item => ({
      date: item._id,
      removals: item.count
    }));

    res.status(200).json({
      success: true,
      data: {
        usageTrends: formattedTrends
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
