const mongoose = require('mongoose');

const stockAuditSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    index: true
  },
  product_name: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['stock_in', 'stock_out', 'stock_update', 'product_upload'],
    required: true
  },
  old_quantity: {
    type: Number,
    required: true
  },
  new_quantity: {
    type: Number,
    required: true
  },
  quantity_change: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    default: 'Manual update'
  },
  source: {
    type: String,
    enum: ['csv_upload', 'manual_entry', 'api_update', 'bulk_update'],
    default: 'manual_entry'
  },
  batch_id: {
    type: String,
    default: null
  },
  user_ip: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
stockAuditSchema.index({ sku: 1, createdAt: -1 });
stockAuditSchema.index({ action: 1, createdAt: -1 });
stockAuditSchema.index({ batch_id: 1 });
stockAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockAudit', stockAuditSchema);
