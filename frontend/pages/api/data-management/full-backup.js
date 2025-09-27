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
    const user = await authenticateToken(req)

    // Fetch all system data
    const results = await Promise.allSettled([
      query('SELECT * FROM products ORDER BY id'),
      query('SELECT * FROM stores ORDER BY id'),
      query('SELECT * FROM users ORDER BY id'),
      query('SELECT * FROM stock_logs ORDER BY created_at DESC LIMIT 10000'),
      query('SELECT * FROM scan_logs ORDER BY created_at DESC LIMIT 5000'),
      query('SELECT * FROM mobile_activities ORDER BY created_at DESC LIMIT 5000')
    ])

    const products = results[0].status === 'fulfilled' ? results[0].value.rows : []
    const stores = results[1].status === 'fulfilled' ? results[1].value.rows : []
    const users = results[2].status === 'fulfilled' ? results[2].value.rows : []
    const stockLogs = results[3].status === 'fulfilled' ? results[3].value.rows : []
    const scanLogs = results[4].status === 'fulfilled' ? results[4].value.rows : []
    const mobileActivities = results[5].status === 'fulfilled' ? results[5].value.rows : []

    // Remove sensitive data from users
    const sanitizedUsers = users.map(u => ({
      ...u,
      password: '[REDACTED]'
    }))

    const backupData = {
      metadata: {
        version: '2.0',
        timestamp: new Date().toISOString(),
        created_by: user.username,
        system: 'Inventory Management System',
        total_records: products.length + stores.length + users.length + stockLogs.length + scanLogs.length + mobileActivities.length
      },
      data: {
        products: products,
        stores: stores,
        users: sanitizedUsers,
        stock_logs: stockLogs,
        scan_logs: scanLogs,
        mobile_activities: mobileActivities
      },
      statistics: {
        products: {
          total: products.length,
          active: products.filter(p => p.is_active).length,
          categories: [...new Set(products.map(p => p.category))].length
        },
        stores: {
          total: stores.length,
          connected: stores.filter(s => s.connected).length
        },
        users: {
          total: users.length,
          active: users.filter(u => u.is_active).length,
          roles: users.reduce((acc, u) => {
            acc[u.role] = (acc[u.role] || 0) + 1
            return acc
          }, {})
        },
        logs: {
          stock_logs: stockLogs.length,
          scan_logs: scanLogs.length,
          mobile_activities: mobileActivities.length
        }
      }
    }

    res.status(200).json({
      success: true,
      backup: backupData
    })
  } catch (error) {
    console.error('Full backup error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to create backup: ' + error.message 
    })
  }
}
