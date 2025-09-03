const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockLog = require('../models/StockLog');
const upload = require('../middleware/upload');
const { parseCSV, validateStockCSV } = require('../utils/csvParser');

// Stock-In: Add inventory
router.post('/in', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse CSV
    const csvData = await parseCSV(req.file.buffer);
    
    if (csvData.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Validate CSV data
    const validationErrors = validateStockCSV(csvData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'CSV validation failed', 
        errors: validationErrors 
      });
    }

    let successCount = 0;
    const errors = [];

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNum = i + 1;

      try {
        const sku = row['SKU'] || row['sku'];
        const quantityToAdd = parseInt(row['Quantity'] || row['quantity']);

        // Find the product
        const product = await Product.findOne({ sku });
        if (!product) {
          errors.push(`Row ${rowNum}: Product with SKU ${sku} not found`);
          continue;
        }

        // Update product quantity
        product.quantity += quantityToAdd;
        await product.save();

        // Log the stock change
        await StockLog.create({
          sku,
          change: quantityToAdd,
          action: 'Stock-In'
        });

        successCount++;
      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    res.json({
      message: `Successfully processed ${successCount} stock-in entries`,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error processing stock-in:', error);
    res.status(500).json({ message: 'Failed to process stock-in' });
  }
});

// Stock-Out: Remove inventory
router.post('/out', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse CSV
    const csvData = await parseCSV(req.file.buffer);
    
    if (csvData.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty' });
    }

    // Validate CSV data
    const validationErrors = validateStockCSV(csvData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'CSV validation failed', 
        errors: validationErrors 
      });
    }

    let successCount = 0;
    const errors = [];

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNum = i + 1;

      try {
        const sku = row['SKU'] || row['sku'];
        const quantityToRemove = parseInt(row['Quantity'] || row['quantity']);

        // Find the product
        const product = await Product.findOne({ sku });
        if (!product) {
          errors.push(`Row ${rowNum}: Product with SKU ${sku} not found`);
          continue;
        }

        // Check if we have enough stock
        if (product.quantity < quantityToRemove) {
          errors.push(`Row ${rowNum}: Insufficient stock for SKU ${sku}. Available: ${product.quantity}, Requested: ${quantityToRemove}`);
          continue;
        }

        // Update product quantity
        product.quantity -= quantityToRemove;
        await product.save();

        // Log the stock change
        await StockLog.create({
          sku,
          change: quantityToRemove,
          action: 'Stock-Out'
        });

        successCount++;
      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    res.json({
      message: `Successfully processed ${successCount} stock-out entries`,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error processing stock-out:', error);
    res.status(500).json({ message: 'Failed to process stock-out' });
  }
});

module.exports = router;

