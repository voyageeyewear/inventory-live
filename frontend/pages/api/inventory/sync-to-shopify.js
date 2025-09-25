import { query } from '../../../lib/postgres'
import { updateShopifyInventory, syncAllVariantsForSKU } from '../../../services/shopifyService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  console.log('Individual sync API called with:', req.body)
  const { productId, sku, quantity } = req.body

  if (!productId || !sku || quantity === undefined) {
    console.log('Missing required fields:', { productId, sku, quantity })
    return res.status(400).json({
      success: false,
      message: 'Product ID, SKU, and quantity are required'
    })
  }

  try {
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

    // Update inventory in all connected stores - sync ALL variants for this SKU
    const results = []
    let successCount = 0
    let errorCount = 0
    let totalVariantsUpdated = 0

    for (const store of stores) {
      try {
        console.log(`Syncing all variants for SKU ${sku} to quantity ${quantity} in store ${store.store_name}`)
        
        const result = await syncAllVariantsForSKU(
          {
            id: store.id,
            store_name: store.store_name,
            store_domain: store.store_domain,
            access_token: store.access_token
          },
          sku,
          quantity
        )

        if (result.success) {
          successCount++
          totalVariantsUpdated += result.variantsUpdated
          results.push({
            store_id: store.id,
            store_name: store.store_name,
            success: true,
            message: `Updated ${result.variantsUpdated} variants to ${quantity} units each`,
            variantsUpdated: result.variantsUpdated,
            variantDetails: result.results
          })
        } else {
          errorCount++
          results.push({
            store_id: store.id,
            store_name: store.store_name,
            success: false,
            message: result.message || 'Update failed',
            variantsUpdated: 0
          })
        }
      } catch (error) {
        errorCount++
        console.error(`Failed to update inventory for ${sku} in ${store.store_name}:`, error)
        results.push({
          store_id: store.id,
          store_name: store.store_name,
          success: false,
          message: error.message || 'Unknown error',
          variantsUpdated: 0
        })
      }
    }

    // Update sync status in local database
    if (successCount > 0) {
      try {
        await query(`
          UPDATE products 
          SET needs_sync = false, last_synced = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [productId])
      } catch (dbError) {
        console.error('Failed to update sync status in database:', dbError)
      }
    }

    // Log the sync activity
    try {
      await query(`
        INSERT INTO stock_logs (product_id, sku, type, quantity_before, quantity_after, notes, created_at)
        VALUES ($1, $2, 'sync', $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        productId,
        sku,
        quantity,
        quantity,
        `Synced to ${successCount}/${stores.length} Shopify stores`
      ])
    } catch (logError) {
      console.error('Failed to log sync activity:', logError)
    }

    res.status(200).json({
      success: successCount > 0,
      message: successCount === stores.length 
        ? `Successfully synced ${totalVariantsUpdated} variants across all ${stores.length} stores`
        : `Synced ${totalVariantsUpdated} variants to ${successCount}/${stores.length} stores`,
      results,
      summary: {
        total_stores: stores.length,
        successful: successCount,
        failed: errorCount,
        total_variants_updated: totalVariantsUpdated
      }
    })

  } catch (error) {
    console.error('Error syncing to Shopify:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to sync inventory to Shopify',
      error: error.message
    })
  }
}
