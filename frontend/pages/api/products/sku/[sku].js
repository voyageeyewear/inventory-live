import { query } from '../../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { sku } = req.query

  try {
    const result = await query(
      'SELECT * FROM products WHERE LOWER(sku) = LOWER($1) AND is_active = true',
      [sku]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    res.status(200).json(result.rows[0])
  } catch (error) {
    console.error('Get product by SKU error:', error)
    res.status(500).json({ message: 'Failed to fetch product' })
  }
}