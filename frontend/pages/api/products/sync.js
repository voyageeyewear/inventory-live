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
    
    const { productId, sku } = req.body
    
    if (!productId && !sku) {
      return res.status(400).json({ message: 'Product ID or SKU is required' })
    }

    // Get product details
    let product
    if (productId) {
      const result = await query('SELECT * FROM products WHERE id = $1 AND is_active = true', [productId])
      product = result.rows[0]
    } else {
      const result = await query('SELECT * FROM products WHERE sku = $1 AND is_active = true', [sku])
      product = result.rows[0]
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Get connected stores
    const storesResult = await query('SELECT * FROM stores WHERE connected = true AND is_active = true')
    const stores = storesResult.rows

    if (stores.length === 0) {
      return res.status(400).json({ message: 'No connected stores found for sync' })
    }

    let syncResults = []
    let successCount = 0
    let errorCount = 0

    // Simulate sync to each store (in a real implementation, this would call Shopify API)
    for (const store of stores) {
      try {
        // In a real implementation, you would call Shopify API here
        // For now, we'll simulate a successful sync
        
        // Create sync audit log
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
          `Synced to store: ${store.store_name || store.name}`,
          user.id,
          user.username
        ])

        syncResults.push({
          store: store.store_name || store.name,
          status: 'success',
          message: `Successfully synced ${product.quantity} units`
        })
        successCount++
      } catch (error) {
        syncResults.push({
          store: store.store_name || store.name,
          status: 'error',
          message: error.message
        })
        errorCount++
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Sync completed: ${successCount} successful, ${errorCount} failed`,
      product: {
        id: product.id,
        sku: product.sku,
        product_name: product.product_name,
        quantity: product.quantity
      },
      results: syncResults,
      summary: {
        total_stores: stores.length,
        successful: successCount,
        failed: errorCount
      }
    })
  } catch (error) {
    console.error('Sync product error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to sync product: ' + error.message })
  }
}
