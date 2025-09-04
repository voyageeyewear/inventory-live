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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { db } = await connectToDatabase()
    const { productId, quantity, notes = '', store_id = null } = req.body

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Product ID and valid quantity are required' })
    }

    // Find product
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(productId) 
    })
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Update product quantity
    const newQuantity = (product.quantity || 0) + parseInt(quantity)
    
    await db.collection('products').updateOne(
      { _id: new ObjectId(productId) },
      { 
        $set: { 
          quantity: newQuantity,
          updatedAt: new Date()
        }
      }
    )

    // Create stock log entry
    const stockLog = {
      product_id: new ObjectId(productId),
      product_name: product.product_name,
      sku: product.sku,
      type: 'stock_in',
      quantity: parseInt(quantity),
      previous_quantity: product.quantity || 0,
      new_quantity: newQuantity,
      notes: notes,
      store_id: store_id ? new ObjectId(store_id) : null,
      user_id: new ObjectId(user._id),
      user_name: user.username,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await db.collection('stocklogs').insertOne(stockLog)

    // Get updated product
    const updatedProduct = await db.collection('products').findOne({ 
      _id: new ObjectId(productId) 
    })

    res.status(200).json({
      success: true,
      message: 'Stock added successfully',
      product: updatedProduct,
      stockLog
    })
  } catch (error) {
    console.error('Stock in error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to add stock' })
    }
  }
}
