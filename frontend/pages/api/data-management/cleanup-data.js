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
    // Authenticate user (admin only)
    const user = await authenticateToken(req)
    
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { type, days = 30 } = req.body
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    let deletedCount = 0
    let message = ''

    switch (type) {
      case 'old_logs':
        // Delete old stock logs
        const logsResult = await query(`
          DELETE FROM stock_logs 
          WHERE created_at < $1
        `, [cutoffDate.toISOString()])
        
        deletedCount = logsResult.rowCount
        message = `Deleted ${deletedCount} stock logs older than ${days} days`
        break

      case 'old_scans':
        // Delete old scan logs
        const scansResult = await query(`
          DELETE FROM scan_logs 
          WHERE created_at < $1
        `, [cutoffDate.toISOString()])
        
        deletedCount = scansResult.rowCount
        message = `Deleted ${deletedCount} scan logs older than ${days} days`
        break

      case 'old_mobile_activities':
        // Delete old mobile activities and transactions
        const mobileActivitiesResult = await query(`
          DELETE FROM mobile_activities 
          WHERE created_at < $1
        `, [cutoffDate.toISOString()])
        
        const mobileTransactionsResult = await query(`
          DELETE FROM mobile_transactions 
          WHERE created_at < $1
        `, [cutoffDate.toISOString()])
        
        deletedCount = mobileActivitiesResult.rowCount + mobileTransactionsResult.rowCount
        message = `Deleted ${deletedCount} mobile activities and transactions older than ${days} days`
        break

      case 'inactive_products':
        // Delete inactive products (soft delete - set is_active = false)
        const inactiveResult = await query(`
          UPDATE products 
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE is_active = true 
          AND quantity = 0 
          AND updated_at < $1
        `, [cutoffDate.toISOString()])
        
        deletedCount = inactiveResult.rowCount
        message = `Marked ${deletedCount} zero-quantity products as inactive (older than ${days} days)`
        break

      case 'optimize_database':
        // Run database optimization queries
        await query('VACUUM ANALYZE products')
        await query('VACUUM ANALYZE stock_logs')
        await query('VACUUM ANALYZE scan_logs')
        await query('VACUUM ANALYZE mobile_activities')
        await query('VACUUM ANALYZE mobile_transactions')
        
        message = 'Database optimization completed successfully'
        break

      default:
        return res.status(400).json({ message: 'Invalid cleanup type' })
    }

    res.status(200).json({
      success: true,
      message: message,
      deleted_count: deletedCount,
      cutoff_date: cutoffDate.toISOString(),
      days: days
    })
  } catch (error) {
    console.error('Cleanup data error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    if (error.message === 'Admin access required') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to cleanup data: ' + error.message 
    })
  }
}
