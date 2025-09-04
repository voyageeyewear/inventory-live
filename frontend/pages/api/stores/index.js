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
          const stores = await db.collection('stores')
            .find({ isActive: true })
            .sort({ name: 1 })
            .toArray()
          
          res.status(200).json(stores)
        } catch (error) {
          console.error('Get stores error:', error)
          res.status(500).json({ message: 'Failed to fetch stores' })
        }
        break

      case 'POST':
        try {
          const { name, address, phone, email, manager } = req.body
          
          if (!name) {
            return res.status(400).json({ message: 'Store name is required' })
          }

          // Check if store already exists
          const existingStore = await db.collection('stores').findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') } 
          })
          
          if (existingStore) {
            return res.status(400).json({ message: 'Store with this name already exists' })
          }

          const newStore = {
            name,
            address: address || '',
            phone: phone || '',
            email: email || '',
            manager: manager || '',
            isActive: true,
            createdBy: new ObjectId(user._id),
            createdAt: new Date(),
            updatedAt: new Date()
          }

          const result = await db.collection('stores').insertOne(newStore)
          const store = { ...newStore, _id: result.insertedId }
          
          res.status(201).json(store)
        } catch (error) {
          console.error('Create store error:', error)
          res.status(500).json({ message: 'Failed to create store' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}
