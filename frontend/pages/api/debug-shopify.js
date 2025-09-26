import { query } from '../../lib/postgres'
import { shopifyFetch } from './services/shopify-service'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { sku } = req.query

  if (!sku) {
    return res.status(400).json({ message: 'SKU parameter is required' })
  }

  try {
    console.log(`🔍 Debug: Searching for SKU ${sku}`)

    // Get connected stores
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

    const store = stores[0]
    console.log(`🔍 Using store: ${store.store_name}`)

    // Test connection first
    try {
      const testUrl = `https://${store.store_domain}/admin/api/2023-10/shop.json`
      const testResponse = await shopifyFetch(testUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json'
        }
      }, 'debug-test')

      const testData = await testResponse.json()
      console.log(`✅ Connection test successful:`, testData.shop?.name)
    } catch (testError) {
      console.error(`❌ Connection test failed:`, testError.message)
      return res.status(500).json({
        success: false,
        message: `Connection test failed: ${testError.message}`
      })
    }

    // Search for products
    const searchUrl = `https://${store.store_domain}/admin/api/2023-10/products.json?limit=250`
    console.log(`🔍 Searching products: ${searchUrl}`)

    const response = await shopifyFetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    }, 'debug-search')

    const data = await response.json()
    console.log(`📦 Found ${data.products?.length || 0} products`)

    // Look for SKU matches
    const matchingProducts = data.products?.filter(product => 
      product.variants.some(variant => 
        variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
      )
    ) || []

    console.log(`🎯 Found ${matchingProducts.length} products with SKU ${sku}`)

    const result = {
      success: true,
      sku: sku,
      totalProducts: data.products?.length || 0,
      matchingProducts: matchingProducts.length,
      products: matchingProducts.map(p => ({
        id: p.id,
        title: p.title,
        variants: p.variants.map(v => ({
          id: v.id,
          sku: v.sku,
          title: v.title,
          inventory_item_id: v.inventory_item_id
        }))
      }))
    }

    console.log(`📋 Debug result:`, result)
    res.status(200).json(result)

  } catch (error) {
    console.error('🔥 Debug error:', error)
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message
    })
  }
}
