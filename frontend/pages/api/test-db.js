// Test database connection without complex initialization
export default async function handler(req, res) {
  try {
    console.log('🗄️ Testing database connection...')
    
    // Check if environment variables exist
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL
    console.log('Database URL exists:', !!dbUrl)
    console.log('Database URL prefix:', dbUrl ? dbUrl.substring(0, 20) + '...' : 'NOT SET')
    
    if (!dbUrl) {
      return res.status(500).json({
        success: false,
        error: 'Database connection string not found',
        env_check: {
          POSTGRES_URL: !!process.env.POSTGRES_URL,
          DATABASE_URL: !!process.env.DATABASE_URL,
          NODE_ENV: process.env.NODE_ENV
        }
      })
    }

    // Try to import and test the database connection
    const { Pool } = require('pg')
    
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 1, // Minimal connection for testing
      connectionTimeoutMillis: 5000,
    })

    console.log('🔍 Attempting database query...')
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version')
    console.log('✅ Database query successful')
    
    await pool.end()
    
    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      data: {
        current_time: result.rows[0].current_time,
        db_version: result.rows[0].db_version.substring(0, 50) + '...',
        connection_test: 'passed'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Database test error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      error_code: error.code,
      error_detail: error.detail,
      timestamp: new Date().toISOString()
    })
  }
}

