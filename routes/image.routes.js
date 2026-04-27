const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const checkUsageLimit = require('../middleware/usageLimit');

const path = require('path');
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, '../uploads');

const router = express.Router();
const upload = multer({ dest: uploadsDir }); // Temporary storage

// Helper to process a single file
const removeBgFromFile = async (file) => {
  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

  // Mock Mode
  if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'mock_key') {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const fileBuffer = fs.readFileSync(file.path);
          fs.unlinkSync(file.path);
          resolve({ buffer: fileBuffer, originalName: file.originalname });
        } catch (err) {
          if (file) fs.unlinkSync(file.path);
          reject(err);
        }
      }, 1000);
    });
  }

  try {
    const formData = new FormData();
    formData.append('size', 'auto');
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
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    
    // Log more detail for debugging
    if (error.response && error.response.data) {
      const errorMsg = error.response.data.toString();
      console.error('remove.bg API Error:', errorMsg);
    }
    
    throw error;
  }
};

router.post('/remove-bg', checkUsageLimit, upload.array('image_files', 5), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No image files uploaded' });
  }

  try {
    const results = await Promise.all(req.files.map(file => removeBgFromFile(file)));
    
    // If only one file, send back as binary (original behavior)
    if (results.length === 1) {
      res.set('Content-Type', 'image/png');
      return res.send(results[0].buffer);
    }

    // If multiple files, send as JSON with base64
    const base64Results = results.map(r => ({
      name: r.originalName,
      data: `data:image/png;base64,${r.buffer.toString('base64')}`
    }));

    res.json({ success: true, files: base64Results });
  } catch (error) {
    console.error('Error removing backgrounds:', error.message);
    const statusCode = error.response?.status || 500;
    const errorDetail = error.response?.data?.toString() || error.message;
    
    res.status(statusCode).json({ 
      success: false, 
      error: 'Background removal failed. ' + (error.response ? 'API Error' : 'Server Error'),
      detail: errorDetail
    });
  }
});

module.exports = router;
