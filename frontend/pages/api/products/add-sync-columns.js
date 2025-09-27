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
    await authenticateToken(req)

    const operations = []

    // Add needs_sync column if it doesn't exist
    try {
      await query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS needs_sync BOOLEAN DEFAULT true
      `)
      operations.push('Added needs_sync column')
    } catch (error) {
      operations.push(`needs_sync column: ${error.message}`)
    }

    // Add last_modified column if it doesn't exist
    try {
      await query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `)
      operations.push('Added last_modified column')
    } catch (error) {
      operations.push(`last_modified column: ${error.message}`)
    }

    // Add last_synced column if it doesn't exist
    try {
      await query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP
      `)
      operations.push('Added last_synced column')
    } catch (error) {
      operations.push(`last_synced column: ${error.message}`)
    }

    // Initialize last_modified for existing products
    try {
      const updateResult = await query(`
        UPDATE products 
        SET last_modified = COALESCE(last_modified, updated_at, created_at, CURRENT_TIMESTAMP)
        WHERE last_modified IS NULL
      `)
      operations.push(`Initialized last_modified for ${updateResult.rowCount} products`)
    } catch (error) {
      operations.push(`Initialize last_modified: ${error.message}`)
    }

    // Set all products to needs_sync = false initially (they're all "up to date")
    try {
      const resetResult = await query(`
        UPDATE products 
        SET needs_sync = false, last_synced = CURRENT_TIMESTAMP
        WHERE needs_sync IS NULL OR needs_sync = true
      `)
      operations.push(`Reset ${resetResult.rowCount} products to up-to-date status`)
    } catch (error) {
      operations.push(`Reset sync status: ${error.message}`)
    }

    res.status(200).json({
      success: true,
      message: 'Database schema updated for sync tracking',
      operations: operations
    })
  } catch (error) {
    console.error('Add sync columns error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to add sync columns: ' + error.message 
    })
  }
}
