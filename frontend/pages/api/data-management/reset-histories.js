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
    // Authenticate user (admin only)
    const user = await authenticateToken(req)
    
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { type } = req.body
    
    let deletedCount = 0
    let message = ''

    switch (type) {
      case 'audit_history':
        // Reset audit/stock logs
        const auditResult = await query('DELETE FROM stock_logs')
        deletedCount = auditResult.rowCount
        message = `Deleted ${deletedCount} audit/stock log entries`
        break

      case 'sync_history':
        // Reset sync-related logs
        const syncResult = await query(`DELETE FROM stock_logs WHERE type = 'sync'`)
        deletedCount = syncResult.rowCount
        message = `Deleted ${deletedCount} sync history entries`
        break

      case 'scan_history':
        // Reset scan logs
        const scanResult = await query('DELETE FROM scan_logs')
        deletedCount = scanResult.rowCount
        message = `Deleted ${deletedCount} scan history entries`
        break

      case 'mobile_activities':
        // Reset mobile activities and transactions
        const mobileActivitiesResult = await query('DELETE FROM mobile_activities')
        const mobileTransactionsResult = await query('DELETE FROM mobile_transactions')
        deletedCount = mobileActivitiesResult.rowCount + mobileTransactionsResult.rowCount
        message = `Deleted ${deletedCount} mobile activity and transaction entries`
        break

      case 'today_sync':
        // Reset today's sync data
        const today = new Date()
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        
        const todayResult = await query(`
          DELETE FROM stock_logs 
          WHERE type = 'sync' 
          AND created_at >= $1 
          AND created_at < $2
        `, [todayStart.toISOString(), todayEnd.toISOString()])
        
        deletedCount = todayResult.rowCount
        message = `Deleted ${deletedCount} today's sync entries`
        break

      case 'all_histories':
        // Reset all history data
        const results = await Promise.all([
          query('DELETE FROM stock_logs'),
          query('DELETE FROM scan_logs'),
          query('DELETE FROM mobile_activities'),
          query('DELETE FROM mobile_transactions')
        ])
        
        deletedCount = results.reduce((sum, result) => sum + result.rowCount, 0)
        message = `Deleted ${deletedCount} total history entries (all types)`
        break

      case 'sync_status':
        // Reset product sync status
        const statusResult = await query(`
          UPDATE products 
          SET needs_sync = false, 
              last_synced = CURRENT_TIMESTAMP,
              last_modified = COALESCE(last_modified, updated_at, created_at)
          WHERE is_active = true
        `)
        
        deletedCount = statusResult.rowCount
        message = `Reset sync status for ${deletedCount} products`
        break

      case 'all_products':
        // Delete ALL products (DANGEROUS!)
        // Need to remove dependent rows first to avoid FK violations
        try {
          await query('BEGIN')
          // Remove rows that reference products by foreign keys first
          // Use CASCADE on constraints where possible; else delete all rows
          await query('TRUNCATE stock_logs RESTART IDENTITY CASCADE')
          await query('TRUNCATE mobile_transactions RESTART IDENTITY CASCADE')
          // Some tables may store SKU instead of FK; clear them as well to keep DB consistent
          await query('TRUNCATE scan_logs RESTART IDENTITY CASCADE')
          const productsResult = await query('DELETE FROM products')
          await query('COMMIT')
          deletedCount = productsResult.rowCount
          message = `DELETED ${deletedCount} products and cleared related histories.`
        } catch (e) {
          await query('ROLLBACK')
          throw new Error('Failed while deleting products: ' + e.message)
        }
        break

      default:
        return res.status(400).json({ message: 'Invalid reset type' })
    }

    res.status(200).json({
      success: true,
      message: message,
      deleted_count: deletedCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Reset histories error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    if (error.message === 'Admin access required') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to reset histories: ' + error.message 
    })
  }
}
