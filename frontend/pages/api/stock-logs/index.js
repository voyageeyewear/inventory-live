import { connectToDatabase } from '../../../lib/mongodb'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

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
    const { 
      page = 1, 
      limit = 50, 
      type, 
      product_id, 
      start_date, 
      end_date 
    } = req.query

    // Build query
    let query = {}
    
    if (type && ['stock_in', 'stock_out'].includes(type)) {
      query.type = type
    }
    
    if (product_id) {
      query.product_id = new ObjectId(product_id)
    }
    
    if (start_date || end_date) {
      query.createdAt = {}
      if (start_date) {
        query.createdAt.$gte = new Date(start_date)
      }
      if (end_date) {
        query.createdAt.$lte = new Date(end_date)
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    // Get stock logs
    const stockLogs = await db.collection('stocklogs')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray()

    // Get total count
    const totalCount = await db.collection('stocklogs').countDocuments(query)
    
    res.status(200).json({
      stockLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      }
    })
  } catch (error) {
    console.error('Get stock logs error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to fetch stock logs' })
    }
  }
}
