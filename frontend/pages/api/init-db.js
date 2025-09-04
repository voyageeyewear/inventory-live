import { initializeDatabase } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Initializing database...')
    await initializeDatabase()
    
    res.status(200).json({ 
      success: true, 
      message: 'Database initialized successfully' 
    })
  } catch (error) {
    console.error('Database initialization error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize database: ' + error.message 
    })
  }
}
