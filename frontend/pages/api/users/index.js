import { connectToDatabase } from '../../../lib/mongodb'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

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
    
    // Check if user has admin permissions
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    const { db } = await connectToDatabase()

    switch (method) {
      case 'GET':
        try {
          const users = await db.collection('users')
            .find({}, { projection: { password: 0 } })
            .sort({ createdAt: -1 })
            .toArray()
          
          res.status(200).json(users)
        } catch (error) {
          console.error('Get users error:', error)
          res.status(500).json({ message: 'Failed to fetch users' })
        }
        break

      case 'POST':
        try {
          const { username, email, password, role = 'user', permissions = [] } = req.body
          
          if (!username || !email || !password) {
            return res.status(400).json({ 
              message: 'Username, email, and password are required' 
            })
          }

          // Check if user already exists
          const existingUser = await db.collection('users').findOne({
            $or: [
              { username: username },
              { email: email }
            ]
          })
          
          if (existingUser) {
            return res.status(400).json({ 
              message: 'User with this username or email already exists' 
            })
          }

          // Hash password
          const hashedPassword = await bcrypt.hash(password, 12)

          const newUser = {
            username,
            email,
            password: hashedPassword,
            role,
            permissions,
            isActive: true,
            createdBy: new ObjectId(user._id),
            createdAt: new Date(),
            updatedAt: new Date()
          }

          const result = await db.collection('users').insertOne(newUser)
          
          // Return user without password
          const { password: _, ...userResponse } = newUser
          userResponse._id = result.insertedId
          
          res.status(201).json(userResponse)
        } catch (error) {
          console.error('Create user error:', error)
          res.status(500).json({ message: 'Failed to create user' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(403).json({ message: 'Access denied' })
    }
  }
}
