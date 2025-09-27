import { query } from '../../../../lib/postgres'
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
  const { method, query: { id } } = req

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${method} Not Allowed`)
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    // Check if user has admin or manager permissions
    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({ message: 'Admin or Manager access required' })
    }

    const activityId = parseInt(id)
    if (isNaN(activityId)) {
      return res.status(400).json({ message: 'Invalid activity ID' })
    }

    const { notes } = req.body

    try {
      // Check if activity exists and is pending
      const activityResult = await query(
        'SELECT * FROM mobile_activities WHERE id = $1 AND status = $2',
        [activityId, 'pending']
      )

      if (activityResult.rows.length === 0) {
        return res.status(404).json({ message: 'Pending activity not found' })
      }

      // Update activity status to rejected
      await query(`
        UPDATE mobile_activities 
        SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, notes = $2
        WHERE id = $3
      `, [user.id, notes || 'Rejected by admin', activityId])

      res.status(200).json({ 
        message: 'Transaction rejected successfully',
        activity_id: activityId
      })

    } catch (error) {
      console.error('Reject activity error:', error)
      res.status(500).json({ message: 'Failed to reject activity' })
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
