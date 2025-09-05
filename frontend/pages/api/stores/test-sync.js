import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

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
    
    const { storeId } = req.body
    
    if (!storeId) {
      return res.status(400).json({ message: 'Store ID is required' })
    }

    // Get store details
    const storeResult = await query('SELECT * FROM stores WHERE id = $1 AND is_active = true', [storeId])
    
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' })
    }

    const store = storeResult.rows[0]

    // Get a few sample products to test sync
    const productsResult = await query('SELECT * FROM products WHERE is_active = true LIMIT 5')
    const products = productsResult.rows

    if (products.length === 0) {
      return res.status(400).json({ message: 'No products found to sync' })
    }

    let syncResults = []
    let successCount = 0
    let errorCount = 0

    console.log(`🔄 Testing sync to ${store.store_name} (${store.store_domain})`)

    // Test sync for each sample product
    for (const product of products) {
      try {
        // Test Shopify API connection by getting shop info
        const shopResponse = await fetch(`https://${store.store_domain}/admin/api/2023-10/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': store.access_token,
            'Content-Type': 'application/json'
          }
        })

        if (shopResponse.ok) {
          const shopData = await shopResponse.json()
          
          // Simulate successful sync (in real implementation, you would create/update products)
          syncResults.push({
            product_sku: product.sku,
            product_name: product.product_name,
            quantity: product.quantity,
            status: 'success',
            message: `✅ Ready to sync to ${shopData.shop?.name || store.store_name}`,
            shop_name: shopData.shop?.name,
            shop_domain: shopData.shop?.domain
          })

          // Create test sync audit log
          await query(`
            INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
          `, [
            product.id,
            product.product_name,
            product.sku,
            'sync_test',
            product.quantity,
            product.quantity,
            product.quantity,
            `Sync test to ${store.store_name}: Connection successful`,
            user.id,
            user.username
          ])

          successCount++
        } else {
          const errorText = await shopResponse.text()
          syncResults.push({
            product_sku: product.sku,
            product_name: product.product_name,
            status: 'error',
            message: `❌ API Error: ${shopResponse.status} ${shopResponse.statusText}`,
            error_details: errorText
          })
          errorCount++
        }
      } catch (error) {
        syncResults.push({
          product_sku: product.sku,
          product_name: product.product_name,
          status: 'error',
          message: `❌ Connection Error: ${error.message}`
        })
        errorCount++
      }
    }

    // Update store connection status
    const connectionSuccessful = successCount > 0
    await query('UPDATE stores SET connected = $1 WHERE id = $2', [connectionSuccessful, storeId])
    
    res.status(200).json({ 
      success: true, 
      message: `Sync test completed: ${successCount} successful, ${errorCount} failed`,
      store: {
        id: store.id,
        name: store.store_name,
        domain: store.store_domain,
        connected: connectionSuccessful
      },
      results: syncResults,
      summary: {
        total_products_tested: products.length,
        successful: successCount,
        failed: errorCount,
        connection_status: connectionSuccessful ? 'Connected' : 'Failed'
      }
    })
  } catch (error) {
    console.error('Sync test error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to test sync: ' + error.message })
  }
}
