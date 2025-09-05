import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

// Function to update inventory in Shopify store
const updateShopifyInventory = async (store, product) => {
  try {
    // First, search for the product by SKU in Shopify
    const searchUrl = `https://${store.store_domain}/admin/api/2023-10/products.json?fields=id,variants&limit=250`
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    })

    if (!searchResponse.ok) {
      throw new Error(`Shopify API error: ${searchResponse.status} ${searchResponse.statusText}`)
    }

    const searchData = await searchResponse.json()
    let targetVariant = null
    let targetProduct = null

    // Find the product variant with matching SKU
    for (const shopifyProduct of searchData.products) {
      for (const variant of shopifyProduct.variants) {
        if (variant.sku === product.sku) {
          targetVariant = variant
          targetProduct = shopifyProduct
          break
        }
      }
      if (targetVariant) break
    }

    if (!targetVariant) {
      throw new Error(`Product with SKU "${product.sku}" not found in Shopify store`)
    }

    // Get current inventory levels
    const inventoryUrl = `https://${store.store_domain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${targetVariant.inventory_item_id}`
    
    const inventoryResponse = await fetch(inventoryUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    })

    if (!inventoryResponse.ok) {
      throw new Error(`Failed to get inventory levels: ${inventoryResponse.status}`)
    }

    const inventoryData = await inventoryResponse.json()
    const currentLevel = inventoryData.inventory_levels[0]
    const previousQuantity = currentLevel ? currentLevel.available : 0

    // Update inventory level
    const updateUrl = `https://${store.store_domain}/admin/api/2023-10/inventory_levels/set.json`
    
    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location_id: currentLevel.location_id,
        inventory_item_id: targetVariant.inventory_item_id,
        available: product.quantity
      })
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json()
      throw new Error(`Failed to update inventory: ${errorData.errors || updateResponse.statusText}`)
    }

    const updateData = await updateResponse.json()

    return {
      success: true,
      previousQuantity: previousQuantity,
      newQuantity: product.quantity,
      shopifyProductId: targetProduct.id,
      shopifyVariantId: targetVariant.id,
      inventoryItemId: targetVariant.inventory_item_id
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

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

    // Sync to each connected store via Shopify API
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
          
          successCount++
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
        
        errorCount++
      }
      
      const syncDuration = Date.now() - startTime
      
      syncResults.push({
        store: store.store_name || store.name,
        status: syncStatus,
        message: syncMessage,
        error: errorMessage,
        duration_ms: syncDuration
      })
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
