import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  const { method } = req
  const { sku } = req.query

  if (method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!sku) {
    return res.status(400).json({ message: 'SKU parameter is required' })
  }

  try {
    // Check if product exists with any is_active status
    const result = await query(
      'SELECT id, sku, product_name, category, price, quantity, is_active, created_at FROM products WHERE sku = $1',
      [sku]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Product not found',
        sku: sku,
        searched_in_database: true
      })
    }

    const product = result.rows[0]
    
    // Also check how many products have is_active = true vs false vs null
    const activeCount = await query('SELECT COUNT(*) FROM products WHERE is_active = true')
    const inactiveCount = await query('SELECT COUNT(*) FROM products WHERE is_active = false')
    const nullCount = await query('SELECT COUNT(*) FROM products WHERE is_active IS NULL')

    res.status(200).json({
      product: product,
      debug_info: {
        total_active_products: activeCount.rows[0].count,
        total_inactive_products: inactiveCount.rows[0].count,
        total_null_active_products: nullCount.rows[0].count,
        product_is_active_status: product.is_active,
        reason_not_showing: product.is_active !== true ? 'is_active is not true' : 'should be showing'
      }
    })
  } catch (error) {
    console.error('Debug SKU error:', error)
    res.status(500).json({ message: 'Failed to debug SKU', error: error.message })
  }
}
