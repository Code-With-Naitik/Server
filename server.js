const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Load env vars
dotenv.config();

const app = express();

// Security and Logging Middlewares
app.use(helmet());
app.use(morgan('dev'));

// CORS Config
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5180',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Ensure uploads dir exists (for temp file storage)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/image', require('./routes/image.routes'));
app.use('/api/blog', require('./routes/blog.routes'));
app.use('/api/contact', require('./routes/contact.routes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

app.get('/', (req, res) => {
  res.status(200).send('BG-Remover Backend API is running. Use /api for endpoints.');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
}

module.exports = app;
