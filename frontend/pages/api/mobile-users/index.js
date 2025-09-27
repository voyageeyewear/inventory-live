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
          // Get users from main users table with mobile activity stats
          const result = await query(`
            SELECT 
              u.id,
              u.username,
              u.email,
              u.role,
              u.is_active,
              u.created_at,
              u.updated_at,
              COALESCE(device_info.device_name, 'Unknown Device') as device_name,
              COALESCE(device_info.ip_address, 'N/A') as ip_address,
              COALESCE(device_info.last_login, u.created_at) as last_login,
              COALESCE(scan_stats.total_scans, 0) as total_scans,
              COALESCE(approval_stats.pending_approvals, 0) as pending_approvals,
              COALESCE(approval_stats.approved_transactions, 0) as approved_transactions,
              COALESCE(approval_stats.rejected_transactions, 0) as rejected_transactions
            FROM users u
            LEFT JOIN (
              SELECT 
                user_id,
                COUNT(*) as total_scans
              FROM mobile_activities 
              GROUP BY user_id
            ) scan_stats ON u.id = scan_stats.user_id
            LEFT JOIN (
              SELECT 
                user_id,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_approvals,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_transactions,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_transactions
              FROM mobile_activities 
              GROUP BY user_id
            ) approval_stats ON u.id = approval_stats.user_id
            LEFT JOIN (
              SELECT 
                user_id,
                device_name,
                ip_address,
                MAX(created_at) as last_login
              FROM mobile_activities 
              GROUP BY user_id, device_name, ip_address
              ORDER BY last_login DESC
              LIMIT 1
            ) device_info ON u.id = device_info.user_id
            WHERE u.is_active = true
            ORDER BY u.created_at DESC
          `)
          
          res.status(200).json(result.rows)
        } catch (error) {
          console.error('Get mobile users error:', error)
          res.status(500).json({ message: 'Failed to fetch mobile users' })
        }
        break

      case 'POST':
        // Mobile users are now managed through the main users API
        // Redirect to create regular users instead
        return res.status(400).json({ 
          message: 'Mobile users are now managed through the main users system. Use /api/users to create new users.' 
        })

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
