const mongoose = require('mongoose');

const BlogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    default: 'Admin',
  },
  featuredImage: {
    type: String,
  },
  tags: {
    type: [String],
    default: [],
  },
  readTime: {
    type: String,
  },
  published: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('BlogPost', BlogPostSchema);
