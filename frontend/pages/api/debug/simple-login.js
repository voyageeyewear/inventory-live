import jwt from 'jsonwebtoken'
import { query, initializeDatabase } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('🔍 Simple login attempt started')
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' })
    }

    console.log(`👤 Login attempt for: ${username}`)

    // Initialize database
    console.log('🗄️ Initializing database...')
    await initializeDatabase()
    console.log('✅ Database initialized')

    // For debugging, let's first check if we can connect to database at all
    console.log('🔍 Testing database connection...')
    const testResult = await query('SELECT NOW() as current_time')
    console.log('✅ Database connection successful:', testResult.rows[0])

    // Check if users table exists
    console.log('🔍 Checking users table...')
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `)
    console.log('📊 Users table exists:', tableCheck.rows[0].exists)

    if (!tableCheck.rows[0].exists) {
      console.log('🔧 Creating users table...')
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          permissions TEXT[],
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('✅ Users table created')
    }

    // Check for admin user with simple password (for debugging)
    console.log('🔍 Looking for admin user...')
    const userResult = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    )

    console.log(`📊 Found ${userResult.rows.length} users with username: ${username}`)

    if (userResult.rows.length === 0) {
      // Create admin user with simple password for debugging
      if (username === 'admin' && password === 'admin123') {
        console.log('🔧 Creating admin user...')
        const newUserResult = await query(`
          INSERT INTO users (username, email, password, role, permissions, is_active)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, username, email, role
        `, [
          'admin',
          'admin@inventory.local',
          'admin123', // Plain text for debugging
          'admin',
          ['viewProducts', 'manageProducts', 'manageStores', 'manageUsers'],
          true
        ])
        
        const newUser = newUserResult.rows[0]
        console.log('✅ Admin user created:', newUser)

        // Generate JWT token
        const token = jwt.sign(
          { 
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role
          },
          process.env.JWT_SECRET || 'inventory-jwt-secret-key-2024-production',
          { expiresIn: '24h' }
        )

        return res.status(200).json({
          success: true,
          message: 'Login successful (new admin user created)',
          token,
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            permissions: ['viewProducts', 'manageProducts', 'manageStores', 'manageUsers']
          }
        })
      } else {
        return res.status(401).json({ message: 'Invalid credentials - user not found' })
      }
    }

    const user = userResult.rows[0]
    console.log('👤 Found user:', { id: user.id, username: user.username, email: user.email, role: user.role })

    // Simple password check (for debugging)
    if (user.password !== password) {
      console.log('❌ Password mismatch')
      return res.status(401).json({ message: 'Invalid credentials - password mismatch' })
    }

    console.log('✅ Password matched')

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'inventory-jwt-secret-key-2024-production',
      { expiresIn: '24h' }
    )

    console.log('✅ JWT token generated')

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

    console.log(`🔐 User logged in successfully: ${user.username}`)
  } catch (error) {
    console.error('❌ Simple login error:', error)
    res.status(500).json({ 
      message: 'Login failed', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

