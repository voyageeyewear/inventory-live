import { query } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Creating mobile users and activities tables...')

    // Create mobile_users table
    await query(`
      CREATE TABLE IF NOT EXISTS mobile_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        device_id VARCHAR(255),
        device_name VARCHAR(255),
        ip_address VARCHAR(45),
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        app_version VARCHAR(50),
        platform VARCHAR(50),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create mobile_activities table
    await query(`
      CREATE TABLE IF NOT EXISTS mobile_activities (
        id SERIAL PRIMARY KEY,
        mobile_user_id INTEGER REFERENCES mobile_users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        barcode VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        quantity INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by INTEGER REFERENCES users(id),
        notes TEXT,
        device_info TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes for better performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_mobile_users_username ON mobile_users(username);
      CREATE INDEX IF NOT EXISTS idx_mobile_users_email ON mobile_users(email);
      CREATE INDEX IF NOT EXISTS idx_mobile_users_active ON mobile_users(is_active);
      CREATE INDEX IF NOT EXISTS idx_mobile_activities_user ON mobile_activities(mobile_user_id);
      CREATE INDEX IF NOT EXISTS idx_mobile_activities_status ON mobile_activities(status);
      CREATE INDEX IF NOT EXISTS idx_mobile_activities_scanned_at ON mobile_activities(scanned_at);
    `)

    // Insert sample mobile user if none exist
    const existingUsers = await query('SELECT COUNT(*) as count FROM mobile_users')
    if (existingUsers.rows[0].count === '0') {
      console.log('Creating sample mobile user...')
      
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash('mobile123', 12)
      
      await query(`
        INSERT INTO mobile_users (username, email, password, device_name, is_active)
        VALUES ('mobile_user', 'mobile@example.com', $1, 'Sample Device', true)
      `, [hashedPassword])
    }

    console.log('Mobile tables created successfully')

    res.status(200).json({ 
      message: 'Mobile tables created successfully',
      tables: ['mobile_users', 'mobile_activities']
    })

  } catch (error) {
    console.error('Setup mobile tables error:', error)
    res.status(500).json({ 
      message: 'Failed to create mobile tables',
      error: error.message 
    })
  }
}
