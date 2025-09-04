const express = require('express');
const router = express.Router();
const ScanLog = require('../models/ScanLog');
const Product = require('../models/Product');
const { authenticateToken } = require('../middleware/auth');

// Get all scan logs for current user/session
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { session_id = 'mobile-session' } = req.query;
    
    const scanLogs = await ScanLog.find({
      $or: [
        { user_id: req.user.id },
        { session_id: session_id }
      ]
    }).sort({ last_scanned: -1 });
    
    res.json(scanLogs);
  } catch (error) {
    console.error('Error fetching scan logs:', error);
    res.status(500).json({ message: 'Failed to fetch scan logs' });
  }
});

// Add or update scan log
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { sku, session_id = 'mobile-session' } = req.body;
    
    if (!sku) {
      return res.status(400).json({ message: 'SKU is required' });
    }
    
    // Get product details
    const product = await Product.findOne({ sku });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if scan log already exists for this user/session and SKU
    let scanLog = await ScanLog.findOne({
      sku: sku,
      $or: [
        { user_id: req.user.id },
        { session_id: session_id }
      ]
    });
    
    if (scanLog) {
      // Update existing scan log
      scanLog.quantity += 1;
      scanLog.scan_count += 1;
      scanLog.last_scanned = new Date();
      scanLog.product_name = product.product_name; // Update in case product name changed
      scanLog.price = product.price || 0;
      scanLog.category = product.category || '';
      await scanLog.save();
    } else {
      // Create new scan log
      scanLog = new ScanLog({
        sku: sku,
        product_name: product.product_name,
        quantity: 1,
        price: product.price || 0,
        category: product.category || '',
        scan_count: 1,
        user_id: req.user.id,
        session_id: session_id
      });
      await scanLog.save();
    }
    
    res.json({
      success: true,
      message: 'Scan logged successfully',
      data: scanLog
    });
  } catch (error) {
    console.error('Error logging scan:', error);
    res.status(500).json({ message: 'Failed to log scan' });
  }
});

// Clear all scan logs for current user/session
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { session_id = 'mobile-session' } = req.query;
    
    await ScanLog.deleteMany({
      $or: [
        { user_id: req.user.id },
        { session_id: session_id }
      ]
    });
    
    res.json({
      success: true,
      message: 'Scan logs cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing scan logs:', error);
    res.status(500).json({ message: 'Failed to clear scan logs' });
  }
});

// Delete specific scan log
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const scanLog = await ScanLog.findOneAndDelete({
      _id: req.params.id,
      $or: [
        { user_id: req.user.id },
        { session_id: req.query.session_id || 'mobile-session' }
      ]
    });
    
    if (!scanLog) {
      return res.status(404).json({ message: 'Scan log not found' });
    }
    
    res.json({
      success: true,
      message: 'Scan log deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting scan log:', error);
    res.status(500).json({ message: 'Failed to delete scan log' });
  }
});

// Update scan log quantity
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }
    
    const scanLog = await ScanLog.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [
          { user_id: req.user.id },
          { session_id: req.query.session_id || 'mobile-session' }
        ]
      },
      { 
        quantity: quantity,
        last_scanned: new Date()
      },
      { new: true }
    );
    
    if (!scanLog) {
      return res.status(404).json({ message: 'Scan log not found' });
    }
    
    res.json({
      success: true,
      message: 'Scan log updated successfully',
      data: scanLog
    });
  } catch (error) {
    console.error('Error updating scan log:', error);
    res.status(500).json({ message: 'Failed to update scan log' });
  }
});

module.exports = router;
