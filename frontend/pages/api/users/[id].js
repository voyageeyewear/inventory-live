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
  const { method, query: { id } } = req

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    // Check if user has admin permissions
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const userId = parseInt(id)
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' })
    }
    
    switch (method) {
      case 'GET':
        try {
          const result = await query(
            'SELECT id, username, email, role, permissions, is_active, created_by, created_at, updated_at FROM users WHERE id = $1',
            [userId]
          )
          
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' })
          }
          
          res.status(200).json(result.rows[0])
        } catch (error) {
          console.error('Get user error:', error)
          res.status(500).json({ message: 'Failed to fetch user' })
        }
        break

      case 'PUT':
        try {
          const { username, email, role, is_active, password } = req.body
          
          if (!username || !email) {
            return res.status(400).json({ 
              message: 'Username and email are required' 
            })
          }

          // Check if user exists
          const existingUserResult = await query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
          )
          
          if (existingUserResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' })
          }

          // Check if username or email already exists for other users
          const duplicateResult = await query(
            'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
            [username, email, userId]
          )
          
          if (duplicateResult.rows.length > 0) {
            return res.status(400).json({ 
              message: 'Username or email already exists for another user' 
            })
          }

          let updateQuery = `
            UPDATE users 
            SET username = $1, email = $2, role = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
          `
          let queryParams = [username, email, role || 'user', is_active !== undefined ? is_active : true]

          // If password is provided, hash and update it
          if (password) {
            const hashedPassword = await bcrypt.hash(password, 12)
            updateQuery += ', password = $5'
            queryParams.push(hashedPassword)
            updateQuery += ' WHERE id = $6 RETURNING id, username, email, role, permissions, is_active, created_by, created_at, updated_at'
            queryParams.push(userId)
          } else {
            updateQuery += ' WHERE id = $5 RETURNING id, username, email, role, permissions, is_active, created_by, created_at, updated_at'
            queryParams.push(userId)
          }

          const result = await query(updateQuery, queryParams)
          
          res.status(200).json(result.rows[0])
        } catch (error) {
          console.error('Update user error:', error)
          res.status(500).json({ message: 'Failed to update user' })
        }
        break

      case 'DELETE':
        try {
          // Prevent self-deletion
          if (userId === user.id) {
            return res.status(400).json({ message: 'Cannot delete your own account' })
          }

          // Check if user exists
          const existingUserResult = await query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
          )
          
          if (existingUserResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' })
          }

          // Soft delete by setting is_active to false
          await query(
            'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
          )
          
          res.status(200).json({ message: 'User deleted successfully' })
        } catch (error) {
          console.error('Delete user error:', error)
          res.status(500).json({ message: 'Failed to delete user' })
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
