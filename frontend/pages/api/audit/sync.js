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
      sku, 
      store, 
      action, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query

    // Build query with filters
    let queryText = `
      SELECT 
        sl.id,
        sl.product_id,
        sl.product_name,
        sl.sku,
        sl.type as action,
        sl.quantity,
        sl.previous_quantity,
        sl.new_quantity,
        sl.notes,
        sl.user_name,
        sl.created_at,
        CASE 
          WHEN sl.notes LIKE '%error%' OR sl.notes LIKE '%failed%' THEN 'error'
          ELSE 'success'
        END as status,
        CASE 
          WHEN sl.notes LIKE '%Synced to store:%' THEN SUBSTRING(sl.notes FROM 'Synced to store: (.+)')
          ELSE 'Unknown Store'
        END as store_name,
        (sl.new_quantity - sl.previous_quantity) as quantity_change,
        'single_sync' as sync_type,
        '' as shopify_product_id,
        '' as shopify_variant_id,
        0 as sync_duration_ms
      FROM stock_logs sl
      WHERE sl.type = 'sync'
    `
    
    let queryParams = []
    let paramCount = 0

    if (sku) {
      paramCount++
      queryText += ` AND sl.sku ILIKE $${paramCount}`
      queryParams.push(`%${sku}%`)
    }

    if (store) {
      paramCount++
      queryText += ` AND sl.notes ILIKE $${paramCount}`
      queryParams.push(`%${store}%`)
    }

    if (startDate) {
      paramCount++
      queryText += ` AND sl.created_at >= $${paramCount}`
      queryParams.push(startDate)
    }

    if (endDate) {
      paramCount++
      queryText += ` AND sl.created_at <= $${paramCount}`
      queryParams.push(endDate)
    }

    // Add ordering
    queryText += ' ORDER BY sl.created_at DESC'

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit)
    paramCount++
    queryText += ` LIMIT $${paramCount}`
    queryParams.push(parseInt(limit))
    
    paramCount++
    queryText += ` OFFSET $${paramCount}`
    queryParams.push(offset)

    // Execute query
    const result = await query(queryText, queryParams)
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM stock_logs sl
      WHERE sl.type = 'sync'
    `
    let countParams = []
    let countParamCount = 0

    if (sku) {
      countParamCount++
      countQuery += ` AND sl.sku ILIKE $${countParamCount}`
      countParams.push(`%${sku}%`)
    }

    if (store) {
      countParamCount++
      countQuery += ` AND sl.notes ILIKE $${countParamCount}`
      countParams.push(`%${store}%`)
    }

    if (startDate) {
      countParamCount++
      countQuery += ` AND sl.created_at >= $${countParamCount}`
      countParams.push(startDate)
    }

    if (endDate) {
      countParamCount++
      countQuery += ` AND sl.created_at <= $${countParamCount}`
      countParams.push(endDate)
    }

    const countResult = await query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].total)
    const pages = Math.ceil(total / parseInt(limit))

    res.status(200).json({
      success: true,
      data: {
        logs: result.rows.map(log => ({
          ...log,
          createdAt: log.created_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: pages
        }
      }
    })
  } catch (error) {
    console.error('Sync audit error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch sync audit logs: ' + error.message 
    })
  }
}
