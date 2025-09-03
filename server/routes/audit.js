const express = require('express');
const router = express.Router();
const SyncAudit = require('../models/SyncAudit');
const StockAudit = require('../models/StockAudit');
const Product = require('../models/Product');
const Store = require('../models/Store');

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Basic counts
    const totalProducts = await Product.countDocuments();
    const totalStores = await Store.countDocuments();
    const connectedStores = await Store.countDocuments({ connected: true });

    // Today's activity
    const todaySync = await SyncAudit.countDocuments({ createdAt: { $gte: today } });
    const todayStock = await StockAudit.countDocuments({ createdAt: { $gte: today } });

    // Sync statistics
    const syncStats = await SyncAudit.aggregate([
      { $match: { createdAt: { $gte: thisWeek } } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]);

    // Stock movement statistics
    const stockStats = await StockAudit.aggregate([
      { $match: { createdAt: { $gte: thisWeek } } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          totalChange: { $sum: '$quantity_change' }
        }
      }
    ]);

    // Recent activity (last 10 items)
    const recentSync = await SyncAudit.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('sku product_name action store_name new_quantity createdAt');

    const recentStock = await StockAudit.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('sku product_name action old_quantity new_quantity quantity_change createdAt');

    // Low stock alerts (products with quantity < 10)
    const lowStockProducts = await Product.find({ quantity: { $lt: 10 } })
      .sort({ quantity: 1 })
      .limit(20)
      .select('sku product_name quantity');

    // Daily sync activity for the last 7 days
    const dailyActivity = await SyncAudit.aggregate([
      { $match: { createdAt: { $gte: thisWeek } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalProducts,
          totalStores,
          connectedStores,
          todaySync,
          todayStock
        },
        syncStats: syncStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        stockStats: stockStats.reduce((acc, item) => {
          acc[item._id] = { count: item.count, totalChange: item.totalChange };
          return acc;
        }, {}),
        recentActivity: {
          sync: recentSync,
          stock: recentStock
        },
        lowStockProducts,
        dailyActivity
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard data', 
      error: error.message 
    });
  }
});

// Get sync audit logs
router.get('/sync', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      sku, 
      store, 
      action, 
      startDate, 
      endDate 
    } = req.query;

    const query = {};
    
    if (sku) query.sku = { $regex: sku, $options: 'i' };
    if (store) query.store_domain = store;
    if (action) query.action = action;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      SyncAudit.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SyncAudit.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sync audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch sync audit logs', 
      error: error.message 
    });
  }
});

// Get stock audit logs
router.get('/stock', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      sku, 
      action, 
      startDate, 
      endDate 
    } = req.query;

    const query = {};
    
    if (sku) query.sku = { $regex: sku, $options: 'i' };
    if (action) query.action = action;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      StockAudit.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      StockAudit.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching stock audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stock audit logs', 
      error: error.message 
    });
  }
});

// Get audit logs for a specific product
router.get('/product/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const { limit = 20 } = req.query;

    const [syncLogs, stockLogs] = await Promise.all([
      SyncAudit.find({ sku })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit)),
      StockAudit.find({ sku })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
    ]);

    // Combine and sort by date
    const allLogs = [
      ...syncLogs.map(log => ({ ...log.toObject(), type: 'sync' })),
      ...stockLogs.map(log => ({ ...log.toObject(), type: 'stock' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: {
        sku,
        logs: allLogs.slice(0, parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching product audit logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch product audit logs', 
      error: error.message 
    });
  }
});

module.exports = router;
