const mongoose = require('mongoose');

const syncAuditSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    index: true
  },
  product_name: {
    type: String,
    required: true
  },
  store_name: {
    type: String,
    required: true
  },
  store_domain: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['sync_success', 'sync_failed', 'sync_skipped'],
    required: true
  },
  old_quantity: {
    type: Number,
    default: null
  },
  new_quantity: {
    type: Number,
    required: true
  },
  quantity_change: {
    type: Number,
    default: 0
  },
  error_message: {
    type: String,
    default: null
  },
  sync_type: {
    type: String,
    enum: ['full_sync', 'single_sync', 'multi_sync'],
    default: 'full_sync'
  },
  shopify_product_id: {
    type: String,
    default: null
  },
  shopify_variant_id: {
    type: String,
    default: null
  },
  sync_duration_ms: {
    type: Number,
    default: 0
  },
  user_name: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
syncAuditSchema.index({ sku: 1, createdAt: -1 });
syncAuditSchema.index({ store_domain: 1, createdAt: -1 });
syncAuditSchema.index({ action: 1, createdAt: -1 });
syncAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SyncAudit', syncAuditSchema);
