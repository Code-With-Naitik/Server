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

const removeBgHF = async (filePath) => {
  const HF_API_TOKEN = process.env.HF_API_TOKEN || '';
  const headers = {
    'Content-Type': 'application/octet-stream'
  };
  if (HF_API_TOKEN) {
    headers['Authorization'] = `Bearer ${HF_API_TOKEN}`;
  }

  // We will try RMBG-2.0 first, and fallback to RMBG-1.4
  const models = [
    'briaai/RMBG-2.0',
    'briaai/RMBG-1.4'
  ];

  let lastError = null;

  for (const model of models) {
    const maxRetries = 2;
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempting Hugging Face model ${model} (attempt ${attempt}/2)...`);
        const response = await axios({
          method: 'post',
          url: `https://api-inference.huggingface.co/models/${model}`,
          data: fs.readFileSync(filePath),
          headers: headers,
          responseType: 'arraybuffer',
          timeout: 25000,
        });

        if (response.data && response.data.length > 0) {
          console.log(`Successfully removed background using Hugging Face model: ${model}`);
          return response.data;
        }
        throw new Error(`Received empty response from Hugging Face model ${model}`);
      } catch (error) {
        console.warn(`Hugging Face model ${model} attempt ${attempt} failed:`, error.message);
        lastError = error;

        let isLoading = false;
        if (error.response && error.response.data) {
          try {
            const jsonString = Buffer.from(error.response.data).toString('utf-8');
            const errObj = JSON.parse(jsonString);
            if (errObj.error && errObj.error.includes('loading')) {
              isLoading = true;
              if (errObj.estimated_time) {
                delay = Math.min((errObj.estimated_time + 1) * 1000, 10000);
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        }

        if (attempt < maxRetries) {
          console.log(`Waiting ${delay}ms before retrying model ${model}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          if (!isLoading) {
            delay *= 2;
          }
        }
      }
    }
  }

  throw lastError || new Error('All Hugging Face models failed');
};

const removeBgFromFile = async (file, size = 'auto') => {
  const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || '';
  const apiKeys = REMOVE_BG_API_KEY.split(',').map(k => k.trim()).filter(Boolean);
  let lastRemoveBgError = null;

  // 1. Try Remove.bg keys if configured
  if (apiKeys.length > 0 && apiKeys[0] !== 'mock_key') {
    for (let i = 0; i < apiKeys.length; i++) {
      const currentKey = apiKeys[i];
      try {
        console.log(`Attempting Remove.bg key ${i + 1}/${apiKeys.length}...`);
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
            'X-Api-Key': currentKey,
          },
        });

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { buffer: response.data, originalName: file.originalname, fallbackUsed: false };
      } catch (error) {
        const status = error.response ? error.response.status : null;
        console.error(`Remove.bg API key ${i + 1}/${apiKeys.length} failed with status ${status}:`, error.message);
        lastRemoveBgError = error;
      }
    }
  }

  // 2. If Remove.bg keys fail or are not configured, try Hugging Face Inference API
  console.log('Attempting Hugging Face RMBG-1.4 API...');
  try {
    const buffer = await removeBgHF(file.path);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
<<<<<<< HEAD
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
=======
    return { buffer, originalName: file.originalname, fallbackUsed: false };
  } catch (hfError) {
    const prevErrors = lastRemoveBgError ? `Remove.bg: ${lastRemoveBgError.message}. ` : '';
    console.error(`Hugging Face background removal failed: ${hfError.message}`);

    // 3. Fall back to local AI (Local dev) or Jimp mock (Vercel production)
    if (process.env.VERCEL) {
      console.warn('Falling back to low-quality Jimp processing on Vercel.');
      try {
        const buffer = await removeBgMock(file.path);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { buffer, originalName: file.originalname, fallbackUsed: true };
      } catch (jimpErr) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new Error(`${prevErrors}HF failed: ${hfError.message}. Jimp failed: ${jimpErr.message}`);
      }
    } else {
      console.log('Falling back to local AI background removal.');
>>>>>>> 77939a19c8181bf60d859b2b735cf40a1c469d56
      try {
        const { removeBackground } = require('@imgly/background-removal-node');
        const fileUri = 'file://' + file.path.replace(/\\/g, '/');
        const blob = await removeBackground(fileUri);
        const buffer = Buffer.from(await blob.arrayBuffer());
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return { buffer, originalName: file.originalname, fallbackUsed: false };
      } catch (localErr) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
<<<<<<< HEAD
        throw new Error(`Remove.bg API failed (${apiErrorMsg}) AND Local AI fallback failed (${fallbackErr.message})`);
      }
    }

    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error(`Background removal failed: ${apiErrorMsg}`);
=======
        throw new Error(`${prevErrors}HF failed: ${hfError.message}. Local AI failed: ${localErr.message}`);
      }
    }
>>>>>>> 77939a19c8181bf60d859b2b735cf40a1c469d56
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

    const fallbackUsed = results.some(r => r.fallbackUsed);
    if (fallbackUsed) {
      res.set('X-Fallback-Processed', 'true');
      res.set('Access-Control-Expose-Headers', 'X-Fallback-Processed');
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
