// Test if the route works without imports first
export default async function handler(req, res) {
  const { method } = req
  const { id } = req.query

  console.log(`Products [id] API called: method=${method}, id=${id}`)

  // Simple test response
  if (method === 'GET') {
    return res.status(200).json({
      message: 'Dynamic route working',
      id: id,
      method: method,
      timestamp: new Date().toISOString()
    })
  }

  res.status(405).json({ message: 'Method not allowed' })
}