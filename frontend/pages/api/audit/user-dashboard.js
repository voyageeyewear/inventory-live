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
    
    // Get user-specific stats
    const userStockLogs = await db.collection('stocklogs')
      .find({ user_id: new ObjectId(user._id) })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
    
    const userScanLogs = await db.collection('scanlogs')
      .find({ user_id: new ObjectId(user._id) })
      .sort({ last_scanned: -1 })
      .limit(5)
      .toArray()
    
    // Count user activities
    const totalScans = await db.collection('scanlogs')
      .countDocuments({ user_id: new ObjectId(user._id) })
    
    const totalStockActions = await db.collection('stocklogs')
      .countDocuments({ user_id: new ObjectId(user._id) })
    
    res.status(200).json({
      user: {
        username: user.username,
        email: user.email,
        role: user.role
      },
      stats: {
        totalScans,
        totalStockActions
      },
      recentStockLogs: userStockLogs,
      recentScanLogs: userScanLogs
    })
  } catch (error) {
    console.error('User dashboard error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to fetch user dashboard data' })
    }
  }
}
