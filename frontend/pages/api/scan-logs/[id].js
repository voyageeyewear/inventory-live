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
  const { method } = req
  const { id } = req.query

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { db } = await connectToDatabase()

    switch (method) {
      case 'PUT':
        try {
          const { quantity } = req.body
          
          if (!quantity || quantity < 1) {
            return res.status(400).json({ message: 'Valid quantity is required' })
          }

          const result = await db.collection('scanlogs').updateOne(
            { 
              _id: new ObjectId(id),
              user_id: new ObjectId(user._id)
            },
            {
              $set: { 
                quantity: quantity,
                updatedAt: new Date()
              }
            }
          )
          
          if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Scan log not found' })
          }
          
          const updatedScanLog = await db.collection('scanlogs').findOne({ 
            _id: new ObjectId(id) 
          })
          
          res.status(200).json(updatedScanLog)
        } catch (error) {
          console.error('Update scan log error:', error)
          res.status(500).json({ message: 'Failed to update scan log' })
        }
        break

      case 'DELETE':
        try {
          const result = await db.collection('scanlogs').deleteOne({
            _id: new ObjectId(id),
            user_id: new ObjectId(user._id)
          })
          
          if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Scan log not found' })
          }
          
          res.status(200).json({ message: 'Scan log deleted successfully' })
        } catch (error) {
          console.error('Delete scan log error:', error)
          res.status(500).json({ message: 'Failed to delete scan log' })
        }
        break

      default:
        res.setHeader('Allow', ['PUT', 'DELETE'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}
