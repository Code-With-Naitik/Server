const express = require('express');
const GalleryItem = require('../models/GalleryItem');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get all gallery items (Public)
router.get('/', async (req, res) => {
  try {
    const items = await GalleryItem.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new gallery item (Protected)
router.post('/', protect, async (req, res) => {
  try {
    const item = await GalleryItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update gallery item (Protected)
router.put('/:id', protect, async (req, res) => {
  try {
    let item = await GalleryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    item = await GalleryItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete gallery item (Protected)
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await GalleryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    await item.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
