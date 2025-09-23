import bcrypt from 'bcryptjs'
import { query, initializeDatabase } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('🔧 Resetting admin user...')
    
    // Initialize database
    await initializeDatabase()

    // Hash the default password
    const adminPassword = await bcrypt.hash('admin123', 10)
    
    // Delete existing admin user and recreate
    await query('DELETE FROM users WHERE username = $1', ['admin'])
    
    const result = await query(`
      INSERT INTO users (username, email, password, role, permissions, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, username, email, role
    `, [
      'admin',
      'admin@inventory.local',
      adminPassword,
      'admin',
      ['viewProducts', 'manageProducts', 'manageStores', 'manageUsers'],
      true
    ])

    console.log('✅ Admin user reset successfully')

    res.status(200).json({
      success: true,
      message: 'Admin user reset successfully',
      user: result.rows[0],
      credentials: {
        username: 'admin',
        password: 'admin123'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Reset admin error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

