const express = require('express');
const router = express.Router();
const StockLog = require('../models/StockLog');

// Get stock logs with optional filtering
router.get('/', async (req, res) => {
  try {
    const { action, sku, limit = 100 } = req.query;
    
    // Build query
    const query = {};
    if (action) {
      query.action = action;
    }
    if (sku) {
      query.sku = sku;
    }

    const stockLogs = await StockLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(stockLogs);
  } catch (error) {
    console.error('Error fetching stock logs:', error);
    res.status(500).json({ message: 'Failed to fetch stock logs' });
  }
});

// Get stock logs for a specific SKU
router.get('/sku/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const { limit = 50 } = req.query;

    const stockLogs = await StockLog.find({ sku })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(stockLogs);
  } catch (error) {
    console.error('Error fetching stock logs for SKU:', error);
    res.status(500).json({ message: 'Failed to fetch stock logs' });
  }
});

// Get stock summary by action
router.get('/summary', async (req, res) => {
  try {
    const summary = await StockLog.aggregate([
      {
        $group: {
          _id: '$action',
          totalEntries: { $sum: 1 },
          totalQuantity: { $sum: '$change' }
        }
      }
    ]);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({ message: 'Failed to fetch stock summary' });
  }
});

module.exports = router;

