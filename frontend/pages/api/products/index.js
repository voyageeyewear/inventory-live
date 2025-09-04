import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  const { method } = req

  try {
    switch (method) {
      case 'GET':
        try {
          const { search } = req.query
          let queryText = 'SELECT * FROM products WHERE is_active = true'
          let queryParams = []

          if (search) {
            queryText += ' AND (sku ILIKE $1 OR product_name ILIKE $1 OR category ILIKE $1)'
            queryParams = [`%${search}%`]
          }

          queryText += ' ORDER BY created_at DESC'

          const result = await query(queryText, queryParams)
          res.status(200).json(result.rows)
        } catch (error) {
          console.error('Get products error:', error)
          res.status(500).json({ message: 'Failed to fetch products' })
        }
        break

      case 'POST':
        try {
          const { sku, product_name, category, price, quantity, description, image_url } = req.body
          
          if (!sku || !product_name) {
            return res.status(400).json({ message: 'SKU and product name are required' })
          }

          // Check if product with SKU already exists
          const existingProduct = await query('SELECT id FROM products WHERE sku = $1', [sku])
          if (existingProduct.rows.length > 0) {
            return res.status(400).json({ message: 'Product with this SKU already exists' })
          }

          const result = await query(`
            INSERT INTO products (sku, product_name, category, price, quantity, description, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [sku, product_name, category || '', price || 0, quantity || 0, description || '', image_url || ''])

          res.status(201).json(result.rows[0])
        } catch (error) {
          console.error('Create product error:', error)
          res.status(500).json({ message: 'Failed to create product' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Products API error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}