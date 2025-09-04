export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // For now, return empty array as sync functionality is not implemented
    // This endpoint is called frequently by the frontend
    res.status(200).json([])
  } catch (error) {
    console.error('Get products needing sync error:', error)
    res.status(500).json({ message: 'Failed to fetch sync status' })
  }
}