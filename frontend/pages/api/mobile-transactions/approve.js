import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-2024-secure-key')
    
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
    
    const { transactionId, action } = req.body // action: 'approve' or 'reject'

    if (!transactionId || !action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Transaction ID and valid action (approve/reject) are required' })
    }

    // Get the pending transaction
    const transactionResult = await query(`
      SELECT mt.*, p.product_name, p.quantity as current_product_quantity
      FROM mobile_transactions mt
      LEFT JOIN products p ON mt.product_id = p.id
      WHERE mt.id = $1 AND mt.status = 'pending'
    `, [transactionId])

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pending transaction not found' })
    }

    const transaction = transactionResult.rows[0]

    if (action === 'approve') {
      // Check current stock for stock_out operations
      if (transaction.transaction_type === 'stock_out' && transaction.current_product_quantity < transaction.quantity) {
        return res.status(400).json({ 
          message: `Cannot approve: Insufficient current stock. Available: ${transaction.current_product_quantity}, Requested: ${transaction.quantity}` 
        })
      }

      // Calculate new quantity
      let newQuantity
      if (transaction.transaction_type === 'stock_in') {
        newQuantity = transaction.current_product_quantity + transaction.quantity
      } else {
        newQuantity = transaction.current_product_quantity - transaction.quantity
      }

      // Update product quantity
      await query(
        'UPDATE products SET quantity = $1, updated_at = CURRENT_TIMESTAMP, needs_sync = true, last_modified = CURRENT_TIMESTAMP WHERE id = $2',
        [newQuantity, transaction.product_id]
      )

      // Create stock log entry
      await query(`
        INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        transaction.product_id,
        transaction.product_name,
        transaction.sku,
        transaction.transaction_type,
        transaction.quantity,
        transaction.current_product_quantity,
        newQuantity,
        `Mobile transaction approved. Original notes: ${transaction.notes}`,
        user.id,
        user.username
      ])

      // Update transaction status
      await query(
        'UPDATE mobile_transactions SET status = $1, approved_by_user_id = $2, approved_by_username = $3, approved_at = CURRENT_TIMESTAMP WHERE id = $4',
        ['approved', user.id, user.username, transactionId]
      )

      res.status(200).json({
        success: true,
        message: 'Transaction approved and processed successfully',
        data: {
          transactionId,
          newQuantity,
          previousQuantity: transaction.current_product_quantity
        }
      })
    } else {
      // Reject transaction
      await query(
        'UPDATE mobile_transactions SET status = $1, approved_by_user_id = $2, approved_by_username = $3, approved_at = CURRENT_TIMESTAMP WHERE id = $4',
        ['rejected', user.id, user.username, transactionId]
      )

      res.status(200).json({
        success: true,
        message: 'Transaction rejected successfully'
      })
    }
  } catch (error) {
    console.error('Mobile transaction approval error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ message: 'Failed to process approval' })
    }
  }
}
