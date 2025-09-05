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
    
    const { page = 1, limit = 50, search = '', user_filter = '' } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    // Build search conditions
    let searchConditions = []
    let searchParams = []
    let paramIndex = 1

    if (search) {
      searchConditions.push(`(mt.sku ILIKE $${paramIndex} OR p.product_name ILIKE $${paramIndex})`)
      searchParams.push(`%${search}%`)
      paramIndex++
    }

    if (user_filter) {
      searchConditions.push(`mt.requested_by_username ILIKE $${paramIndex}`)
      searchParams.push(`%${user_filter}%`)
      paramIndex++
    }

    const whereClause = searchConditions.length > 0 ? `WHERE ${searchConditions.join(' AND ')}` : ''

    // Get mobile transactions (both pending and processed) as scan history
    const scanHistoryQuery = `
      SELECT 
        mt.id,
        mt.sku,
        mt.transaction_type,
        mt.quantity,
        mt.notes,
        mt.status,
        mt.requested_by_username as scanned_by,
        mt.approved_by_username,
        mt.created_at as scanned_at,
        mt.approved_at,
        p.product_name,
        p.image_url,
        p.category,
        p.quantity as current_stock,
        'mobile_transaction' as source_type
      FROM mobile_transactions mt
      LEFT JOIN products p ON mt.product_id = p.id
      ${whereClause}
      ORDER BY mt.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    searchParams.push(parseInt(limit), offset)

    const result = await query(scanHistoryQuery, searchParams)

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM mobile_transactions mt
      LEFT JOIN products p ON mt.product_id = p.id
      ${whereClause}
    `

    const countParams = searchParams.slice(0, -2) // Remove limit and offset
    const countResult = await query(countQuery, countParams)
    const totalCount = parseInt(countResult.rows[0].total)

    // Get summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_scans,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_scans,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_scans,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_scans,
        COUNT(CASE WHEN transaction_type = 'stock_in' THEN 1 END) as stock_in_scans,
        COUNT(CASE WHEN transaction_type = 'stock_out' THEN 1 END) as stock_out_scans,
        COUNT(DISTINCT requested_by_username) as unique_users,
        COUNT(DISTINCT sku) as unique_products
      FROM mobile_transactions
    `

    const statsResult = await query(statsQuery)
    const stats = statsResult.rows[0]

    // Get recent activity (last 7 days)
    const recentActivityQuery = `
      SELECT 
        DATE(created_at) as scan_date,
        COUNT(*) as scan_count,
        COUNT(CASE WHEN transaction_type = 'stock_in' THEN 1 END) as stock_in_count,
        COUNT(CASE WHEN transaction_type = 'stock_out' THEN 1 END) as stock_out_count
      FROM mobile_transactions
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY scan_date DESC
    `

    const recentActivityResult = await query(recentActivityQuery)

    res.status(200).json({
      success: true,
      data: {
        scans: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        },
        stats: {
          total_scans: parseInt(stats.total_scans),
          pending_scans: parseInt(stats.pending_scans),
          approved_scans: parseInt(stats.approved_scans),
          rejected_scans: parseInt(stats.rejected_scans),
          stock_in_scans: parseInt(stats.stock_in_scans),
          stock_out_scans: parseInt(stats.stock_out_scans),
          unique_users: parseInt(stats.unique_users),
          unique_products: parseInt(stats.unique_products)
        },
        recent_activity: recentActivityResult.rows
      }
    })
  } catch (error) {
    console.error('Scan history error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to fetch scan history' })
    }
  }
}
