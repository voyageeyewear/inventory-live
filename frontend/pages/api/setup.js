import { initializeDatabase } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    await initializeDatabase()
    
    res.status(200).json({ 
      success: true,
      message: 'Database initialized successfully',
      admin: {
        username: 'admin',
        email: 'admin@inventory.com',
        password: 'admin123'
      }
    })
  } catch (error) {
    console.error('Setup error:', error)
    res.status(500).json({ 
      message: 'Setup failed', 
      error: error.message 
    })
  }
}