const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const checkUsageLimit = require('../middleware/usageLimit');

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Temporary storage

router.post('/remove-bg', checkUsageLimit, upload.single('image_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file uploaded' });
  }

  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

  // Mock Mode for Demo (If no real API key is set or set to 'mock_key')
  if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === 'mock_key') {
    // In mock mode, we just return the original image to simulate processing
    setTimeout(() => {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        res.set('Content-Type', 'image/png');
        res.send(fileBuffer);
        fs.unlinkSync(req.file.path); // cleanup
      } catch (err) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: 'Mock processing failed' });
      }
    }, 1500); // simulate network delay
    return;
  }

  try {
    const formData = new FormData();
    formData.append('size', 'auto');
    formData.append('image_file', fs.createReadStream(req.file.path));

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

    // Cleanup: Remove the temporary uploaded file
    fs.unlinkSync(req.file.path);

    // Send the processed image back to the client
    res.set('Content-Type', 'image/png');
    res.send(response.data);
  } catch (error) {
    // Cleanup even on error
    if (req.file) fs.unlinkSync(req.file.path);
    
    console.error('Error removing background:', error.response?.data?.toString() || error.message);
    res.status(500).json({ success: false, error: 'Background removal failed. API error.' });
  }
});

module.exports = router;
