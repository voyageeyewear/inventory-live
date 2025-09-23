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
    // Authenticate user (admin only)
    const user = await authenticateToken(req)
    
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const backupData = req.body
    
    if (!backupData.data) {
      return res.status(400).json({ message: 'Invalid backup format' })
    }

    let importedCount = 0
    const results = {
      products: 0,
      stores: 0,
      users: 0,
      stock_logs: 0,
      scan_logs: 0,
      mobile_activities: 0
    }

    // Import products
    if (backupData.data.products && Array.isArray(backupData.data.products)) {
      for (const product of backupData.data.products) {
        try {
          await query(`
            INSERT INTO products (sku, name, category, price, quantity, description, barcode, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (sku) DO UPDATE SET
              name = EXCLUDED.name,
              category = EXCLUDED.category,
              price = EXCLUDED.price,
              quantity = EXCLUDED.quantity,
              description = EXCLUDED.description,
              barcode = EXCLUDED.barcode,
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP
          `, [
            product.sku,
            product.name,
            product.category,
            product.price,
            product.quantity,
            product.description,
            product.barcode,
            product.is_active !== false,
            product.created_at || new Date().toISOString(),
            new Date().toISOString()
          ])
          results.products++
        } catch (error) {
          console.error('Failed to import product:', product.sku, error)
        }
      }
    }

    // Import stores
    if (backupData.data.stores && Array.isArray(backupData.data.stores)) {
      for (const store of backupData.data.stores) {
        try {
          await query(`
            INSERT INTO stores (store_name, store_url, access_token, connected, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (store_name) DO UPDATE SET
              store_url = EXCLUDED.store_url,
              access_token = EXCLUDED.access_token,
              connected = EXCLUDED.connected,
              updated_at = CURRENT_TIMESTAMP
          `, [
            store.store_name,
            store.store_url,
            store.access_token,
            store.connected !== false,
            store.created_at || new Date().toISOString(),
            new Date().toISOString()
          ])
          results.stores++
        } catch (error) {
          console.error('Failed to import store:', store.store_name, error)
        }
      }
    }

    // Import stock logs (recent ones only)
    if (backupData.data.stock_logs && Array.isArray(backupData.data.stock_logs)) {
      for (const log of backupData.data.stock_logs.slice(0, 1000)) { // Limit to 1000 recent logs
        try {
          await query(`
            INSERT INTO stock_logs (product_id, sku, type, quantity_change, previous_quantity, new_quantity, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            log.product_id,
            log.sku,
            log.type,
            log.quantity_change,
            log.previous_quantity,
            log.new_quantity,
            log.notes,
            log.created_at || new Date().toISOString(),
            log.updated_at || new Date().toISOString()
          ])
          results.stock_logs++
        } catch (error) {
          console.error('Failed to import stock log:', error)
        }
      }
    }

    importedCount = Object.values(results).reduce((sum, count) => sum + count, 0)

    res.status(200).json({
      success: true,
      message: `Successfully imported ${importedCount} records`,
      results: results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Import backup error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    if (error.message === 'Admin access required') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to import backup: ' + error.message 
    })
  }
}

