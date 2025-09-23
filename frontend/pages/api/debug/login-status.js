import bcrypt from 'bcryptjs'
import { query, initializeDatabase } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('🔍 Checking login system status...')
    
    // Initialize database
    await initializeDatabase()
    console.log('✅ Database initialized')

    // Check if users table exists and has data
    const usersResult = await query('SELECT id, username, email, role, is_active, created_at FROM users ORDER BY id')
    console.log(`📊 Found ${usersResult.rows.length} users in database`)

    // Check for admin user specifically
    const adminResult = await query(
      'SELECT id, username, email, role, is_active FROM users WHERE username = $1',
      ['admin']
    )

    let adminStatus = 'not_found'
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0]
      adminStatus = admin.is_active ? 'active' : 'inactive'
      console.log(`👤 Admin user found: ${admin.username} (${admin.email}) - Status: ${adminStatus}`)
    } else {
      console.log('❌ Admin user not found')
    }

    // Test password hashing
    const testPassword = 'admin123'
    const hashedPassword = await bcrypt.hash(testPassword, 10)
    const passwordTest = await bcrypt.compare(testPassword, hashedPassword)
    console.log(`🔐 Password hashing test: ${passwordTest ? 'PASS' : 'FAIL'}`)

    // If admin doesn't exist, create it
    if (adminResult.rows.length === 0) {
      console.log('🔧 Creating admin user...')
      const adminPassword = await bcrypt.hash('admin123', 10)
      
      await query(`
        INSERT INTO users (username, email, password, role, permissions, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (username) DO NOTHING
      `, [
        'admin',
        'admin@inventory.local',
        adminPassword,
        'admin',
        ['viewProducts', 'manageProducts', 'manageStores', 'manageUsers'],
        true
      ])
      
      console.log('✅ Admin user created')
      adminStatus = 'created'
    }

    res.status(200).json({
      success: true,
      database_status: 'connected',
      users_count: usersResult.rows.length,
      admin_status: adminStatus,
      users: usersResult.rows.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at
      })),
      password_hashing: passwordTest ? 'working' : 'failed',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Login status check error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      database_status: 'error',
      timestamp: new Date().toISOString()
    })
  }
}

