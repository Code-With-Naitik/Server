const mongoose = require('mongoose');

const UsageLogSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    index: true,
  },
  date: {
    type: String, // e.g., 'YYYY-MM-DD'
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// Compound index to ensure uniqueness per IP per day
UsageLogSchema.index({ ip: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('UsageLog', UsageLogSchema);
