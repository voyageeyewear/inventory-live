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
  const { method } = req

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    // Check if user has admin permissions
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    switch (method) {
      case 'GET':
        try {
          const result = await query(
            'SELECT id, username, email, role, permissions, is_active, created_by, created_at, updated_at FROM users ORDER BY created_at DESC'
          )
          const users = result.rows
          
          res.status(200).json(users)
        } catch (error) {
          console.error('Get users error:', error)
          res.status(500).json({ message: 'Failed to fetch users' })
        }
        break

      case 'POST':
        try {
          const { username, email, password, role = 'user', permissions = [] } = req.body
          
          if (!username || !email || !password) {
            return res.status(400).json({ 
              message: 'Username, email, and password are required' 
            })
          }

          // Check if user already exists
          const existingUserResult = await query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
          )
          
          if (existingUserResult.rows.length > 0) {
            return res.status(400).json({ 
              message: 'User with this username or email already exists' 
            })
          }

          // Hash password
          const hashedPassword = await bcrypt.hash(password, 12)

          const result = await query(`
            INSERT INTO users (username, email, password, role, permissions, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, username, email, role, permissions, is_active, created_by, created_at, updated_at
          `, [username, email, hashedPassword, role, permissions, true, user.id])
          
          const userResponse = result.rows[0]
          
          res.status(201).json(userResponse)
        } catch (error) {
          console.error('Create user error:', error)
          res.status(500).json({ message: 'Failed to create user' })
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
