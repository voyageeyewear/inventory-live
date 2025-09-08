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
    await authenticateToken(req)

    // Get detailed sync status of all products
    const result = await query(`
      SELECT 
        id,
        sku,
        product_name,
        quantity,
        needs_sync,
        last_modified,
        last_synced,
        updated_at,
        CASE 
          WHEN needs_sync IS NULL THEN 'NULL (needs sync)'
          WHEN needs_sync = true THEN 'TRUE (needs sync)'
          WHEN needs_sync = false THEN 'FALSE (up to date)'
        END as sync_status_display,
        CASE 
          WHEN last_synced IS NULL THEN 'Never synced'
          WHEN last_modified > last_synced THEN 'Modified since last sync'
          WHEN last_modified IS NULL AND last_synced IS NOT NULL THEN 'Synced but no modification date'
          ELSE 'Up to date'
        END as detailed_status
      FROM products 
      WHERE is_active = true 
      ORDER BY 
        CASE WHEN COALESCE(needs_sync, true) = true THEN 0 ELSE 1 END,
        last_modified DESC NULLS LAST
      LIMIT 20
    `)

    // Get summary counts
    const summaryResult = await query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN COALESCE(needs_sync, true) = true THEN 1 END) as needs_sync_count,
        COUNT(CASE WHEN needs_sync = false THEN 1 END) as up_to_date_count,
        COUNT(CASE WHEN needs_sync IS NULL THEN 1 END) as null_needs_sync_count,
        COUNT(CASE WHEN last_synced IS NULL THEN 1 END) as never_synced_count,
        COUNT(CASE WHEN last_modified IS NULL THEN 1 END) as no_modification_date_count
      FROM products 
      WHERE is_active = true
    `)

    res.status(200).json({
      success: true,
      summary: summaryResult.rows[0],
      sample_products: result.rows,
      debug_info: {
        query_used: "SELECT products WHERE is_active = true AND COALESCE(needs_sync, true) = true",
        explanation: "Products with needs_sync = true OR needs_sync IS NULL should appear in sync list"
      }
    })
  } catch (error) {
    console.error('Debug sync status error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to get debug sync status: ' + error.message 
    })
  }
}
