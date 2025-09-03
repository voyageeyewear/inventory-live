const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Store = require('../models/Store');
const SyncAudit = require('../models/SyncAudit');
const ShopifyService = require('../services/shopifyService');

// Sync one product to all connected stores (for testing)
router.post('/test-one', async (req, res) => {
  try {
    // Get all connected stores
    const stores = await Store.find({ connected: true });
    
    if (stores.length === 0) {
      return res.status(400).json({ message: 'No connected stores found' });
    }

    // Get specific product by SKU if provided, otherwise get first product
    const targetSku = req.body.sku;
    const product = targetSku 
      ? await Product.findOne({ sku: targetSku })
      : await Product.findOne({ sku: "TEST-BEST" }); // Use TEST-BEST for testing
    
    if (!product) {
      return res.status(400).json({ message: 'No products found to sync' });
    }

    console.log(`🧪 Testing sync for 1 product: ${product.sku} (${product.product_name})`);

    let totalUpdated = 0;
    let totalErrors = 0;
    const syncResults = [];

    // Process each store
    for (const store of stores) {
      const storeResult = {
        store_name: store.store_name,
        store_domain: store.store_domain,
        products_updated: 0,
        products_failed: 0,
        errors: []
      };

      console.log(`🔄 Syncing to store: ${store.store_name}`);

      const startTime = Date.now();
      try {
        // Try to update the product in Shopify
        const result = await ShopifyService.updateInventory(
          store.store_domain,
          store.access_token,
          product.sku,
          product.quantity
        );

        const syncDuration = Date.now() - startTime;

        if (result.success) {
          storeResult.products_updated = 1;
          totalUpdated++;
          console.log(`✅ Updated ${product.sku}: ${result.old_quantity} → ${product.quantity} units (${result.quantity_change > 0 ? '+' : ''}${result.quantity_change})`);

          // Log successful sync
          await SyncAudit.create({
            sku: product.sku,
            product_name: product.product_name,
            store_name: store.store_name,
            store_domain: store.store_domain,
            action: 'sync_success',
            old_quantity: result.old_quantity,
            new_quantity: result.new_quantity,
            quantity_change: result.quantity_change,
            sync_type: 'single_sync',
            shopify_product_id: result.product_id,
            shopify_variant_id: result.variant_id,
            sync_duration_ms: syncDuration
          });
        } else {
          storeResult.products_failed = 1;
          storeResult.errors.push(`${product.sku}: ${result.error}`);
          totalErrors++;
          console.log(`❌ Failed ${product.sku}: ${result.error}`);

          // Log failed sync
          await SyncAudit.create({
            sku: product.sku,
            product_name: product.product_name,
            store_name: store.store_name,
            store_domain: store.store_domain,
            action: 'sync_failed',
            old_quantity: null,
            new_quantity: product.quantity,
            quantity_change: 0,
            error_message: result.error,
            sync_type: 'single_sync',
            sync_duration_ms: syncDuration
          });
        }
      } catch (error) {
        const syncDuration = Date.now() - startTime;
        storeResult.products_failed = 1;
        storeResult.errors.push(`${product.sku}: ${error.message}`);
        totalErrors++;
        console.log(`💥 Error ${product.sku}: ${error.message}`);

        // Log error sync
        await SyncAudit.create({
          sku: product.sku,
          product_name: product.product_name,
          store_name: store.store_name,
          store_domain: store.store_domain,
          action: 'sync_failed',
          old_quantity: null,
          new_quantity: product.quantity,
          quantity_change: 0,
          error_message: error.message,
          sync_type: 'single_sync',
          sync_duration_ms: syncDuration
        });
      }

      syncResults.push(storeResult);
    }

    console.log(`🎯 Test sync complete: ${totalUpdated} updated, ${totalErrors} errors`);

    res.json({
      success: true,
      message: `Test sync completed for 1 product`,
      summary: {
        total_products: 1,
        total_stores: stores.length,
        products_updated: totalUpdated,
        products_failed: totalErrors
      },
      results: syncResults,
      test_product: {
        sku: product.sku,
        product_name: product.product_name,
        quantity: product.quantity
      }
    });

  } catch (error) {
    console.error('❌ Test sync error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Test sync failed', 
      error: error.message 
    });
  }
});

// Sync multiple products to all connected stores
router.post('/multi', async (req, res) => {
  try {
    const { skus } = req.body;
    
    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({ message: 'SKUs array is required' });
    }

    // Get all connected stores
    const stores = await Store.find({ connected: true });
    
    if (stores.length === 0) {
      return res.status(400).json({ message: 'No connected stores found' });
    }

    // Get products by SKUs
    const products = await Product.find({ sku: { $in: skus } });
    
    if (products.length === 0) {
      return res.status(400).json({ message: 'No products found with provided SKUs' });
    }

    console.log(`🔄 Multi-sync starting for ${products.length} products to ${stores.length} stores`);

    let totalUpdated = 0;
    let totalErrors = 0;
    const syncResults = [];

    // Process each store
    for (const store of stores) {
      const storeResult = {
        store_name: store.store_name,
        store_domain: store.store_domain,
        products_updated: 0,
        products_failed: 0,
        errors: []
      };

      console.log(`🔄 Syncing to store: ${store.store_name}`);

      // Process each product for this store
      for (const product of products) {
        const startTime = Date.now();
        try {
          const result = await ShopifyService.updateInventory(
            store.store_domain,
            store.access_token,
            product.sku,
            product.quantity
          );

          const syncDuration = Date.now() - startTime;

          if (result.success) {
            storeResult.products_updated++;
            totalUpdated++;
            console.log(`✅ Updated ${product.sku}: ${result.old_quantity} → ${product.quantity} units (${result.quantity_change > 0 ? '+' : ''}${result.quantity_change})`);

            // Log successful sync
            await SyncAudit.create({
              sku: product.sku,
              product_name: product.product_name,
              store_name: store.store_name,
              store_domain: store.store_domain,
              action: 'sync_success',
              old_quantity: result.old_quantity,
              new_quantity: result.new_quantity,
              quantity_change: result.quantity_change,
              sync_type: 'multi_sync',
              shopify_product_id: result.product_id,
              shopify_variant_id: result.variant_id,
              sync_duration_ms: syncDuration
            });
          } else {
            storeResult.products_failed++;
            storeResult.errors.push(`${product.sku}: ${result.error}`);
            totalErrors++;
            console.log(`❌ Failed ${product.sku}: ${result.error}`);

            // Log failed sync
            await SyncAudit.create({
              sku: product.sku,
              product_name: product.product_name,
              store_name: store.store_name,
              store_domain: store.store_domain,
              action: 'sync_failed',
              old_quantity: null,
              new_quantity: product.quantity,
              quantity_change: 0,
              error_message: result.error,
              sync_type: 'multi_sync',
              sync_duration_ms: syncDuration
            });
          }

          // Add delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          const syncDuration = Date.now() - startTime;
          storeResult.products_failed++;
          storeResult.errors.push(`${product.sku}: ${error.message}`);
          totalErrors++;
          console.log(`💥 Error ${product.sku}: ${error.message}`);

          // Log error sync
          await SyncAudit.create({
            sku: product.sku,
            product_name: product.product_name,
            store_name: store.store_name,
            store_domain: store.store_domain,
            action: 'sync_failed',
            old_quantity: null,
            new_quantity: product.quantity,
            quantity_change: 0,
            error_message: error.message,
            sync_type: 'multi_sync',
            sync_duration_ms: syncDuration
          });
        }
      }

      syncResults.push(storeResult);
    }

    console.log(`🎯 Multi-sync complete: ${totalUpdated} updated, ${totalErrors} errors`);

    res.json({
      success: true,
      message: `Multi-sync completed for ${products.length} products`,
      summary: {
        total_products: products.length,
        total_stores: stores.length,
        products_updated: totalUpdated,
        products_failed: totalErrors
      },
      results: syncResults
    });

  } catch (error) {
    console.error('❌ Multi-sync error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Multi-sync failed', 
      error: error.message 
    });
  }
});

// Sync all products to all connected stores
router.post('/', async (req, res) => {
  try {
    // Get all connected stores
    const stores = await Store.find({ connected: true });
    
    if (stores.length === 0) {
      return res.status(400).json({ message: 'No connected stores found' });
    }

    // Get all products from master database
    const products = await Product.find();
    
    if (products.length === 0) {
      return res.status(400).json({ message: 'No products found to sync' });
    }

    let totalUpdated = 0;
    let totalErrors = 0;
    const syncResults = [];

    // Process each store
    for (const store of stores) {
      const storeResult = {
        storeName: store.store_name,
        storeDomain: store.store_domain,
        updated: 0,
        errors: [],
        skipped: 0
      };

      try {
        const shopifyService = new ShopifyService(store.store_domain, store.access_token);
        
        // Test connection first
        const connectionTest = await shopifyService.testConnection();
        if (!connectionTest.success) {
          storeResult.errors.push('Connection failed: ' + connectionTest.error);
          store.connected = false;
          await store.save();
          syncResults.push(storeResult);
          continue;
        }

        // Process each product with rate limiting
        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          try {
            console.log(`🔄 Processing ${product.sku} (${i + 1}/${products.length}) for ${store.store_name}`);
            
            // Find product in Shopify by SKU
            const shopifyProduct = await shopifyService.getProductBySku(product.sku);
            
            if (shopifyProduct) {
              // Update existing product inventory
              await shopifyService.updateInventoryQuantity(
                shopifyProduct.variant.id, 
                product.quantity
              );
              storeResult.updated++;
              totalUpdated++;
              console.log(`✅ Updated ${product.sku} to ${product.quantity} units`);
            } else {
              // Product doesn't exist in this store - skip or create
              storeResult.skipped++;
              storeResult.errors.push(`Product with SKU ${product.sku} not found in store`);
              console.log(`⏭️ Skipped ${product.sku} (not found in store)`);
            }
            
            // Add delay to respect Shopify API rate limits (2 calls per second max)
            // Using 600ms delay to be safe (allows ~1.6 calls per second)
            if (i < products.length - 1) { // Don't delay after the last product
              await new Promise(resolve => setTimeout(resolve, 600));
            }
            
          } catch (error) {
            console.error(`Error syncing product ${product.sku} to ${store.store_name}:`, error);
            storeResult.errors.push(`SKU ${product.sku}: ${error.message}`);
            totalErrors++;
            console.log(`❌ Error with ${product.sku}: ${error.message}`);
            
            // Still add delay even on error to respect rate limits
            if (i < products.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 600));
            }
          }
        }

        // Update last sync time
        store.last_sync = new Date();
        await store.save();

      } catch (error) {
        console.error(`Error syncing to store ${store.store_name}:`, error);
        storeResult.errors.push('Store sync failed: ' + error.message);
        totalErrors++;
      }

      syncResults.push(storeResult);
      
      // Add delay between stores to further reduce API load
      if (stores.indexOf(store) < stores.length - 1) { // Don't delay after the last store
        console.log(`⏳ Waiting 1 second before processing next store...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.json({
      message: `Sync completed. Updated ${totalUpdated} products across ${stores.length} stores`,
      storesUpdated: stores.length,
      totalProductsUpdated: totalUpdated,
      totalErrors,
      results: syncResults
    });

  } catch (error) {
    console.error('Error during sync:', error);
    res.status(500).json({ message: 'Sync failed: ' + error.message });
  }
});

// Sync specific product to all stores
router.post('/product/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    
    // Get the product
    const product = await Product.findOne({ sku });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get all connected stores
    const stores = await Store.find({ connected: true });
    
    if (stores.length === 0) {
      return res.status(400).json({ message: 'No connected stores found' });
    }

    let totalUpdated = 0;
    let totalErrors = 0;
    const syncResults = [];

    // Process each store
    for (const store of stores) {
      const storeResult = {
        storeName: store.store_name,
        storeDomain: store.store_domain,
        updated: false,
        error: null
      };

      try {
        const shopifyService = new ShopifyService(store.store_domain, store.access_token);
        
        // Find product in Shopify by SKU
        const shopifyProduct = await shopifyService.getProductBySku(product.sku);
        
        if (shopifyProduct) {
          // Update existing product inventory
          await shopifyService.updateInventoryQuantity(
            shopifyProduct.variant.id, 
            product.quantity
          );
          storeResult.updated = true;
          totalUpdated++;
        } else {
          storeResult.error = 'Product not found in store';
        }
      } catch (error) {
        console.error(`Error syncing product ${sku} to ${store.store_name}:`, error);
        storeResult.error = error.message;
        totalErrors++;
      }

      syncResults.push(storeResult);
    }

    res.json({
      message: `Product ${sku} sync completed`,
      productSku: sku,
      quantity: product.quantity,
      storesUpdated: totalUpdated,
      totalErrors,
      results: syncResults
    });

  } catch (error) {
    console.error('Error during product sync:', error);
    res.status(500).json({ message: 'Product sync failed: ' + error.message });
  }
});

// Get sync status
router.get('/status', async (req, res) => {
  try {
    const stores = await Store.find();
    const products = await Product.find();
    
    const status = {
      totalStores: stores.length,
      connectedStores: stores.filter(s => s.connected).length,
      totalProducts: products.length,
      lastSyncTimes: stores.map(store => ({
        storeName: store.store_name,
        lastSync: store.last_sync,
        connected: store.connected
      }))
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ message: 'Failed to get sync status' });
  }
});

module.exports = router;

