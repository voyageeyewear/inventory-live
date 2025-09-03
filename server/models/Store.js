const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  store_name: {
    type: String,
    required: true,
    trim: true
  },
  store_domain: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  access_token: {
    type: String,
    required: true
  },
  connected: {
    type: Boolean,
    default: false
  },
  last_sync: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster domain lookups (handled by unique: true)

module.exports = mongoose.model('Store', storeSchema);

