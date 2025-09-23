// Simple health check endpoint - no dependencies
export default async function handler(req, res) {
  try {
    console.log('🏥 Health check called')
    
    // Basic response without any database or external dependencies
    res.status(200).json({
      status: 'ok',
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      environment: process.env.NODE_ENV || 'unknown'
    })
  } catch (error) {
    console.error('❌ Health check error:', error)
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

