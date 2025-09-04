import { connectToDatabase } from '../../../lib/mongodb'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-key-2024-production')
    const { db } = await connectToDatabase()
    
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(decoded.id) 
    })

    if (!user || !user.isActive) {
      throw new Error('Invalid token or user inactive')
    }

    return user
  } catch (error) {
    throw new Error('Authentication failed')
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { db } = await connectToDatabase()
    
    // Get basic dashboard stats
    const totalProducts = await db.collection('products').countDocuments()
    const totalUsers = await db.collection('users').countDocuments()
    const totalStores = await db.collection('stores').countDocuments()
    
    // Get recent stock logs
    const recentStockLogs = await db.collection('stocklogs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
    
    // Get low stock products (quantity < 10)
    const lowStockProducts = await db.collection('products')
      .find({ quantity: { $lt: 10 } })
      .limit(5)
      .toArray()
    
    res.status(200).json({
      stats: {
        totalProducts,
        totalUsers,
        totalStores,
        lowStockCount: lowStockProducts.length
      },
      recentActivity: recentStockLogs,
      lowStockProducts
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to fetch dashboard data' })
    }
  }
}
