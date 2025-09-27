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

    try {
      // Get the activity details
      const activityResult = await query(
        'SELECT * FROM mobile_activities WHERE id = $1 AND status = $2',
        [activityId, 'pending']
      )

      if (activityResult.rows.length === 0) {
        return res.status(404).json({ message: 'Pending activity not found' })
      }

      const activity = activityResult.rows[0]

      // Start transaction
      await query('BEGIN')

      try {
        // Update activity status to approved
        await query(`
          UPDATE mobile_activities 
          SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, notes = $2
          WHERE id = $3
        `, [user.id, req.body.notes || 'Approved by admin', activityId])

        // Apply the stock change based on the action
        if (activity.action === 'stock_in') {
          // Add stock
          await query(`
            UPDATE products 
            SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
          `, [activity.quantity, activity.product_id])

          // Log the stock movement
          await query(`
            INSERT INTO stock_logs (
              product_id, sku, product_name, action, quantity, 
              previous_quantity, new_quantity, notes, user_id, created_at
            )
            SELECT 
              p.id, p.sku, p.product_name, 'stock_in', $1,
              p.quantity - $1, p.quantity, 
              'Mobile app transaction approved', $2, CURRENT_TIMESTAMP
            FROM products p WHERE p.id = $3
          `, [activity.quantity, user.id, activity.product_id])

        } else if (activity.action === 'stock_out') {
          // Remove stock
          await query(`
            UPDATE products 
            SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
          `, [activity.quantity, activity.product_id])

          // Log the stock movement
          await query(`
            INSERT INTO stock_logs (
              product_id, sku, product_name, action, quantity, 
              previous_quantity, new_quantity, notes, user_id, created_at
            )
            SELECT 
              p.id, p.sku, p.product_name, 'stock_out', $1,
              p.quantity + $1, p.quantity, 
              'Mobile app transaction approved', $2, CURRENT_TIMESTAMP
            FROM products p WHERE p.id = $3
          `, [activity.quantity, user.id, activity.product_id])
        }

        // Commit transaction
        await query('COMMIT')

        res.status(200).json({ 
          message: 'Transaction approved successfully',
          activity_id: activityId
        })

      } catch (error) {
        // Rollback transaction
        await query('ROLLBACK')
        throw error
      }

    } catch (error) {
      console.error('Approve activity error:', error)
      res.status(500).json({ message: 'Failed to approve activity' })
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
