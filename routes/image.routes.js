const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const Jimp = require('jimp');
// NOTE: @imgly/background-removal-node is NOT imported at the top level.
// It's lazy-loaded below because its WASM/native binaries crash
// Vercel serverless functions when imported unconditionally at startup.
const { getAuthUser } = require('../middleware/auth');
const checkUsageLimit = require('../middleware/usageLimit');

const path = require('path');
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, '../uploads');

const router = express.Router();
const upload = multer({ dest: uploadsDir });

// Jimp fallback for serverless environment (removes solid/near-white backgrounds cleanly)
const removeBgMock = async (filePath) => {
  try {
    const image = await Jimp.read(filePath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    // Sample the corner pixels to calculate average background color
    const corners = [
      Jimp.intToRGBA(image.getPixelColor(0, 0)),
      Jimp.intToRGBA(image.getPixelColor(width - 1, 0)),
      Jimp.intToRGBA(image.getPixelColor(0, height - 1)),
      Jimp.intToRGBA(image.getPixelColor(width - 1, height - 1))
    ];
    
    const avgR = Math.round(corners.reduce((sum, c) => sum + c.r, 0) / 4);
    const avgG = Math.round(corners.reduce((sum, c) => sum + c.g, 0) / 4);
    const avgB = Math.round(corners.reduce((sum, c) => sum + c.b, 0) / 4);
    
    const tolerance = 45;
    
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const color = Jimp.intToRGBA(image.getPixelColor(x, y));
        
        // Color distance to the sampled background
        const distance = Math.sqrt(
          Math.pow(color.r - avgR, 2) +
          Math.pow(color.g - avgG, 2) +
          Math.pow(color.b - avgB, 2)
        );
        
        // Detect near-white/light gray as well
        const isNearWhite = color.r > 225 && color.g > 225 && color.b > 225;
        
        if (distance < tolerance || isNearWhite) {
          // Set transparent (Alpha = 0)
          image.setPixelColor(Jimp.rgbaToInt(color.r, color.g, color.b, 0), x, y);
        }
      }
    }
    
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (err) {
    console.error('Jimp background removal fallback processing error:', err);
    // If it fails, return the original image buffer
    return fs.readFileSync(filePath);
  }
};

const removeBgFromFile = async (file, size = 'auto') => {
  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

  // On Vercel, if API key is missing or set to mock_key, use Jimp fallback
  if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'mock_key') {
    if (process.env.VERCEL) {
      console.warn('REMOVE_BG_API_KEY is not configured or mock_key on Vercel. Falling back to Jimp processing.');
      try {
        const buffer = await removeBgMock(file.path);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { buffer, originalName: file.originalname };
      } catch (err) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error(`Jimp fallback background removal failed: ${err.message}`);
      }
    } else {
      // Local AI fallback
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
  }

  // Otherwise, invoke the real Remove.bg API key
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
    console.error('Remove.bg API failed:', error.message);

    // If API failed (e.g. 402 payment required or network error), use fallback
    if (process.env.VERCEL) {
      console.warn('Remove.bg API failed on Vercel. Falling back to Jimp processing.');
      try {
        const buffer = await removeBgMock(file.path);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { buffer, originalName: file.originalname };
      } catch (err) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error(`Remove.bg failed (${error.message}) AND Jimp fallback failed (${err.message})`);
      }
    } else {
      try {
        const { removeBackground } = require('@imgly/background-removal-node');
        const fileUri = 'file://' + file.path.replace(/\\/g, '/');
        const blob = await removeBackground(fileUri);
        const buffer = Buffer.from(await blob.arrayBuffer());
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { buffer, originalName: file.originalname };
      } catch (fallbackErr) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error(`Remove.bg failed (${error.message}) AND Local AI failed (${fallbackErr.message})`);
      }
    }
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
