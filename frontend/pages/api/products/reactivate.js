import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  const { method } = req
  const { sku } = req.body

  if (method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!sku) {
    return res.status(400).json({ message: 'SKU is required' })
  }

  try {
    // Update the product to set is_active = true
    const result = await query(
      'UPDATE products SET is_active = true WHERE sku = $1 RETURNING *',
      [sku]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Product not found',
        sku: sku
      })
    }

    const product = result.rows[0]
    
    res.status(200).json({
      message: 'Product reactivated successfully',
      product: product,
      sku: sku,
      is_active: product.is_active
    })
  } catch (error) {
    console.error('Reactivate product error:', error)
    res.status(500).json({ message: 'Failed to reactivate product', error: error.message })
  }
}
