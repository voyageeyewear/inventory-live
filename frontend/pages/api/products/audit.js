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
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    await authenticateToken(req)
    
    const { productId, sku } = req.body
    
    if (!productId && !sku) {
      return res.status(400).json({ message: 'Product ID or SKU is required' })
    }

    // Get product details
    let product
    if (productId) {
      const result = await query('SELECT * FROM products WHERE id = $1 AND is_active = true', [productId])
      product = result.rows[0]
    } else {
      const result = await query('SELECT * FROM products WHERE sku = $1 AND is_active = true', [sku])
      product = result.rows[0]
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Get stock logs for this product
    const stockLogsResult = await query(`
      SELECT * FROM stock_logs 
      WHERE product_id = $1 OR sku = $2
      ORDER BY created_at DESC 
      LIMIT 50
    `, [product.id, product.sku])

    // Get scan logs for this product
    const scanLogsResult = await query(`
      SELECT * FROM scan_logs 
      WHERE sku = $1
      ORDER BY created_at DESC 
      LIMIT 20
    `, [product.sku])

    const auditData = {
      product: {
        id: product.id,
        sku: product.sku,
        product_name: product.product_name,
        current_quantity: product.quantity,
        price: product.price,
        category: product.category,
        created_at: product.created_at,
        updated_at: product.updated_at
      },
      stock_history: stockLogsResult.rows.map(log => ({
        id: log.id,
        type: log.type,
        quantity: log.quantity,
        previous_quantity: log.previous_quantity,
        new_quantity: log.new_quantity,
        notes: log.notes,
        user_name: log.user_name,
        created_at: log.created_at
      })),
      scan_history: scanLogsResult.rows.map(scan => ({
        id: scan.id,
        quantity: scan.quantity,
        scan_count: scan.scan_count,
        last_scanned: scan.last_scanned,
        session_id: scan.session_id,
        created_at: scan.created_at
      })),
      summary: {
        total_stock_changes: stockLogsResult.rows.length,
        total_scans: scanLogsResult.rows.length,
        last_stock_change: stockLogsResult.rows[0]?.created_at || null,
        last_scan: scanLogsResult.rows[0]?.last_scanned || null
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Audit data retrieved successfully',
      audit: auditData
    })
  } catch (error) {
    console.error('Audit product error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to get audit data: ' + error.message })
  }
}
