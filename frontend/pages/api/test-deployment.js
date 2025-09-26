export default async function handler(req, res) {
  res.status(200).json({ 
    success: true, 
    message: 'Deployment test successful',
    timestamp: new Date().toISOString(),
    version: '2.0.1'
  })
}
