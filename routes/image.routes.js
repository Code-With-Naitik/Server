const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
// NOTE: @imgly/background-removal-node is NOT imported at the top level.
// It's lazy-loaded below because its WASM/native binaries crash
// Vercel serverless functions when imported unconditionally at startup.
const { getAuthUser } = require('../middleware/auth');
const checkUsageLimit = require('../middleware/usageLimit');

const path = require('path');
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, '../uploads');

const router = express.Router();
const upload = multer({ dest: uploadsDir });

const removeBgFromFile = async (file, size = 'auto') => {
  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

  // Use local AI only when no real API key AND not on Vercel (can't run WASM there)
  if ((!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'mock_key') && !process.env.VERCEL) {
    try {
      const { removeBackground } = require('@imgly/background-removal-node');
      const fileUri = 'file://' + file.path.replace(/\\/g, '/');
      const blob = await removeBackground(fileUri);
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return { buffer, originalName: file.originalname };
    } catch (err) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.error('Local BG Removal Error:', err);
      throw new Error(`Local background removal failed: ${err.message}`);
    }
  }

  // On Vercel with no API key — throw a clear error
  if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'mock_key') {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('REMOVE_BG_API_KEY is not configured. Please add it in Vercel environment variables.');
  }

  try {
    const formData = new FormData();
    formData.append('size', size);
    formData.append('image_file', fs.createReadStream(file.path));

    const response = await axios({
      method: 'post',
      url: 'https://api.remove.bg/v1.0/removebg',
      data: formData,
      responseType: 'arraybuffer',
      headers: {
        ...formData.getHeaders(),
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
    });

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return { buffer: response.data, originalName: file.originalname };
  } catch (error) {
    let apiErrorMsg = error.message;
    
    // Since responseType is arraybuffer, decode response data to string to see real error
    if (error.response && error.response.data) {
      try {
        const decodedErrorString = Buffer.from(error.response.data).toString('utf8');
        const parsedJson = JSON.parse(decodedErrorString);
        if (parsedJson && parsedJson.errors && parsedJson.errors[0]) {
          apiErrorMsg = parsedJson.errors[0].title || parsedJson.errors[0].detail || apiErrorMsg;
        }
      } catch (e) {
        // Not a JSON error or unable to parse buffer
      }
    }

    console.error(`Remove.bg API failed: ${apiErrorMsg}`);

    // Only attempt local fallback if NOT on Vercel
    if (!process.env.VERCEL) {
      console.log('Attempting local AI background removal fallback...');
      try {
        const { removeBackground } = require('@imgly/background-removal-node');
        const fileUri = 'file://' + file.path.replace(/\\/g, '/');
        const blob = await removeBackground(fileUri);
        const buffer = Buffer.from(await blob.arrayBuffer());
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { buffer, originalName: file.originalname };
      } catch (fallbackErr) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error(`Remove.bg API failed (${apiErrorMsg}) AND Local AI fallback failed (${fallbackErr.message})`);
      }
    }

    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error(`Background removal failed: ${apiErrorMsg}`);
  }
};


router.post('/remove-bg', getAuthUser, checkUsageLimit, upload.array('image_files', 5), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No image files uploaded' });
  }

  try {
    const { size = 'auto' } = req.body;
    const results = await Promise.all(req.files.map(file => removeBgFromFile(file, size)));

    // Deduct credits if logged in and not premium
    if (req.userObj && !req.userObj.isPremium) {
      req.userObj.credits -= req.files.length;
      await req.userObj.save();
    }

    if (results.length === 1) {
      res.set('Content-Type', 'image/png');
      return res.send(results[0].buffer);
    }

    const base64Results = results.map(r => ({
      name: r.originalName,
      data: `data:image/png;base64,${r.buffer.toString('base64')}`
    }));

    res.json({
      success: true,
      files: base64Results,
      credits: req.userObj ? req.userObj.credits : null
    });
  } catch (error) {
    console.error('Error removing backgrounds:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to process images' });
  }
});

module.exports = router;
