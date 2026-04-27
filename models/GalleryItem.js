const mongoose = require('mongoose');

const GalleryItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['People', 'Products', 'Animals', 'Cars', 'Graphics'],
    default: 'People'
  },
  beforeImage: {
    type: String,
    required: true, // URL to before image
  },
  afterImage: {
    type: String,
    required: true, // URL to after image
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('GalleryItem', GalleryItemSchema);
