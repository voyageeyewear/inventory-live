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
    
    const { 
      page = 1, 
      limit = 50, 
      type, 
      product_id, 
      start_date, 
      end_date 
    } = req.query

    // Build query
    let queryText = 'SELECT * FROM stock_logs WHERE 1=1'
    let queryParams = []
    let paramCount = 0
    
    if (type && ['stock_in', 'stock_out'].includes(type)) {
      paramCount++
      queryText += ` AND type = $${paramCount}`
      queryParams.push(type)
    }
    
    if (product_id) {
      paramCount++
      queryText += ` AND product_id = $${paramCount}`
      queryParams.push(product_id)
    }
    
    if (start_date) {
      paramCount++
      queryText += ` AND created_at >= $${paramCount}`
      queryParams.push(start_date)
    }
    
    if (end_date) {
      paramCount++
      queryText += ` AND created_at <= $${paramCount}`
      queryParams.push(end_date)
    }

    // Add pagination
    queryText += ' ORDER BY created_at DESC'
    
    const offset = (parseInt(page) - 1) * parseInt(limit)
    paramCount++
    queryText += ` LIMIT $${paramCount}`
    queryParams.push(parseInt(limit))
    
    paramCount++
    queryText += ` OFFSET $${paramCount}`
    queryParams.push(offset)
    
    // Get stock logs
    const result = await query(queryText, queryParams)

    // Get total count (simplified for now)
    const countResult = await query('SELECT COUNT(*) FROM stock_logs')
    
    res.status(200).json({
      stockLogs: result.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
        totalCount: parseInt(countResult.rows[0].count),
        limit: parseInt(limit)
      }
    })
  } catch (error) {
    console.error('Get stock logs error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to fetch stock logs' })
    }
  }
}