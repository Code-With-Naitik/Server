const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const GalleryItem = require('../models/GalleryItem');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── Gallery image upload storage ──
const galleryDir = path.join(__dirname, '../uploads/gallery');
if (!fs.existsSync(galleryDir)) {
  fs.mkdirSync(galleryDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, galleryDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error('Only jpeg, jpg, png, webp images allowed'));
  }
});

const getBaseUrl = (req) =>
  process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

// ── Upload gallery images ──
// POST /api/gallery/upload-images  (multipart: beforeImage, afterImage)
router.post('/upload-images', protect, upload.fields([
  { name: 'beforeImage', maxCount: 1 },
  { name: 'afterImage', maxCount: 1 }
]), (req, res) => {
  try {
    const base = getBaseUrl(req);
    const result = {};
    if (req.files?.beforeImage) {
      result.beforeImageUrl = `${base}/uploads/gallery/${req.files.beforeImage[0].filename}`;
    }
    if (req.files?.afterImage) {
      result.afterImageUrl = `${base}/uploads/gallery/${req.files.afterImage[0].filename}`;
    }
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get all gallery items (Public) ──
router.get('/', async (req, res) => {
  try {
    const items = await GalleryItem.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Add new gallery item (Protected) ──
router.post('/', protect, async (req, res) => {
  try {
    const item = await GalleryItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Update gallery item (Protected) ──
router.put('/:id', protect, async (req, res) => {
  try {
    let item = await GalleryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    item = await GalleryItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Delete gallery item (Protected) ──
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await GalleryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

    // Clean up uploaded files if they're local
    const tryDelete = (url) => {
      if (url && url.includes('/uploads/gallery/')) {
        const filename = url.split('/uploads/gallery/')[1];
        const filepath = path.join(galleryDir, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    };
    tryDelete(item.beforeImage);
    tryDelete(item.afterImage);

    await item.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
