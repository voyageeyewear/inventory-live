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

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { db } = await connectToDatabase()

    switch (method) {
      case 'GET':
        try {
          const { session_id = 'mobile-session' } = req.query
          
          const scanLogs = await db.collection('scanlogs').find({
            user_id: new ObjectId(user._id)
          }).sort({ last_scanned: -1 }).toArray()
          
          res.status(200).json(scanLogs)
        } catch (error) {
          console.error('Get scan logs error:', error)
          res.status(500).json({ message: 'Failed to fetch scan logs' })
        }
        break

      case 'POST':
        try {
          const { sku, session_id = 'mobile-session', quantity = 1 } = req.body
          
          if (!sku) {
            return res.status(400).json({ message: 'SKU is required' })
          }

          // Find product by SKU
          const product = await db.collection('products').findOne({ sku })
          if (!product) {
            return res.status(404).json({ message: 'Product not found' })
          }

          // Check if scan log already exists
          let scanLog = await db.collection('scanlogs').findOne({ 
            user_id: new ObjectId(user._id), 
            sku: sku 
          })

          if (scanLog) {
            // Update existing log
            const result = await db.collection('scanlogs').updateOne(
              { _id: scanLog._id },
              {
                $inc: { 
                  quantity: quantity,
                  scan_count: 1 
                },
                $set: { 
                  last_scanned: new Date() 
                }
              }
            )
            
            scanLog = await db.collection('scanlogs').findOne({ _id: scanLog._id })
          } else {
            // Create new log
            const newScanLog = {
              sku: product.sku,
              product_name: product.product_name,
              quantity: quantity,
              price: product.price || 0,
              category: product.category || '',
              user_id: new ObjectId(user._id),
              session_id: session_id,
              scan_count: 1,
              last_scanned: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
            
            const result = await db.collection('scanlogs').insertOne(newScanLog)
            scanLog = { ...newScanLog, _id: result.insertedId }
          }
          
          res.status(201).json({ 
            success: true, 
            message: 'Scan logged successfully', 
            scanLog 
          })
        } catch (error) {
          console.error('Add scan log error:', error)
          res.status(500).json({ message: 'Failed to add scan log' })
        }
        break

      case 'DELETE':
        try {
          const result = await db.collection('scanlogs').deleteMany({
            user_id: new ObjectId(user._id)
          })
          
          res.status(200).json({ 
            message: `Deleted ${result.deletedCount} scan logs` 
          })
        } catch (error) {
          console.error('Delete scan logs error:', error)
          res.status(500).json({ message: 'Failed to delete scan logs' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}
