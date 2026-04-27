const express = require('express');
const BlogPost = require('../models/BlogPost');

const router = express.Router();

// Get all published posts
router.get('/', async (req, res) => {
  try {
    const posts = await BlogPost.find({ published: true })
      .select('-content') // exclude full content for list view
      .sort({ createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error fetching posts' });
  }
});

// Get single post by slug
router.get('/:slug', async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, published: true });
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error fetching post' });
  }
});

module.exports = router;
