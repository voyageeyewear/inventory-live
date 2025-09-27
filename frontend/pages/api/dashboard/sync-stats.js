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

    // Get today's date range
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    // Get today's sync operations from stock_logs
    const syncStatsResult = await query(`
      SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN notes NOT LIKE '%FAILED%' AND notes NOT LIKE '%ERROR%' THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN notes LIKE '%FAILED%' OR notes LIKE '%ERROR%' THEN 1 END) as failed_syncs
      FROM stock_logs 
      WHERE type = 'sync' 
      AND created_at >= $1 
      AND created_at < $2
    `, [todayStart.toISOString(), todayEnd.toISOString()])

    // Get today's stock changes
    const stockChangesResult = await query(`
      SELECT 
        COUNT(*) as total_changes,
        COUNT(CASE WHEN type = 'stock_in' THEN 1 END) as stock_in_count,
        COUNT(CASE WHEN type = 'stock_out' THEN 1 END) as stock_out_count
      FROM stock_logs 
      WHERE type IN ('stock_in', 'stock_out')
      AND created_at >= $1 
      AND created_at < $2
    `, [todayStart.toISOString(), todayEnd.toISOString()])

    // Get recent sync activity for debugging
    const recentSyncsResult = await query(`
      SELECT 
        id, product_name, sku, type, quantity, notes, user_name, created_at
      FROM stock_logs 
      WHERE type = 'sync'
      ORDER BY created_at DESC
      LIMIT 10
    `)

    const syncStats = syncStatsResult.rows[0]
    const stockStats = stockChangesResult.rows[0]

    res.status(200).json({
      success: true,
      today: {
        total_syncs: parseInt(syncStats.total_syncs),
        successful_syncs: parseInt(syncStats.successful_syncs),
        failed_syncs: parseInt(syncStats.failed_syncs),
        stock_changes: parseInt(stockStats.total_changes),
        stock_in: parseInt(stockStats.stock_in_count),
        stock_out: parseInt(stockStats.stock_out_count)
      },
      recent_syncs: recentSyncsResult.rows,
      debug_info: {
        today_start: todayStart.toISOString(),
        today_end: todayEnd.toISOString(),
        current_time: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Sync stats error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to get sync stats: ' + error.message 
    })
  }
}
