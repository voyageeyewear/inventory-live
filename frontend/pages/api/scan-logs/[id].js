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
    const user = userResult.rows[0]

    if (!user || !user.is_active) {
      throw new Error('Invalid token or user inactive')
    }

    return user
  } catch (error) {
    throw new Error('Authentication failed')
  }
}

export default async function handler(req, res) {
  const { method } = req
  const { id } = req.query

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { db } = await connectToDatabase()

    switch (method) {
      case 'PUT':
        try {
          const { quantity } = req.body
          
          if (!quantity || quantity < 1) {
            return res.status(400).json({ message: 'Valid quantity is required' })
          }

          const result = await query(
            'UPDATE scan_logs SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
            [quantity, id, user.id]
          )
          
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Scan log not found' })
          }
          
          const updatedScanLog = result.rows[0]
          
          res.status(200).json(updatedScanLog)
        } catch (error) {
          console.error('Update scan log error:', error)
          res.status(500).json({ message: 'Failed to update scan log' })
        }
        break

      case 'DELETE':
        try {
          const result = await query(
            'DELETE FROM scan_logs WHERE id = $1 AND user_id = $2',
            [id, user.id]
          )
          
          if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Scan log not found' })
          }
          
          res.status(200).json({ message: 'Scan log deleted successfully' })
        } catch (error) {
          console.error('Delete scan log error:', error)
          res.status(500).json({ message: 'Failed to delete scan log' })
        }
        break

      default:
        res.setHeader('Allow', ['PUT', 'DELETE'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}
