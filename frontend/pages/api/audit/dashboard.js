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
    
    // Get basic dashboard stats
    const totalProductsResult = await query('SELECT COUNT(*) FROM products WHERE is_active = true')
    const totalUsersResult = await query('SELECT COUNT(*) FROM users WHERE is_active = true')
    const totalStoresResult = await query('SELECT COUNT(*) FROM stores WHERE is_active = true')
    
    // Get recent stock logs
    const recentStockLogsResult = await query(
      'SELECT * FROM stock_logs ORDER BY created_at DESC LIMIT 10'
    )
    
    // Get low stock products (quantity < 10)
    const lowStockProductsResult = await query(
      'SELECT * FROM products WHERE quantity < 10 AND is_active = true LIMIT 5'
    )
    
    res.status(200).json({
      stats: {
        totalProducts: parseInt(totalProductsResult.rows[0].count),
        totalUsers: parseInt(totalUsersResult.rows[0].count),
        totalStores: parseInt(totalStoresResult.rows[0].count),
        lowStockCount: lowStockProductsResult.rows.length
      },
      recentActivity: recentStockLogsResult.rows,
      lowStockProducts: lowStockProductsResult.rows
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to fetch dashboard data' })
    }
  }
}
