const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockAudit = require('../models/StockAudit');
const SyncAudit = require('../models/SyncAudit');
const Store = require('../models/Store');

// Get daily stock movements report
router.get('/daily-movements', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Set time to start/end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const dailyMovements = await StockAudit.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            action: "$action"
          },
          count: { $sum: 1 },
          totalQuantityChange: { $sum: "$quantity_change" },
          totalQuantityIn: {
            $sum: {
              $cond: [{ $gt: ["$quantity_change", 0] }, "$quantity_change", 0]
            }
          },
          totalQuantityOut: {
            $sum: {
              $cond: [{ $lt: ["$quantity_change", 0] }, { $abs: "$quantity_change" }, 0]
            }
          }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          movements: {
            $push: {
              action: "$_id.action",
              count: "$count",
              totalQuantityChange: "$totalQuantityChange",
              totalQuantityIn: "$totalQuantityIn",
              totalQuantityOut: "$totalQuantityOut"
            }
          },
          totalIn: { $sum: "$totalQuantityIn" },
          totalOut: { $sum: "$totalQuantityOut" },
          totalOperations: { $sum: "$count" }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        dailyMovements,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    console.error('Error getting daily movements:', error);
    res.status(500).json({ success: false, message: 'Failed to get daily movements' });
  }
});

// Get store-wise sync report
router.get('/store-sync', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const storeSyncData = await SyncAudit.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            store_name: "$store_name",
            action: "$action"
          },
          count: { $sum: 1 },
          totalQuantityChanged: { $sum: { $abs: "$quantity_change" } },
          avgSyncDuration: { $avg: "$sync_duration_ms" }
        }
      },
      {
        $group: {
          _id: "$_id.store_name",
          syncStats: {
            $push: {
              action: "$_id.action",
              count: "$count",
              totalQuantityChanged: "$totalQuantityChanged",
              avgSyncDuration: "$avgSyncDuration"
            }
          },
          totalSyncs: { $sum: "$count" },
          totalQuantityChanged: { $sum: "$totalQuantityChanged" }
        }
      },
      {
        $sort: { totalSyncs: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        storeSyncData,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    console.error('Error getting store sync data:', error);
    res.status(500).json({ success: false, message: 'Failed to get store sync data' });
  }
});

// Get inventory summary report
router.get('/inventory-summary', async (req, res) => {
  try {
    // Get total products and quantities
    const inventorySummary = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          avgQuantity: { $avg: "$quantity" },
          maxQuantity: { $max: "$quantity" },
          minQuantity: { $min: "$quantity" },
          productsNeedingSync: {
            $sum: { $cond: [{ $eq: ["$needs_sync", true] }, 1, 0] }
          },
          lowStockProducts: {
            $sum: { $cond: [{ $lte: ["$quantity", 10] }, 1, 0] }
          },
          outOfStockProducts: {
            $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] }
          }
        }
      }
    ]);

    // Get recent activity counts
    const recentActivity = await StockAudit.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
          totalQuantityChange: { $sum: "$quantity_change" }
        }
      }
    ]);

    // Get top products by quantity
    const topProducts = await Product.find()
      .sort({ quantity: -1 })
      .limit(10)
      .select('sku product_name quantity');

    // Get low stock products
    const lowStockProducts = await Product.find({ quantity: { $lte: 10 } })
      .sort({ quantity: 1 })
      .limit(10)
      .select('sku product_name quantity');

    res.json({
      success: true,
      data: {
        summary: inventorySummary[0] || {},
        recentActivity,
        topProducts,
        lowStockProducts
      }
    });
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    res.status(500).json({ success: false, message: 'Failed to get inventory summary' });
  }
});

// Get sync performance report
router.get('/sync-performance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const syncPerformance = await SyncAudit.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            sync_type: "$sync_type"
          },
          count: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ["$action", "sync_success"] }, 1, 0] }
          },
          failureCount: {
            $sum: { $cond: [{ $eq: ["$action", "sync_failed"] }, 1, 0] }
          },
          avgDuration: { $avg: "$sync_duration_ms" },
          totalQuantityChanged: { $sum: { $abs: "$quantity_change" } }
        }
      },
      {
        $sort: { "_id.date": -1 }
      }
    ]);

    // Get error analysis
    const errorAnalysis = await SyncAudit.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          action: "sync_failed"
        }
      },
      {
        $group: {
          _id: "$error_message",
          count: { $sum: 1 },
          affectedStores: { $addToSet: "$store_name" }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: {
        syncPerformance,
        errorAnalysis,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    console.error('Error getting sync performance:', error);
    res.status(500).json({ success: false, message: 'Failed to get sync performance' });
  }
});

// Get product activity report
router.get('/product-activity', async (req, res) => {
  try {
    const { startDate, endDate, limit = 50 } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const productActivity = await StockAudit.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: "$sku",
          product_name: { $first: "$product_name" },
          totalOperations: { $sum: 1 },
          totalQuantityIn: {
            $sum: { $cond: [{ $gt: ["$quantity_change", 0] }, "$quantity_change", 0] }
          },
          totalQuantityOut: {
            $sum: { $cond: [{ $lt: ["$quantity_change", 0] }, { $abs: "$quantity_change" }, 0] }
          },
          netQuantityChange: { $sum: "$quantity_change" },
          lastActivity: { $max: "$createdAt" },
          activities: {
            $push: {
              action: "$action",
              quantity_change: "$quantity_change",
              reason: "$reason",
              createdAt: "$createdAt"
            }
          }
        }
      },
      {
        $sort: { totalOperations: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json({
      success: true,
      data: {
        productActivity,
        dateRange: { start, end }
      }
    });
  } catch (error) {
    console.error('Error getting product activity:', error);
    res.status(500).json({ success: false, message: 'Failed to get product activity' });
  }
});

module.exports = router;
