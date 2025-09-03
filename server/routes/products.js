const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockAudit = require('../models/StockAudit');
const upload = require('../middleware/upload');
const { parseCSV, validateProductCSV } = require('../utils/csvParser');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Get product by SKU
router.get('/sku/:sku', async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

// Upload products CSV
router.post('/upload', upload.single('csv'), async (req, res) => {
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
    const validationErrors = validateProductCSV(csvData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'CSV validation failed', 
        errors: validationErrors 
      });
    }

    let successCount = 0;
    let updatedCount = 0;
    let newCount = 0;
    const errors = [];
    const batchId = `csv_upload_${Date.now()}`;

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNum = i + 1;

      try {
        const productData = {
          sku: row['SKU'] || row['sku'] || row['Variant SKU'] || row['variant_sku'],
          product_name: row['Product Name'] || row['product_name'] || row['Title'] || row['title'],
          quantity: parseInt(row['Quantity'] || row['quantity'] || row['Variant Inventory Qty'] || row['variant_inventory_qty']),
          image_url: row['Image'] || row['image'] || row['image_url'] || row['Image Src'] || row['image_src'] || ''
        };

        // Check if product exists
        const existingProduct = await Product.findOne({ sku: productData.sku });
        const isUpdate = !!existingProduct;
        const oldQuantity = existingProduct ? existingProduct.quantity : 0;

        // Use upsert to update existing or create new
        const updatedProduct = await Product.findOneAndUpdate(
          { sku: productData.sku },
          productData,
          { upsert: true, new: true }
        );

        // Log stock audit
        if (isUpdate && oldQuantity !== productData.quantity) {
          await StockAudit.create({
            sku: productData.sku,
            product_name: productData.product_name,
            action: 'stock_update',
            old_quantity: oldQuantity,
            new_quantity: productData.quantity,
            quantity_change: productData.quantity - oldQuantity,
            reason: 'CSV upload update',
            source: 'csv_upload',
            batch_id: batchId,
            user_ip: req.ip || 'system'
          });
          updatedCount++;
        } else if (!isUpdate) {
          await StockAudit.create({
            sku: productData.sku,
            product_name: productData.product_name,
            action: 'product_upload',
            old_quantity: 0,
            new_quantity: productData.quantity,
            quantity_change: productData.quantity,
            reason: 'New product from CSV',
            source: 'csv_upload',
            batch_id: batchId,
            user_ip: req.ip || 'system'
          });
          newCount++;
        }

        successCount++;
      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    res.json({
      message: `Successfully processed ${successCount} products (${newCount} new, ${updatedCount} updated)`,
      count: successCount,
      newProducts: newCount,
      updatedProducts: updatedCount,
      batchId: batchId,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error uploading products:', error);
    res.status(500).json({ message: 'Failed to upload products' });
  }
});

// Update product quantity
router.put('/:id/quantity', async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { quantity },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error updating product quantity:', error);
    res.status(500).json({ message: 'Failed to update product quantity' });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// Update a single product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, quantity, image_url } = req.body;

    // Get the existing product
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const oldQuantity = existingProduct.quantity;
    const newQuantity = parseInt(quantity);

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { product_name, quantity: newQuantity, image_url },
      { new: true }
    );

    // Log stock audit if quantity changed
    if (oldQuantity !== newQuantity) {
      await StockAudit.create({
        sku: existingProduct.sku,
        product_name: product_name,
        action: 'stock_update',
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        quantity_change: newQuantity - oldQuantity,
        reason: 'Manual product edit',
        source: 'manual_entry',
        user_ip: req.ip || 'system'
      });
    }

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// Create a new product
router.post('/', async (req, res) => {
  try {
    const { sku, product_name, quantity, image_url } = req.body;

    // Check if product with SKU already exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({ message: 'Product with this SKU already exists' });
    }

    // Create new product
    const newProduct = new Product({
      sku,
      product_name,
      quantity: parseInt(quantity),
      image_url: image_url || ''
    });

    await newProduct.save();

    // Log stock audit for new product
    await StockAudit.create({
      sku: sku,
      product_name: product_name,
      action: 'product_upload',
      old_quantity: 0,
      new_quantity: parseInt(quantity),
      quantity_change: parseInt(quantity),
      reason: 'Manual product creation',
      source: 'manual_entry',
      user_ip: req.ip || 'system'
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });

  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Product with this SKU already exists' });
    } else {
      res.status(500).json({ message: 'Failed to create product' });
    }
  }
});

module.exports = router;

