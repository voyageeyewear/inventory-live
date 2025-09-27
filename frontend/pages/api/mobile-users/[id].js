import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

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
  const { method, query: { id } } = req

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    // Check if user has admin or manager permissions
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({ message: 'Admin or Manager access required' })
    }

    const mobileUserId = parseInt(id)
    if (isNaN(mobileUserId)) {
      return res.status(400).json({ message: 'Invalid mobile user ID' })
    }
    
    switch (method) {
      case 'GET':
        try {
          const result = await query(`
            SELECT 
              mu.*,
              COALESCE(scan_stats.total_scans, 0) as total_scans,
              COALESCE(approval_stats.pending_approvals, 0) as pending_approvals,
              COALESCE(approval_stats.approved_transactions, 0) as approved_transactions,
              COALESCE(approval_stats.rejected_transactions, 0) as rejected_transactions
            FROM mobile_users mu
            LEFT JOIN (
              SELECT 
                mobile_user_id,
                COUNT(*) as total_scans
              FROM mobile_activities 
              WHERE mobile_user_id = $1
              GROUP BY mobile_user_id
            ) scan_stats ON mu.id = scan_stats.mobile_user_id
            LEFT JOIN (
              SELECT 
                mobile_user_id,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_approvals,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_transactions,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_transactions
              FROM mobile_activities 
              WHERE mobile_user_id = $1
              GROUP BY mobile_user_id
            ) approval_stats ON mu.id = approval_stats.mobile_user_id
            WHERE mu.id = $1
          `, [mobileUserId])
          
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Mobile user not found' })
          }
          
          res.status(200).json(result.rows[0])
        } catch (error) {
          console.error('Get mobile user error:', error)
          res.status(500).json({ message: 'Failed to fetch mobile user' })
        }
        break

      case 'PUT':
        try {
          const { username, email, device_name, is_active, password } = req.body
          
          if (!username || !email) {
            return res.status(400).json({ 
              message: 'Username and email are required' 
            })
          }

          // Check if mobile user exists
          const existingUserResult = await query(
            'SELECT id FROM mobile_users WHERE id = $1',
            [mobileUserId]
          )
          
          if (existingUserResult.rows.length === 0) {
            return res.status(404).json({ message: 'Mobile user not found' })
          }

          // Check if username or email already exists for other users
          const duplicateResult = await query(
            'SELECT id FROM mobile_users WHERE (username = $1 OR email = $2) AND id != $3',
            [username, email, mobileUserId]
          )
          
          if (duplicateResult.rows.length > 0) {
            return res.status(400).json({ 
              message: 'Username or email already exists for another mobile user' 
            })
          }

          let updateQuery = `
            UPDATE mobile_users 
            SET username = $1, email = $2, device_name = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
          `
          let queryParams = [username, email, device_name || '', is_active !== undefined ? is_active : true]

          // If password is provided, hash and update it
          if (password) {
            const hashedPassword = await bcrypt.hash(password, 12)
            updateQuery += ', password = $5'
            queryParams.push(hashedPassword)
            updateQuery += ' WHERE id = $6 RETURNING id, username, email, device_name, is_active, created_at, updated_at'
            queryParams.push(mobileUserId)
          } else {
            updateQuery += ' WHERE id = $5 RETURNING id, username, email, device_name, is_active, created_at, updated_at'
            queryParams.push(mobileUserId)
          }

          const result = await query(updateQuery, queryParams)
          
          res.status(200).json(result.rows[0])
        } catch (error) {
          console.error('Update mobile user error:', error)
          res.status(500).json({ message: 'Failed to update mobile user' })
        }
        break

      case 'DELETE':
        try {
          // Check if mobile user exists
          const existingUserResult = await query(
            'SELECT id FROM mobile_users WHERE id = $1',
            [mobileUserId]
          )
          
          if (existingUserResult.rows.length === 0) {
            return res.status(404).json({ message: 'Mobile user not found' })
          }

          // Soft delete by setting is_active to false
          await query(
            'UPDATE mobile_users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [mobileUserId]
          )
          
          res.status(200).json({ message: 'Mobile user deleted successfully' })
        } catch (error) {
          console.error('Delete mobile user error:', error)
          res.status(500).json({ message: 'Failed to delete mobile user' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
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
