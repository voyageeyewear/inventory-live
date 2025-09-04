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
    
    // Get user-specific stats
    const userStockLogsResult = await query(
      'SELECT * FROM stock_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [user.id]
    )
    
    const userScanLogsResult = await query(
      'SELECT * FROM scan_logs WHERE user_id = $1 ORDER BY last_scanned DESC LIMIT 5',
      [user.id]
    )
    
    // Count user activities
    const totalScansResult = await query(
      'SELECT COUNT(*) FROM scan_logs WHERE user_id = $1',
      [user.id]
    )
    
    const totalStockActionsResult = await query(
      'SELECT COUNT(*) FROM stock_logs WHERE user_id = $1',
      [user.id]
    )
    
    res.status(200).json({
      user: {
        username: user.username,
        email: user.email,
        role: user.role
      },
      stats: {
        totalScans: parseInt(totalScansResult.rows[0].count),
        totalStockActions: parseInt(totalStockActionsResult.rows[0].count)
      },
      recentStockLogs: userStockLogsResult.rows,
      recentScanLogs: userScanLogsResult.rows
    })
  } catch (error) {
    console.error('User dashboard error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to fetch user dashboard data' })
    }
  }
}