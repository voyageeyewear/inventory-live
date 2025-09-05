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

    // Get comprehensive audit trail for this product
    const stockLogsResult = await query(`
      SELECT 
        sl.*,
        u.username as performed_by_user,
        u.email as user_email
      FROM stock_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      WHERE sl.product_id = $1 OR sl.sku = $2
      ORDER BY sl.created_at DESC 
      LIMIT 100
    `, [product.id, product.sku])

    // Get scan logs for this product
    const scanLogsResult = await query(`
      SELECT * FROM scan_logs 
      WHERE sku = $1
      ORDER BY created_at DESC 
      LIMIT 50
    `, [product.sku])

    // Get product update history (if we have an audit table for product changes)
    // For now, we'll simulate this with stock logs and add more detail
    const productChangesResult = await query(`
      SELECT 
        sl.*,
        u.username as performed_by_user,
        CASE 
          WHEN sl.type = 'stock_in' THEN 'Stock Added'
          WHEN sl.type = 'stock_out' THEN 'Stock Removed'
          WHEN sl.type = 'sync' THEN 'Synced to Store'
          WHEN sl.type = 'adjustment' THEN 'Manual Adjustment'
          WHEN sl.type = 'csv_upload' THEN 'CSV Import'
          ELSE UPPER(sl.type)
        END as change_type_display,
        CASE 
          WHEN sl.previous_quantity IS NOT NULL AND sl.new_quantity IS NOT NULL 
          THEN CONCAT('Changed from ', sl.previous_quantity, ' to ', sl.new_quantity, ' units')
          ELSE CONCAT('Quantity: ', sl.quantity, ' units')
        END as change_description
      FROM stock_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      WHERE sl.product_id = $1 OR sl.sku = $2
      ORDER BY sl.created_at DESC
    `, [product.id, product.sku])

    const auditData = {
      product: {
        id: product.id,
        sku: product.sku,
        product_name: product.product_name,
        current_quantity: product.quantity,
        price: product.price,
        category: product.category,
        description: product.description,
        image_url: product.image_url,
        created_at: product.created_at,
        updated_at: product.updated_at
      },
      changes_timeline: productChangesResult.rows.map(change => ({
        id: change.id,
        change_type: change.change_type_display,
        description: change.change_description,
        quantity_change: change.quantity,
        previous_quantity: change.previous_quantity,
        new_quantity: change.new_quantity,
        notes: change.notes,
        performed_by: change.performed_by_user || change.user_name || 'System',
        user_email: change.user_email,
        timestamp: change.created_at,
        formatted_date: new Date(change.created_at).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      })),
      stock_history: stockLogsResult.rows.map(log => ({
        id: log.id,
        type: log.type,
        quantity: log.quantity,
        previous_quantity: log.previous_quantity,
        new_quantity: log.new_quantity,
        notes: log.notes,
        user_name: log.performed_by_user || log.user_name,
        user_email: log.user_email,
        created_at: log.created_at
      })),
      scan_history: scanLogsResult.rows.map(scan => ({
        id: scan.id,
        quantity: scan.quantity,
        scan_count: scan.scan_count,
        last_scanned: scan.last_scanned,
        session_id: scan.session_id,
        created_at: scan.created_at,
        formatted_date: new Date(scan.created_at).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      })),
      summary: {
        total_changes: productChangesResult.rows.length,
        total_stock_changes: stockLogsResult.rows.length,
        total_scans: scanLogsResult.rows.length,
        last_change: productChangesResult.rows[0]?.created_at || null,
        last_stock_change: stockLogsResult.rows[0]?.created_at || null,
        last_scan: scanLogsResult.rows[0]?.last_scanned || null,
        quantity_trend: {
          initial_quantity: productChangesResult.rows[productChangesResult.rows.length - 1]?.previous_quantity || 0,
          current_quantity: product.quantity,
          net_change: product.quantity - (productChangesResult.rows[productChangesResult.rows.length - 1]?.previous_quantity || 0)
        }
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
