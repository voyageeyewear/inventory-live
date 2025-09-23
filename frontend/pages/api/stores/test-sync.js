import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { storeId } = req.body

  if (!storeId) {
    return res.status(400).json({
      success: false,
      message: 'Store ID is required'
    })
  }

  try {
    // Get store details
    const storeResult = await query(
      'SELECT id, store_name, shopify_domain, access_token, connected FROM stores WHERE id = $1',
      [storeId]
    )

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      })
    }

    const store = storeResult.rows[0]

    if (!store.connected) {
      return res.status(400).json({
        success: false,
        message: 'Store is not connected. Please test connection first.'
      })
    }

    // Get a few sample products to test sync
    const productsResult = await query(`
      SELECT id, sku, product_name, quantity 
      FROM products 
      WHERE is_active = true 
      ORDER BY updated_at DESC 
      LIMIT 5
    `)

    const products = productsResult.rows

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No products found to test sync'
      })
    }

    const results = []
    let successCount = 0
    let errorCount = 0

    // Test sync for each product
    for (const product of products) {
      try {
        // Try to find the product in Shopify by SKU
        const shopifyResponse = await fetch(`https://${store.shopify_domain}/admin/api/2023-10/products.json?limit=250`, {
          headers: {
            'X-Shopify-Access-Token': store.access_token,
            'Content-Type': 'application/json'
          }
        })

        if (!shopifyResponse.ok) {
          throw new Error(`Shopify API error: ${shopifyResponse.status}`)
        }

        const shopifyData = await shopifyResponse.json()
        const shopifyProducts = shopifyData.products || []

        // Search for the SKU
        let found = false
        for (const shopifyProduct of shopifyProducts) {
          for (const variant of shopifyProduct.variants) {
            if (variant.sku === product.sku) {
              found = true
              successCount++
              results.push({
                sku: product.sku,
                product_name: product.product_name,
                local_quantity: product.quantity,
                shopify_quantity: variant.inventory_quantity || 0,
                status: 'found',
                shopify_product_id: shopifyProduct.id,
                shopify_variant_id: variant.id
              })
              break
            }
          }
          if (found) break
        }

        if (!found) {
          errorCount++
          results.push({
            sku: product.sku,
            product_name: product.product_name,
            local_quantity: product.quantity,
            shopify_quantity: 0,
            status: 'not_found',
            message: 'Product not found in Shopify'
          })
        }
      } catch (error) {
        errorCount++
        results.push({
          sku: product.sku,
          product_name: product.product_name,
          local_quantity: product.quantity,
          shopify_quantity: 0,
          status: 'error',
          message: error.message
        })
      }
    }

    res.status(200).json({
      success: true,
      message: 'Sync test completed',
      summary: {
        total_products_tested: products.length,
        successful: successCount,
        failed: errorCount,
        store_name: store.store_name
      },
      results
    })
  } catch (error) {
    console.error('Error testing sync:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to test sync',
      error: error.message
    })
  }
}