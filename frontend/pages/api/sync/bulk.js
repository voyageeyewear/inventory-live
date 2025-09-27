import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'
import { updateShopifyInventory, batchSyncProducts } from '../services/shopify-service'

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-2024-secure-key')
    
    const userResult = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.id])

    if (userResult.rows.length === 0) {
      throw new Error('Invalid token or user inactive')
    }

    return userResult.rows[0]
  } catch (error) {
    throw new Error('Authentication failed')
  }
}

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { storeId, syncAll = false, productIds = [] } = req.body
    
    // Get products that need sync (either from frontend or query database)
    let products
    if (productIds && productIds.length > 0) {
      // Use specific products provided by frontend
      const placeholders = productIds.map((_, index) => `$${index + 1}`).join(',')
      const productsResult = await query(`
        SELECT * FROM products 
        WHERE id IN (${placeholders}) AND is_active = true
        ORDER BY last_modified DESC NULLS LAST
      `, productIds)
      products = productsResult.rows
    } else {
      // Fallback to database query for modified products
      const productsResult = await query(`
        SELECT * FROM products 
        WHERE is_active = true 
        AND (needs_sync = true OR last_modified > COALESCE(last_synced, '1970-01-01'))
        ORDER BY last_modified DESC NULLS LAST
        LIMIT 100
      `)
      products = productsResult.rows
    }

    if (products.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No products found for sync',
        results: [],
        summary: {
          total_products: 0,
          total_stores: 0,
          successful: 0,
          failed: 0
        }
      })
    }

    // Get connected stores
    let storesQuery = 'SELECT * FROM stores WHERE connected = true AND is_active = true'
    let storesParams = []
    
    if (!syncAll && storeId) {
      storesQuery += ' AND id = $1'
      storesParams = [storeId]
    }
    
    const storesResult = await query(storesQuery, storesParams)
    const stores = storesResult.rows

    if (stores.length === 0) {
      return res.status(400).json({ 
        message: syncAll ? 'No connected stores found' : 'Selected store not found or not connected' 
      })
    }

    let allSyncResults = []
    let totalSuccessCount = 0
    let totalErrorCount = 0

    // Process each store separately with rate limiting
    for (const store of stores) {
      console.log(`Starting sync for store: ${store.store_name} (${products.length} products)`)
      
      // Split products into smaller batches to avoid timeouts
      const batchSize = 25 // Small batch size to avoid timeouts
      const batches = []
      for (let i = 0; i < products.length; i += batchSize) {
        batches.push(products.slice(i, i + batchSize))
      }
      
      console.log(`Processing ${batches.length} batches of max ${batchSize} products each`)
      
      let storeResults = []
      
      // Process each batch with delays
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} products) for store: ${store.store_name}`)
        
        try {
          // Use batch sync with rate limiting for this batch
          const batchResults = await batchSyncProducts(store, batch, (current, total, sku, success) => {
            console.log(`Store ${store.store_name} Batch ${batchIndex + 1}: ${current}/${total} - ${sku} - ${success ? 'SUCCESS' : 'FAILED'}`)
          })
          
          storeResults.push(...batchResults)
          
          // Add delay between batches to avoid rate limiting
          if (batchIndex < batches.length - 1) {
            console.log(`Waiting 3 seconds before next batch...`)
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        } catch (error) {
          console.error(`Batch ${batchIndex + 1} failed for store ${store.store_name}:`, error)
          // Add failed results for this batch
          batch.forEach(product => {
            storeResults.push({
              success: false,
              error: `Batch sync failed: ${error.message}`,
              product_name: product.product_name,
              sku: product.sku
            })
          })
        }
      }
      
      // Process results and create audit logs
      for (let i = 0; i < products.length; i++) {
        const product = products[i]
        const result = storeResults[i]
        
        if (result.success) {
            // Create successful sync audit log
            await query(`
              INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            `, [
              product.id,
              product.product_name,
              product.sku,
              'sync',
              product.quantity,
              result.previousQuantity || product.quantity,
              product.quantity,
              `SUCCESS: Bulk sync to store: ${store.store_name} - Updated inventory from ${result.previousQuantity || 'unknown'} to ${product.quantity}`,
              user.id,
              user.username
            ])
          
          totalSuccessCount++
        } else {
          // Create failed sync audit log
          await query(`
            INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
          `, [
            product.id,
            product.product_name,
            product.sku,
            'sync',
            product.quantity,
            product.quantity,
            product.quantity,
            `ERROR: Bulk sync to store: ${store.store_name} - ${result.error}`,
            user.id,
            user.username
          ])
          
          totalErrorCount++
        }
        
        // Add to results
        const existingProductIndex = allSyncResults.findIndex(r => r.product.id === product.id)
        const storeResult = {
          store: store.store_name || store.name,
          status: result.success ? 'success' : 'error',
          message: result.success ? 
            `Successfully synced ${product.quantity} units to ${store.store_name}` : 
            `Failed to sync to ${store.store_name}: ${result.error}`,
          error: result.success ? null : result.error,
          duration_ms: 0 // Not tracked in batch sync
        }
        
        if (existingProductIndex >= 0) {
          allSyncResults[existingProductIndex].results.push(storeResult)
        } else {
          allSyncResults.push({
            product: {
              id: product.id,
              sku: product.sku,
              product_name: product.product_name,
              quantity: product.quantity
            },
            results: [storeResult]
          })
        }
      }
      
      // Mark products as synced if at least one store succeeded
      for (const product of products) {
        const productResults = allSyncResults.find(r => r.product.id === product.id)
        const hasSuccess = productResults?.results.some(r => r.status === 'success')
        
        if (hasSuccess) {
          await query(`
            UPDATE products 
            SET last_synced = CURRENT_TIMESTAMP, needs_sync = false 
            WHERE id = $1
          `, [product.id])
        }
      }
      
      // Delay between stores to avoid rate limiting
      if (stores.indexOf(store) < stores.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Bulk sync completed: ${totalSuccessCount} successful, ${totalErrorCount} failed`,
      results: allSyncResults,
      summary: {
        total_products: products.length,
        total_stores: stores.length,
        total_operations: products.length * stores.length,
        successful: totalSuccessCount,
        failed: totalErrorCount,
        sync_type: syncAll ? 'all_stores' : 'single_store',
        total: products.length
      },
      errors: allSyncResults.filter(result => !result.success).map(result => result.error),
      details: allSyncResults.map(result => ({
        product_name: result.product_name,
        sku: result.sku,
        status: result.success ? 'success' : 'failed',
        message: result.success ? 'Successfully synced' : result.error
      }))
    })
  } catch (error) {
    console.error('Bulk sync error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to bulk sync products: ' + error.message })
  }
}
