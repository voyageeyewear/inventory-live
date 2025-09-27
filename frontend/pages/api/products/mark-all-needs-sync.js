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

    // Mark all products as needing sync (for testing purposes)
    const result = await query(`
      UPDATE products 
      SET needs_sync = true, last_modified = CURRENT_TIMESTAMP
      WHERE is_active = true
      AND (needs_sync IS NULL OR needs_sync = false)
    `)

    res.status(200).json({
      success: true,
      message: `Marked ${result.rowCount} products as needing sync`,
      updated_count: result.rowCount
    })
  } catch (error) {
    console.error('Mark needs sync error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark products as needing sync: ' + error.message 
    })
  }
}
