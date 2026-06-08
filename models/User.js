const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

console.log('--- User Model Initialized from c:\\xampp\\Project1\\backend\\models\\User.js ---');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  subscriptionPlan: {
    type: String,
    enum: ['free', 'monthly', 'lifetime'],
    default: 'free',
  },
  credits: {
    type: Number,
    default: 10,
  },
  lastCreditReset: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  if (!process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET is not defined in environment variables');
    throw new Error('Server configuration error: Missing JWT Secret');
  }
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  const isMatch = await bcrypt.compare(enteredPassword, this.password);
  console.log(`Password comparison: ${isMatch ? 'Success' : 'Failed'}`);
  return isMatch;
};

module.exports = mongoose.model('User', UserSchema);
