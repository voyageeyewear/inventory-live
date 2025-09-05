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
    await authenticateToken(req)
    
    const { id, sku, product_name, category, price, quantity, description, image_url } = req.body
    
    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' })
    }

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
    
    res.status(200).json({ 
      success: true, 
      message: 'Product updated successfully',
      product: result.rows[0] 
    })
  } catch (error) {
    console.error('Edit product error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to update product: ' + error.message })
  }
}
