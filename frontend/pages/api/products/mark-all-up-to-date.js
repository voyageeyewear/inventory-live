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
    console.log('Mark all up-to-date API called')
    
    // Authenticate user
    const user = await authenticateToken(req)
    console.log('User authenticated:', user.username)

    // First, get count of products to be updated
    const countResult = await query(`
      SELECT COUNT(*) as total_count FROM products WHERE is_active = true
    `)
    const totalProducts = parseInt(countResult.rows[0].total_count)

    console.log(`Found ${totalProducts} active products to mark as up-to-date`)

    // Mark all active products as up-to-date (synced)
    // Use a safer approach that handles missing columns gracefully
    let result
    try {
      result = await query(`
        UPDATE products 
        SET last_synced = CURRENT_TIMESTAMP, needs_sync = false, updated_at = CURRENT_TIMESTAMP
        WHERE is_active = true
      `)
    } catch (updateError) {
      console.log('Standard update failed, trying without needs_sync column:', updateError.message)
      // Fallback: try without needs_sync column in case it doesn't exist
      result = await query(`
        UPDATE products 
        SET last_synced = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE is_active = true
      `)
    }

    const updatedCount = result.rowCount || 0
    console.log(`Updated ${updatedCount} products`)

    // Create audit log for bulk operation
    await query(`
      INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name, created_at)
      VALUES (NULL, 'BULK OPERATION', 'ALL', 'bulk_sync_update', 0, 0, 0, $1, $2, $3, CURRENT_TIMESTAMP)
    `, [
      `Bulk operation: Marked ${updatedCount} products as up-to-date for sync`,
      user.id,
      user.username
    ])

    console.log('Audit log created successfully')

    res.status(200).json({
      success: true,
      message: `Successfully marked ${updatedCount} products as up-to-date for sync`,
      updatedCount,
      totalProducts,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Mark all up-to-date error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      })
    }
    
    // Handle database errors
    if (error.code) {
      console.error('Database error code:', error.code)
      return res.status(500).json({ 
        success: false,
        message: 'Database error occurred while marking products as up-to-date',
        error: error.message,
        code: error.code
      })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark products as up-to-date: ' + error.message,
      error: error.message
    })
  }
}
