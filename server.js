const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dns = require('dns');

// Load env vars
dotenv.config();

// Enable buffering but with a strict timeout
mongoose.set('bufferCommands', true);

const app = express();

// Security and Logging Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "http://localhost:5000", "https://*.remove.bg"],
      connectSrc: ["'self'", "http://localhost:5000", "https://api.remove.bg"]
    }
  }
}));
app.use(morgan('dev'));

// CORS Config
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5175',
  'http://localhost:5180',
  'https://bg-remover-eight-rho.vercel.app'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is in whitelist or is a vercel subdomain
    const isAllowed = allowedOrigins.includes(origin) || 
                     origin.endsWith('.vercel.app') || 
                     process.env.NODE_ENV === 'development';

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS Blocked: Origin ${origin} not allowed`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200,
  credentials: true
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

// Ensure uploads dir exists (use /tmp on Vercel for write access)
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.error('Error creating uploads directory:', err);
}

// Database Connection
let lastDbError = null;

// Add event listeners to mongoose connection
mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
  lastDbError = err.message;
});

mongoose.connection.on('connected', () => {
  console.log('Mongoose connected successfully');
  lastDbError = null;
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in the environment variables');
    }
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      family: 4, // Force IPv4 for SRV resolution
      serverSelectionTimeoutMS: 5000 // Fail after 5 seconds instead of hanging
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    lastDbError = null;
  } catch (err) {
    console.error(`MongoDB Error: ${err.message}`);
    console.error('Tip: If you see ECONNREFUSED for querySrv, try changing your DNS to 8.8.8.8 or using the non-SRV connection string.');
    lastDbError = err.message;
    // Do not call process.exit(1) on Vercel to prevent serverless function crash
  }
};

connectDB();

// Routes
app.use('/api/image', require('./routes/image.routes'));
app.use('/api/blog', require('./routes/blog.routes'));
app.use('/api/contact', require('./routes/contact.routes'));
app.use('/api/gallery', require('./routes/gallery.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/payment', require('./routes/payment.routes'));

// Serve static files (uploads, blog images, gallery images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/gallery', express.static(path.join(__dirname, 'uploads', 'gallery')));
app.use('/uploads/blog', express.static(path.join(__dirname, 'uploads', 'blog')));
app.use('/api/admin', require('./routes/admin.routes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  // Mask connection URI for safety
  let maskedUri = 'not defined';
  if (process.env.MONGO_URI) {
    try {
      maskedUri = process.env.MONGO_URI.replace(/:([^:@]+)@/, ':***@');
    } catch (e) {
      maskedUri = 'parse error';
    }
  }

  res.status(200).json({ 
    status: dbState === 1 ? 'ok' : 'error', 
    database: states[dbState] || 'unknown',
    uri: maskedUri,
    error: lastDbError,
    message: 'API is running' 
  });
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
// Vercel deploy trigger — 2026-05-19
