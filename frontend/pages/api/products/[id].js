import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  const { method } = req
  const { id } = req.query

  try {
    switch (method) {
      case 'GET':
        try {
          const result = await query('SELECT * FROM products WHERE id = $1 AND is_active = true', [id])
          
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' })
          }
          
          res.status(200).json(result.rows[0])
        } catch (error) {
          console.error('Get product error:', error)
          res.status(500).json({ message: 'Failed to fetch product' })
        }
        break

      case 'PUT':
        try {
          const { sku, product_name, category, price, quantity, description, image_url } = req.body
          
          const result = await query(`
            UPDATE products 
            SET sku = $1, product_name = $2, category = $3, price = $4, quantity = $5, 
                description = $6, image_url = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND is_active = true
            RETURNING *
          `, [sku, product_name, category, price, quantity, description, image_url, id])
          
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' })
          }
          
          res.status(200).json(result.rows[0])
        } catch (error) {
          console.error('Update product error:', error)
          res.status(500).json({ message: 'Failed to update product' })
        }
        break

      case 'DELETE':
        try {
          const result = await query(
            'UPDATE products SET is_active = false WHERE id = $1 RETURNING id',
            [id]
          )
          
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' })
          }
          
          res.status(200).json({ message: 'Product deleted successfully' })
        } catch (error) {
          console.error('Delete product error:', error)
          res.status(500).json({ message: 'Failed to delete product' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Product API error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}