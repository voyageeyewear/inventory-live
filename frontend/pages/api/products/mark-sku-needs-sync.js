import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-2024-secure-key')
    
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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { sku } = req.body
    
    if (!sku) {
      return res.status(400).json({ message: 'SKU is required' })
    }

    // Mark specific SKU as needing sync
    const result = await query(`
      UPDATE products 
      SET needs_sync = true, 
          last_modified = CURRENT_TIMESTAMP
      WHERE sku = $1 AND is_active = true
    `, [sku])

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Product with SKU "${sku}" not found` })
    }

    // Get the updated product info
    const productResult = await query(`
      SELECT id, sku, product_name, quantity, needs_sync, last_modified
      FROM products 
      WHERE sku = $1 AND is_active = true
    `, [sku])

    res.status(200).json({
      success: true,
      message: `Marked SKU "${sku}" as needing sync`,
      product: productResult.rows[0]
    })
  } catch (error) {
    console.error('Mark SKU needs sync error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark SKU as needing sync: ' + error.message 
    })
  }
}
