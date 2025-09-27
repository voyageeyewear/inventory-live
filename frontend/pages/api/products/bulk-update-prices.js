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
    const user = await authenticateToken(req)
    
    const { defaultPrice = 1999 } = req.body

    // Update all products with price 0 to the default price
    const result = await query(`
      UPDATE products 
      SET price = $1, updated_at = CURRENT_TIMESTAMP
      WHERE (price = 0 OR price IS NULL) AND is_active = true
      RETURNING id, sku, product_name
    `, [defaultPrice])

    const updatedCount = result.rows.length

    // Create audit log for bulk update
    if (updatedCount > 0) {
      await query(`
        INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name, created_at)
        VALUES (NULL, 'Bulk Price Update', 'BULK_UPDATE', 'price_update', 0, 0, 0, $1, $2, $3, CURRENT_TIMESTAMP)
      `, [
        `Bulk updated ${updatedCount} products to ₹${defaultPrice}`,
        user.id,
        user.username
      ])
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Successfully updated ${updatedCount} products to ₹${defaultPrice}`,
      updatedCount,
      defaultPrice,
      updatedProducts: result.rows.slice(0, 10) // Show first 10 for reference
    })
  } catch (error) {
    console.error('Bulk price update error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to update prices: ' + error.message })
  }
}
