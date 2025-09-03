const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    trim: true
  },
  change: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['Stock-In', 'Stock-Out']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries by SKU and action
stockLogSchema.index({ sku: 1, action: 1 });
stockLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('StockLog', stockLogSchema);

