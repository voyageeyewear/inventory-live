export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Simple health check without database connection
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    })
  }
}
