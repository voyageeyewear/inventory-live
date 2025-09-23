import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'
import { updateShopifyInventory } from '../services/shopify-service'

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-key-2024-production')
    
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
  // Set longer timeout for large syncs
  res.setTimeout(300000) // 5 minutes timeout

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
    
    const { storeId, syncAll = false, productIds, batchSize = 10 } = req.body
    
    console.log(`Starting optimized bulk sync - Store ID: ${storeId}, Sync All: ${syncAll}, Product IDs: ${productIds?.length || 'all'}`)

    // Get products to sync
    let products
    if (productIds && productIds.length > 0) {
      const productIdsResult = await query('SELECT * FROM products WHERE id = ANY($1) AND is_active = true', [productIds])
      products = productIdsResult.rows
    } else {
      const needsSyncResult = await query(`
        SELECT * FROM products 
        WHERE is_active = true 
        AND COALESCE(needs_sync, true) = true
        ORDER BY last_modified DESC NULLS LAST
        LIMIT 100
      `) // Limit to 100 products for testing
      products = needsSyncResult.rows
    }

    if (products.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No products need syncing',
        summary: { total: 0, successful: 0, failed: 0 }
      })
    }

    // Get stores to sync to
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

    // Process each store separately
    for (const store of stores) {
      console.log(`Starting optimized sync for store: ${store.store_name} (${products.length} products)`)
      
      // Split into smaller batches
      const batches = []
      for (let i = 0; i < products.length; i += batchSize) {
        batches.push(products.slice(i, i + batchSize))
      }
      
      let storeResults = []
      
      // Process each batch with proper error handling
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} products)`)
        
        const batchResults = []
        
        // Process products in batch sequentially to avoid rate limiting
        for (let productIndex = 0; productIndex < batch.length; productIndex++) {
          const product = batch[productIndex]
          
          try {
            const result = await updateShopifyInventory(store, product)
            batchResults.push(result)
            
            if (result.success) {
              totalSuccessCount++
              
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
                `SUCCESS: Optimized sync to store: ${store.store_name} - Updated inventory from ${result.previousQuantity || 'unknown'} to ${product.quantity}`,
                user.id,
                user.username
              ])
              
              // Mark product as synced
              await query(`
                UPDATE products 
                SET last_synced = CURRENT_TIMESTAMP, needs_sync = false 
                WHERE id = $1
              `, [product.id])
            } else {
              totalErrorCount++
              
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
                `ERROR: Optimized sync to store: ${store.store_name} - ${result.error}`,
                user.id,
                user.username
              ])
            }
            
            // Add delay between products
            if (productIndex < batch.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
            
          } catch (error) {
            console.error(`Failed to sync product ${product.sku}:`, error.message)
            totalErrorCount++
            
            batchResults.push({
              success: false,
              error: error.message,
              product_name: product.product_name,
              sku: product.sku
            })
            
            // Create error audit log
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
              `ERROR: Optimized sync to store: ${store.store_name} - ${error.message}`,
              user.id,
              user.username
            ])
          }
        }
        
        storeResults.push(...batchResults)
        
        // Add delay between batches
        if (batchIndex < batches.length - 1) {
          console.log(`Waiting 2 seconds before next batch...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      allSyncResults.push(...storeResults)
      
      // Add delay between stores
      if (stores.indexOf(store) < stores.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Optimized bulk sync completed: ${totalSuccessCount} successful, ${totalErrorCount} failed`,
      results: allSyncResults,
      summary: {
        total_products: products.length,
        total_stores: stores.length,
        successful: totalSuccessCount,
        failed: totalErrorCount,
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
    console.error('Optimized bulk sync error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication failed' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Optimized bulk sync failed: ' + error.message 
    })
  }
}
