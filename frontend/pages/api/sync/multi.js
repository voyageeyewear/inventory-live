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
    
    const { skus, storeId, productIds } = req.body
    
    let products
    if (productIds && productIds.length > 0) {
      // Use product IDs if provided
      const placeholders = productIds.map((_, index) => `$${index + 1}`).join(',')
      const productsResult = await query(
        `SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = true`,
        productIds
      )
      products = productsResult.rows
    } else if (skus && Array.isArray(skus) && skus.length > 0) {
      // Fallback to SKUs
      const placeholders = skus.map((_, index) => `$${index + 1}`).join(',')
      const productsResult = await query(
        `SELECT * FROM products WHERE sku IN (${placeholders}) AND is_active = true`,
        skus
      )
      products = productsResult.rows
    } else {
      return res.status(400).json({ message: 'SKUs array or productIds array is required' })
    }

    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found with provided identifiers' })
    }

    // Get connected stores (filter by storeId if provided)
    let storesQuery = 'SELECT * FROM stores WHERE connected = true AND is_active = true'
    let storesParams = []
    
    if (storeId) {
      storesQuery += ' AND id = $1'
      storesParams = [storeId]
    }
    
    const storesResult = await query(storesQuery, storesParams)
    const stores = storesResult.rows

    if (stores.length === 0) {
      return res.status(400).json({ message: 'No connected stores found for sync' })
    }

    let allSyncResults = []
    let totalSuccessCount = 0
    let totalErrorCount = 0

    // Sync each product to each store
    for (const product of products) {
      const productResults = []
      
      for (const store of stores) {
        const startTime = Date.now()
        let syncStatus = 'success'
        let syncMessage = ''
        let errorMessage = null
        
        try {
          // Call Shopify API to update inventory
          const shopifyResponse = await updateShopifyInventory(store, product)
          
          if (shopifyResponse.success) {
            syncMessage = `Successfully synced ${product.quantity} units to ${store.store_name}`
            
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
              shopifyResponse.previousQuantity || product.quantity,
              product.quantity,
              `Synced to store: ${store.store_name} - Updated inventory from ${shopifyResponse.previousQuantity || 'unknown'} to ${product.quantity}`,
              user.id,
              user.username
            ])
            
            // Mark product as synced for this store
            await query(`
              UPDATE products 
              SET last_synced = CURRENT_TIMESTAMP, needs_sync = false 
              WHERE id = $1
            `, [product.id])
            
            totalSuccessCount++
          } else {
            throw new Error(shopifyResponse.error || 'Unknown Shopify API error')
          }
        } catch (error) {
          syncStatus = 'error'
          syncMessage = `Failed to sync to ${store.store_name}: ${error.message}`
          errorMessage = error.message
          
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
            `SYNC FAILED to store: ${store.store_name} - Error: ${error.message}`,
            user.id,
            user.username
          ])
          
          totalErrorCount++
        }
        
        const syncDuration = Date.now() - startTime
        
        productResults.push({
          store: store.store_name || store.name,
          status: syncStatus,
          message: syncMessage,
          error: errorMessage,
          duration_ms: syncDuration
        })
      }
      
      allSyncResults.push({
        product: {
          id: product.id,
          sku: product.sku,
          product_name: product.product_name,
          quantity: product.quantity
        },
        results: productResults
      })
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Multi-sync completed: ${totalSuccessCount} successful, ${totalErrorCount} failed`,
      results: allSyncResults,
      summary: {
        total_products: products.length,
        total_stores: stores.length,
        total_operations: products.length * stores.length,
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
    console.error('Multi-sync error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to sync products: ' + error.message })
  }
}
