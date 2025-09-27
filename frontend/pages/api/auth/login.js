import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query, initializeDatabase } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' })
    }

    // Initialize database if needed
    try {
      await initializeDatabase()
    } catch (initError) {
      console.error('Database initialization error:', initError)
    }

    // Find user by username or email
    const userResult = await query(
      'SELECT * FROM users WHERE (username = $1 OR email = $1) AND is_active = true',
      [username]
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const user = userResult.rows[0]

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'inventory-jwt-secret-2024-secure-key',
      { expiresIn: '24h' }
    )

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      }
    })

    console.log(`🔐 User logged in: ${user.username} (${user.email})`)
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ 
      message: 'Login failed', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}