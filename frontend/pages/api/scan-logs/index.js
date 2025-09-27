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
  const { method } = req

  try {
    // Authenticate user
    const user = await authenticateToken(req)

    switch (method) {
      case 'GET':
        try {
          const { session_id = 'mobile-session' } = req.query
          
          const result = await query(
            'SELECT * FROM scan_logs WHERE user_id = $1 ORDER BY last_scanned DESC',
            [user.id]
          )
          
          res.status(200).json(result.rows)
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
          const productResult = await query('SELECT * FROM products WHERE sku = $1', [sku])
          if (productResult.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' })
          }

          const product = productResult.rows[0]

          // Check if scan log already exists
          const existingLogResult = await query(
            'SELECT * FROM scan_logs WHERE user_id = $1 AND sku = $2',
            [user.id, sku]
          )

          let scanLog
          if (existingLogResult.rows.length > 0) {
            // Update existing log
            const existingLog = existingLogResult.rows[0]
            const newQuantity = existingLog.quantity + quantity
            const newScanCount = existingLog.scan_count + 1
            
            const updateResult = await query(`
              UPDATE scan_logs 
              SET quantity = $1, scan_count = $2, last_scanned = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
              WHERE id = $3
              RETURNING *
            `, [newQuantity, newScanCount, existingLog.id])
            
            scanLog = updateResult.rows[0]
          } else {
            // Create new log
            const insertResult = await query(`
              INSERT INTO scan_logs (sku, product_name, quantity, price, category, user_id, session_id, scan_count)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING *
            `, [
              product.sku,
              product.product_name,
              quantity,
              product.price || 0,
              product.category || '',
              user.id,
              session_id,
              1
            ])
            
            scanLog = insertResult.rows[0]
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
          const result = await query('DELETE FROM scan_logs WHERE user_id = $1', [user.id])
          
          res.status(200).json({ 
            message: `Deleted ${result.rowCount} scan logs` 
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