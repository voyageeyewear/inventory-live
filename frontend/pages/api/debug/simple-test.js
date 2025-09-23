export default async function handler(req, res) {
  try {
    console.log('🔍 Simple test endpoint called')
    
    res.status(200).json({
      success: true,
      message: 'API is working',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    })
  } catch (error) {
    console.error('❌ Simple test error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

