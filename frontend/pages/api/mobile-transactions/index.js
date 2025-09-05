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
  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    if (req.method === 'GET') {
      // Get all pending mobile transactions
      const result = await query(`
        SELECT 
          mt.*,
          p.product_name,
          p.image_url,
          p.category,
          p.quantity as current_stock
        FROM mobile_transactions mt
        LEFT JOIN products p ON mt.product_id = p.id
        WHERE mt.status = 'pending'
        ORDER BY mt.created_at DESC
      `)

      res.status(200).json({
        success: true,
        data: result.rows
      })
    } else if (req.method === 'POST') {
      // Create new pending mobile transaction
      const { sku, quantity, notes = '', transaction_type } = req.body

      if (!sku || !quantity || quantity <= 0 || !transaction_type) {
        return res.status(400).json({ message: 'SKU, valid quantity, and transaction type are required' })
      }

      // Find product by SKU
      const productResult = await query('SELECT * FROM products WHERE sku = $1 AND is_active = true', [sku])
      
      if (productResult.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found' })
      }

      const product = productResult.rows[0]

      // Check if stock out is possible
      if (transaction_type === 'stock_out' && product.quantity < quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock. Available: ${product.quantity}, Requested: ${quantity}` 
        })
      }

      // Create pending mobile transaction
      const result = await query(`
        INSERT INTO mobile_transactions 
        (product_id, sku, transaction_type, quantity, notes, requested_by_user_id, requested_by_username, status, current_stock)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        product.id,
        sku,
        transaction_type,
        parseInt(quantity),
        notes,
        user.id,
        user.username,
        'pending',
        product.quantity
      ])

      res.status(201).json({
        success: true,
        message: 'Transaction submitted for approval',
        data: result.rows[0]
      })
    } else {
      res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Mobile transactions error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to process request' })
    }
  }
}
