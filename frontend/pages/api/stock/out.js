import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-key-2024-production')
    
    const userResult = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.id])

    if (userResult.rows.length === 0) {
      throw new Error('Invalid token or user inactive')
    }

    return userResult.rows[0]
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
    
    const { productId, quantity, notes = '', store_id = null } = req.body

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Product ID and valid quantity are required' })
    }

    // Find product
    const productResult = await query('SELECT * FROM products WHERE id = $1', [productId])
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const product = productResult.rows[0]
    const currentQuantity = product.quantity || 0
    
    if (currentQuantity < quantity) {
      return res.status(400).json({ 
        message: `Insufficient stock. Available: ${currentQuantity}, Requested: ${quantity}` 
      })
    }

    // Update product quantity
    const newQuantity = currentQuantity - parseInt(quantity)
    
    await query(
      'UPDATE products SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newQuantity, productId]
    )

    // Create stock log entry
    await query(`
      INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, store_id, user_id, user_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      productId,
      product.product_name,
      product.sku,
      'stock_out',
      parseInt(quantity),
      currentQuantity,
      newQuantity,
      notes,
      store_id,
      user.id,
      user.username
    ])

    // Get updated product
    const updatedProductResult = await query('SELECT * FROM products WHERE id = $1', [productId])

    res.status(200).json({
      success: true,
      message: 'Stock removed successfully',
      product: updatedProductResult.rows[0]
    })
  } catch (error) {
    console.error('Stock out error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to remove stock' })
    }
  }
}