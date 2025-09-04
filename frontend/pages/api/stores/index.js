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
  const { method } = req

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { db } = await connectToDatabase()

    switch (method) {
      case 'GET':
        try {
          const result = await query(
            'SELECT * FROM stores WHERE is_active = true ORDER BY name ASC'
          )
          const stores = result.rows
          
          res.status(200).json(stores)
        } catch (error) {
          console.error('Get stores error:', error)
          res.status(500).json({ message: 'Failed to fetch stores' })
        }
        break

      case 'POST':
        try {
          const { name, address, phone, email, manager } = req.body
          
          if (!name) {
            return res.status(400).json({ message: 'Store name is required' })
          }

          // Check if store already exists
          const existingStoreResult = await query(
            'SELECT id FROM stores WHERE LOWER(name) = LOWER($1)',
            [name]
          )
          
          if (existingStoreResult.rows.length > 0) {
            return res.status(400).json({ message: 'Store with this name already exists' })
          }

          const result = await query(`
            INSERT INTO stores (name, address, phone, email, manager, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [name, address || '', phone || '', email || '', manager || '', true, user.id])
          
          const store = result.rows[0]
          
          res.status(201).json(store)
        } catch (error) {
          console.error('Create store error:', error)
          res.status(500).json({ message: 'Failed to create store' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}
