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
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)

    // Get products that need syncing
    const result = await query(`
      SELECT 
        *,
        COALESCE(needs_sync, true) as needs_sync,
        last_modified,
        last_synced,
        CASE 
          WHEN last_synced IS NULL THEN 'Never synced'
          WHEN last_modified > last_synced THEN 'Modified since last sync'
          ELSE 'Up to date'
        END as sync_status
      FROM products 
      WHERE is_active = true 
      AND COALESCE(needs_sync, true) = true
      ORDER BY last_modified DESC
    `)

    const productsNeedingSync = result.rows

    // Also get summary statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN COALESCE(needs_sync, true) = true THEN 1 END) as needs_sync_count,
        COUNT(CASE WHEN last_synced IS NULL THEN 1 END) as never_synced_count,
        COUNT(CASE WHEN last_modified > last_synced THEN 1 END) as modified_since_sync_count
      FROM products 
      WHERE is_active = true
    `)

    const stats = statsResult.rows[0]

    res.status(200).json({
      success: true,
      products: productsNeedingSync,
      stats: {
        total_products: parseInt(stats.total_products),
        needs_sync_count: parseInt(stats.needs_sync_count),
        never_synced_count: parseInt(stats.never_synced_count),
        modified_since_sync_count: parseInt(stats.modified_since_sync_count),
        up_to_date_count: parseInt(stats.total_products) - parseInt(stats.needs_sync_count)
      }
    })
  } catch (error) {
    console.error('Get products needing sync error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch products needing sync: ' + error.message 
    })
  }
}