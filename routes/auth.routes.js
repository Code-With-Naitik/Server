const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');

// @desc    Register a new admin
// @route   POST /api/auth/signup
// @access  Public (Should be restricted in production or require a master key)
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, adminKey } = req.body;

    // Optional: Secret key check for signup to prevent anyone from creating an admin account
    if (process.env.ADMIN_SIGNUP_KEY && adminKey !== process.env.ADMIN_SIGNUP_KEY) {
      return res.status(401).json({ success: false, message: 'Invalid admin signup key' });
    }

    const adminExists = await Admin.findOne({ $or: [{ email }, { username }] });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    const admin = await Admin.create({
      username,
      email,
      password
    });

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Login admin
// @route   POST /api/auth/signin
// @access  Public
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for admin
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get current logged in admin
// @route   GET /api/auth/me
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized' });
  }
});

// Update admin profile (Protected)
router.put('/update-profile', protect, async (req, res) => {
  try {
    const { username, email } = req.body;
    const admin = await Admin.findById(req.user._id);

    if (admin) {
      admin.username = username || admin.username;
      admin.email = email || admin.email;
      
      const updatedAdmin = await admin.save();
      res.json({
        success: true,
        data: {
          _id: updatedAdmin._id,
          username: updatedAdmin.username,
          email: updatedAdmin.email,
          role: updatedAdmin.role
        }
      });
    } else {
      res.status(404).json({ success: false, error: 'Admin not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password (Protected)
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.user._id).select('+password');

    if (!admin || !(await admin.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, error: 'Invalid current password' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
