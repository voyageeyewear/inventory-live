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
  const { method } = req
  const { id } = req.query

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Authenticate user for PUT and DELETE operations
    if (method === 'PUT' || method === 'DELETE') {
      await authenticateToken(req)
    }
    
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
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Internal server error: ' + error.message })
  }
}