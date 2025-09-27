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
  const { method } = req

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    // Check if user has admin or manager permissions
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({ message: 'Admin or Manager access required' })
    }
    
    switch (method) {
      case 'GET':
        try {
          const { status, user_id, limit = 100 } = req.query
          
          let whereClause = 'WHERE 1=1'
          let queryParams = []
          let paramCount = 0

          if (status) {
            paramCount++
            whereClause += ` AND ma.status = $${paramCount}`
            queryParams.push(status)
          }

          if (user_id) {
            paramCount++
            whereClause += ` AND ma.user_id = $${paramCount}`
            queryParams.push(parseInt(user_id))
          }

          paramCount++
          const limitClause = `LIMIT $${paramCount}`
          queryParams.push(parseInt(limit))

          const result = await query(`
            SELECT 
              ma.*,
              u.username,
              u.email,
              u.role,
              p.name as product_name,
              p.sku,
              approver.username as approver_name
            FROM mobile_activities ma
            LEFT JOIN users u ON ma.user_id = u.id
            LEFT JOIN products p ON ma.product_id = p.id
            LEFT JOIN users approver ON ma.approved_by = approver.id
            ${whereClause}
            ORDER BY ma.created_at DESC
            ${limitClause}
          `, queryParams)
          
          res.status(200).json(result.rows)
        } catch (error) {
          console.error('Get mobile activities error:', error)
          res.status(500).json({ message: 'Failed to fetch mobile activities' })
        }
        break

      case 'POST':
        try {
          const { 
            user_id, 
            product_id, 
            barcode, 
            action, 
            quantity, 
            notes, 
            device_info, 
            ip_address 
          } = req.body
          
          if (!user_id || !product_id || !barcode || !action || !quantity) {
            return res.status(400).json({ 
              message: 'User ID, product ID, barcode, action, and quantity are required' 
            })
          }

          const result = await query(`
            INSERT INTO mobile_activities (
              user_id, product_id, barcode, action, quantity, 
              notes, device_info, ip_address, status, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', CURRENT_TIMESTAMP)
            RETURNING *
          `, [
            user_id, product_id, barcode, action, quantity, 
            notes || '', device_info || '', ip_address || ''
          ])
          
          res.status(201).json(result.rows[0])
        } catch (error) {
          console.error('Create mobile activity error:', error)
          res.status(500).json({ message: 'Failed to create mobile activity' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(403).json({ message: 'Access denied' })
    }
  }
}
