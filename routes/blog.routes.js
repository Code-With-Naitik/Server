const express = require('express');
const BlogPost = require('../models/BlogPost');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get all published posts (Public)
router.get('/', async (req, res) => {
  try {
    const posts = await BlogPost.find({ published: true })
      .select('-content') // exclude full content for list view
      .sort({ createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Blog Fetch Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all posts for admin (Protected)
router.get('/admin-all', protect, async (req, res) => {
  try {
    const posts = await BlogPost.find().sort({ createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single post by slug (Public)
router.get('/:slug', async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, published: true });
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new post (Protected)
router.post('/', protect, async (req, res) => {
  try {
    const post = await BlogPost.create(req.body);
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a post (Protected)
router.put('/:id', protect, async (req, res) => {
  try {
    let post = await BlogPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    post = await BlogPost.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    res.status(200).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a post (Protected)
router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    await post.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
