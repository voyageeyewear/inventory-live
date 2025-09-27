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
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    await authenticateToken(req)

    // Get products table schema
    const schemaResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `)

    // Check if needs_sync column exists and get sample data
    const sampleResult = await query(`
      SELECT 
        id, sku, product_name, quantity,
        needs_sync, last_modified, last_synced, updated_at,
        CASE 
          WHEN needs_sync IS NULL THEN 'NULL'
          WHEN needs_sync = true THEN 'TRUE'
          WHEN needs_sync = false THEN 'FALSE'
          ELSE 'OTHER: ' || needs_sync::text
        END as needs_sync_display
      FROM products 
      WHERE is_active = true 
      ORDER BY id
      LIMIT 10
    `)

    // Get counts by sync status
    const countsResult = await query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN needs_sync = true THEN 1 END) as needs_sync_true,
        COUNT(CASE WHEN needs_sync = false THEN 1 END) as needs_sync_false,
        COUNT(CASE WHEN needs_sync IS NULL THEN 1 END) as needs_sync_null
      FROM products 
      WHERE is_active = true
    `)

    res.status(200).json({
      success: true,
      table_schema: schemaResult.rows,
      sample_products: sampleResult.rows,
      sync_counts: countsResult.rows[0],
      has_needs_sync_column: schemaResult.rows.some(col => col.column_name === 'needs_sync'),
      has_last_modified_column: schemaResult.rows.some(col => col.column_name === 'last_modified'),
      has_last_synced_column: schemaResult.rows.some(col => col.column_name === 'last_synced')
    })
  } catch (error) {
    console.error('Database schema debug error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to get database schema: ' + error.message 
    })
  }
}
