const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    index: true
  },
  product_name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  price: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    default: ''
  },
  last_scanned: {
    type: Date,
    default: Date.now
  },
  scan_count: {
    type: Number,
    default: 1,
    min: 1
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  session_id: {
    type: String,
    default: 'mobile-session'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
scanLogSchema.index({ user_id: 1, sku: 1 });
scanLogSchema.index({ session_id: 1, sku: 1 });

module.exports = mongoose.model('ScanLog', scanLogSchema);
