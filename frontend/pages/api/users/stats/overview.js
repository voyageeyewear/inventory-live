import { connectToDatabase } from '../../../../lib/mongodb'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { db } = await connectToDatabase()
    
    // Get basic stats
    const totalUsers = await db.collection('users').countDocuments()
    const totalProducts = await db.collection('products').countDocuments()
    const activeUsers = await db.collection('users').countDocuments({ isActive: true })
    
    res.status(200).json({
      totalUsers,
      totalProducts,
      activeUsers,
      totalStores: 0, // Placeholder
      recentActivity: []
    })
  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({ message: 'Failed to fetch stats' })
  }
}
