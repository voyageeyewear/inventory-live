const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockAudit = require('../models/StockAudit');
const SyncAudit = require('../models/SyncAudit');
const StockLog = require('../models/StockLog');
const Store = require('../models/Store');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Generate comprehensive backup of all audit data
router.get('/backup', async (req, res) => {
  try {
    console.log('🔄 Starting comprehensive data backup...');
    
    // Get all audit and history data
    const [products, stockAudits, syncAudits, stockLogs, stores] = await Promise.all([
      Product.find().lean(),
      StockAudit.find().lean(),
      SyncAudit.find().lean(),
      StockLog.find().lean(),
      Store.find().lean()
    ]);

    // Create backup object with metadata
    const backupData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        totalRecords: {
          products: products.length,
          stockAudits: stockAudits.length,
          syncAudits: syncAudits.length,
          stockLogs: stockLogs.length,
          stores: stores.length
        }
      },
      data: {
        products,
        stockAudits,
        syncAudits,
        stockLogs,
        stores
      }
    };

    console.log(`📊 Backup created with ${products.length} products, ${stockAudits.length} stock audits, ${syncAudits.length} sync audits, ${stockLogs.length} stock logs, ${stores.length} stores`);

    // Set headers for file download
    const filename = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(backupData);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ success: false, message: 'Failed to create backup' });
  }
});

// Get backup statistics
router.get('/backup-stats', async (req, res) => {
  try {
    const [
      productCount,
      stockAuditCount,
      syncAuditCount,
      stockLogCount,
      storeCount,
      oldestStockAudit,
      oldestSyncAudit,
      oldestStockLog,
      newestStockAudit,
      newestSyncAudit,
      newestStockLog
    ] = await Promise.all([
      Product.countDocuments(),
      StockAudit.countDocuments(),
      SyncAudit.countDocuments(),
      StockLog.countDocuments(),
      Store.countDocuments(),
      StockAudit.findOne().sort({ createdAt: 1 }).select('createdAt'),
      SyncAudit.findOne().sort({ createdAt: 1 }).select('createdAt'),
      StockLog.findOne().sort({ timestamp: 1 }).select('timestamp'),
      StockAudit.findOne().sort({ createdAt: -1 }).select('createdAt'),
      SyncAudit.findOne().sort({ createdAt: -1 }).select('createdAt'),
      StockLog.findOne().sort({ timestamp: -1 }).select('timestamp')
    ]);

    const stats = {
      counts: {
        products: productCount,
        stockAudits: stockAuditCount,
        syncAudits: syncAuditCount,
        stockLogs: stockLogCount,
        stores: storeCount,
        totalAuditRecords: stockAuditCount + syncAuditCount + stockLogCount
      },
      dateRanges: {
        stockAudits: {
          oldest: oldestStockAudit?.createdAt || null,
          newest: newestStockAudit?.createdAt || null
        },
        syncAudits: {
          oldest: oldestSyncAudit?.createdAt || null,
          newest: newestSyncAudit?.createdAt || null
        },
        stockLogs: {
          oldest: oldestStockLog?.timestamp || null,
          newest: newestStockLog?.timestamp || null
        }
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting backup stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get backup statistics' });
  }
});

// Reset all audit and history data (preserve stores and products)
router.post('/reset-audit-data', async (req, res) => {
  try {
    const { confirmReset } = req.body;
    
    if (!confirmReset) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reset confirmation required' 
      });
    }

    console.log('🗑️ Starting audit data reset...');
    
    // Get counts before deletion for reporting
    const [stockAuditCount, syncAuditCount, stockLogCount] = await Promise.all([
      StockAudit.countDocuments(),
      SyncAudit.countDocuments(),
      StockLog.countDocuments()
    ]);

    // Delete all audit data
    const [stockAuditResult, syncAuditResult, stockLogResult] = await Promise.all([
      StockAudit.deleteMany({}),
      SyncAudit.deleteMany({}),
      StockLog.deleteMany({})
    ]);

    // Reset sync-related fields in products (but keep inventory)
    await Product.updateMany(
      {},
      { 
        needs_sync: false, 
        last_synced: null 
      }
    );

    // Reset last_sync in stores (but keep connection data)
    await Store.updateMany(
      {},
      { last_sync: null }
    );

    console.log(`✅ Reset completed: ${stockAuditResult.deletedCount} stock audits, ${syncAuditResult.deletedCount} sync audits, ${stockLogResult.deletedCount} stock logs deleted`);

    res.json({
      success: true,
      message: 'Audit data reset successfully',
      deletedRecords: {
        stockAudits: stockAuditResult.deletedCount,
        syncAudits: syncAuditResult.deletedCount,
        stockLogs: stockLogResult.deletedCount,
        totalDeleted: stockAuditResult.deletedCount + syncAuditResult.deletedCount + stockLogResult.deletedCount
      },
      preserved: {
        products: await Product.countDocuments(),
        stores: await Store.countDocuments()
      }
    });
  } catch (error) {
    console.error('Error resetting audit data:', error);
    res.status(500).json({ success: false, message: 'Failed to reset audit data' });
  }
});

// Import backup data
router.post('/import-backup', upload.single('backupFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No backup file provided' 
      });
    }

    console.log('📥 Starting backup import...');
    
    // Read and parse the backup file
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const backupData = JSON.parse(fileContent);

    // Validate backup structure
    if (!backupData.data || !backupData.metadata) {
      throw new Error('Invalid backup file structure');
    }

    const { stockAudits, syncAudits, stockLogs } = backupData.data;
    
    if (!Array.isArray(stockAudits) || !Array.isArray(syncAudits)) {
      throw new Error('Invalid audit data in backup file');
    }

    // Import audit data (skip products and stores to avoid conflicts)
    let importedStockAudits = 0;
    let importedSyncAudits = 0;
    let importedStockLogs = 0;

    if (stockAudits.length > 0) {
      // Remove _id fields to avoid conflicts
      const cleanStockAudits = stockAudits.map(audit => {
        const { _id, __v, ...cleanAudit } = audit;
        return cleanAudit;
      });
      
      const stockResult = await StockAudit.insertMany(cleanStockAudits, { ordered: false });
      importedStockAudits = stockResult.length;
    }

    if (syncAudits.length > 0) {
      // Remove _id fields to avoid conflicts
      const cleanSyncAudits = syncAudits.map(audit => {
        const { _id, __v, ...cleanAudit } = audit;
        return cleanAudit;
      });
      
      const syncResult = await SyncAudit.insertMany(cleanSyncAudits, { ordered: false });
      importedSyncAudits = syncResult.length;
    }

    if (stockLogs && Array.isArray(stockLogs) && stockLogs.length > 0) {
      // Remove _id fields to avoid conflicts
      const cleanStockLogs = stockLogs.map(log => {
        const { _id, __v, ...cleanLog } = log;
        return cleanLog;
      });
      
      const stockLogResult = await StockLog.insertMany(cleanStockLogs, { ordered: false });
      importedStockLogs = stockLogResult.length;
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    console.log(`✅ Import completed: ${importedStockAudits} stock audits, ${importedSyncAudits} sync audits, ${importedStockLogs} stock logs imported`);

    res.json({
      success: true,
      message: 'Backup imported successfully',
      importedRecords: {
        stockAudits: importedStockAudits,
        syncAudits: importedSyncAudits,
        stockLogs: importedStockLogs,
        totalImported: importedStockAudits + importedSyncAudits + importedStockLogs
      },
      backupMetadata: backupData.metadata
    });

  } catch (error) {
    console.error('Error importing backup:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: `Failed to import backup: ${error.message}` 
    });
  }
});

// Get data management summary
router.get('/summary', async (req, res) => {
  try {
    const [
      totalProducts,
      totalStores,
      totalStockAudits,
      totalSyncAudits,
      totalStockLogs,
      recentStockAudits,
      recentSyncAudits,
      recentStockLogs
    ] = await Promise.all([
      Product.countDocuments(),
      Store.countDocuments(),
      StockAudit.countDocuments(),
      SyncAudit.countDocuments(),
      StockLog.countDocuments(),
      StockAudit.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      SyncAudit.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      StockLog.countDocuments({ timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
    ]);

    // Estimate disk usage (rough calculation)
    const avgStockAuditSize = 200; // bytes
    const avgSyncAuditSize = 300; // bytes
    const avgStockLogSize = 150; // bytes
    const estimatedSize = (totalStockAudits * avgStockAuditSize) + (totalSyncAudits * avgSyncAuditSize) + (totalStockLogs * avgStockLogSize);

    const summary = {
      overview: {
        totalProducts,
        totalStores,
        totalAuditRecords: totalStockAudits + totalSyncAudits + totalStockLogs,
        estimatedSizeBytes: estimatedSize,
        estimatedSizeMB: Math.round(estimatedSize / 1024 / 1024 * 100) / 100
      },
      auditBreakdown: {
        stockAudits: totalStockAudits,
        syncAudits: totalSyncAudits,
        stockLogs: totalStockLogs
      },
      recentActivity: {
        stockAuditsLast7Days: recentStockAudits,
        syncAuditsLast7Days: recentSyncAudits,
        stockLogsLast7Days: recentStockLogs
      }
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting data management summary:', error);
    res.status(500).json({ success: false, message: 'Failed to get summary' });
  }
});

module.exports = router;
