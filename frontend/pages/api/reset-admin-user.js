import bcrypt from 'bcryptjs'
import { query, initializeDatabase } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('🔧 Resetting admin user...')
    
    // Initialize database
    await initializeDatabase()
    console.log('✅ Database initialized')

    // Delete existing admin user if exists
    await query('DELETE FROM users WHERE username = $1', ['admin'])
    console.log('🗑️ Deleted existing admin user')

    // Create new admin user with correct password
    const adminPassword = await bcrypt.hash('admin123', 10)
    
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
    
    console.log('✅ Admin user created successfully:', result.rows[0])

    res.status(200).json({
      success: true,
      message: 'Admin user reset successfully',
      user: result.rows[0],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Reset admin user error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

