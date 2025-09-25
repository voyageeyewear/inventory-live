import { query } from '../../../lib/postgres'
import { updateShopifyInventory, syncAllVariantsForSKU } from '../../../services/shopifyService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Bulk sync all products to Shopify started')

    // Get all connected stores
    const storesResult = await query(`
      SELECT id, store_name, store_domain, shopify_domain, access_token
      FROM stores 
      WHERE connected = true
    `)

    const stores = storesResult.rows

    if (stores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No connected Shopify stores found'
      })
    }

    // Get all active products from local inventory
    const productsResult = await query(`
      SELECT id, sku, product_name, quantity, category
      FROM products 
      WHERE is_active = true
      ORDER BY id
    `)

    const products = productsResult.rows
    console.log(`Found ${products.length} active products to sync to ${stores.length} stores`)

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active products found to sync'
      })
    }

    const results = []
    let successCount = 0
    let errorCount = 0
    let totalProcessed = 0

    // Process products in batches to avoid overwhelming the API
    const batchSize = 10 // Process 10 products at a time
    const totalBatches = Math.ceil(products.length / batchSize)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batch = products.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize)
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} products)`)

      // Process each product in the batch
      for (const product of batch) {
        totalProcessed++
        const productResults = []

        // Sync to all connected stores - update ALL variants for this SKU
        for (const store of stores) {
          try {
            const result = await syncAllVariantsForSKU(
              {
                id: store.id,
                store_name: store.store_name,
                store_domain: store.store_domain,
                access_token: store.access_token
              },
              product.sku,
              product.quantity
            )

            if (result.success) {
              productResults.push({
                store_id: store.id,
                store_name: store.store_name,
                success: true,
                message: `Updated ${result.variantsUpdated} variants to ${product.quantity} units each`,
                variantsUpdated: result.variantsUpdated
              })
            } else {
              productResults.push({
                store_id: store.id,
                store_name: store.store_name,
                success: false,
                message: result.message || 'Update failed',
                variantsUpdated: 0
              })
            }
          } catch (error) {
            console.error(`Failed to update inventory for ${product.sku} in ${store.store_name}:`, error)
            productResults.push({
              store_id: store.id,
              store_name: store.store_name,
              success: false,
              message: error.message || 'Unknown error',
              variantsUpdated: 0
            })
          }
        }

        // Count successes and failures for this product
        const productSuccessCount = productResults.filter(r => r.success).length
        const productErrorCount = productResults.filter(r => !r.success).length

        if (productSuccessCount > 0) {
          successCount++
        }
        if (productErrorCount > 0) {
          errorCount++
        }

        results.push({
          product_id: product.id,
          sku: product.sku,
          product_name: product.product_name,
          quantity: product.quantity,
          results: productResults,
          success: productSuccessCount === stores.length,
          summary: {
            total_stores: stores.length,
            successful: productSuccessCount,
            failed: productErrorCount
          }
        })

        // Add a small delay between products to respect rate limits
        if (totalProcessed < products.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Add a longer delay between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Update sync status for all successfully synced products
    const successfullySyncedProducts = results.filter(r => r.success)
    if (successfullySyncedProducts.length > 0) {
      try {
        const productIds = successfullySyncedProducts.map(r => r.product_id)
        await query(`
          UPDATE products 
          SET needs_sync = false, last_synced = CURRENT_TIMESTAMP 
          WHERE id = ANY($1)
        `, [productIds])
        console.log(`Updated sync status for ${successfullySyncedProducts.length} products`)
      } catch (dbError) {
        console.error('Failed to update sync status in database:', dbError)
      }
    }

    // Log the bulk sync activity
    try {
      await query(`
        INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, created_at)
        VALUES (NULL, 'BULK SYNC', 'ALL_PRODUCTS', 'bulk_sync_all', 0, 0, 0, $1, CURRENT_TIMESTAMP)
      `, [
        `Bulk sync: ${successfullySyncedProducts.length}/${products.length} products synced to ${stores.length} stores. Success: ${successCount}, Errors: ${errorCount}`
      ])
    } catch (logError) {
      console.error('Failed to log bulk sync activity:', logError)
    }

    console.log(`Bulk sync completed: ${successCount}/${products.length} products successful, ${errorCount} errors`)

    res.status(200).json({
      success: true,
      message: `Bulk sync completed: ${successCount}/${products.length} products synced successfully`,
      summary: {
        total_products: products.length,
        total_stores: stores.length,
        successful_products: successCount,
        failed_products: errorCount,
        success_rate: Math.round((successCount / products.length) * 100)
      },
      results: results.slice(0, 100), // Limit results to first 100 for response size
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in bulk sync to Shopify:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to sync all products to Shopify',
      error: error.message
    })
  }
}
