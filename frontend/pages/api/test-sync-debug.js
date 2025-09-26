import { query } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { sku = '891PMG4465' } = req.query

  try {
    console.log(`🔍 Testing sync debug for SKU: ${sku}`)

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

    // Test the exact same logic as syncAllVariantsForSKU
    const searchUrl = `https://${store.store_domain}/admin/api/2023-10/products.json?limit=250`
    console.log(`🔍 Searching products: ${searchUrl}`)

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log(`📦 Found ${data.products?.length || 0} products`)

    // Show first few products and their variants
    const sampleProducts = data.products?.slice(0, 3) || []
    console.log(`📋 Sample products:`, sampleProducts.map(p => ({
      id: p.id,
      title: p.title,
      variants: p.variants.map(v => ({
        id: v.id,
        sku: v.sku,
        title: v.title
      }))
    })))

    // Look for SKU matches with the same logic
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
      sampleVariants: sampleProducts.flatMap(p => p.variants.map(v => ({
        productId: p.id,
        productTitle: p.title,
        variantId: v.id,
        sku: v.sku,
        title: v.title
      }))),
      matchingProductDetails: matchingProducts.map(p => ({
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

    console.log(`📋 Test result:`, result)
    res.status(200).json(result)

  } catch (error) {
    console.error('🔥 Test error:', error)
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    })
  }
}
