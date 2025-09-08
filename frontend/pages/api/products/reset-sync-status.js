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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)

    // Reset all products to needs_sync = false and set last_synced to current time
    const resetResult = await query(`
      UPDATE products 
      SET needs_sync = false, 
          last_synced = CURRENT_TIMESTAMP,
          last_modified = COALESCE(last_modified, updated_at, created_at)
      WHERE is_active = true
    `)

    // Get count of products that were reset
    const countResult = await query(`
      SELECT COUNT(*) as total_count
      FROM products 
      WHERE is_active = true AND needs_sync = false
    `)

    res.status(200).json({
      success: true,
      message: `Reset sync status for all products. They are now marked as up-to-date.`,
      reset_count: resetResult.rowCount,
      total_up_to_date: parseInt(countResult.rows[0].total_count),
      note: "Now only products that are actually modified will be marked for sync"
    })
  } catch (error) {
    console.error('Reset sync status error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to reset sync status: ' + error.message 
    })
  }
}
