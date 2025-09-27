import jwt from 'jsonwebtoken'
import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-2024-secure-key')
    
    const userResult = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.id])

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token or user inactive' })
    }

    const user = userResult.rows[0]

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      }
    })
  } catch (error) {
    console.error('Token verification error:', error)
    res.status(401).json({ message: 'Invalid token' })
  }
}