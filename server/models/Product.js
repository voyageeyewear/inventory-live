const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  product_name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  image_url: {
    type: String,
    trim: true
  },
  last_synced: {
    type: Date,
    default: null
  },
  needs_sync: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster SKU lookups (handled by unique: true)

module.exports = mongoose.model('Product', productSchema);

