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
    
    // Check permissions
    if (user.role !== 'admin' && !user.permissions?.includes('manageProducts')) {
      return res.status(403).json({ message: 'Insufficient permissions' })
    }

    const { products } = req.body
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ message: 'Products must be an array' })
    }

    let importedCount = 0
    let updatedCount = 0
    let errorCount = 0
    const errors = []

    for (const product of products) {
      try {
        // Validate required fields
        if (!product.sku || !product.name) {
          errors.push(`Product missing required fields: ${JSON.stringify(product)}`)
          errorCount++
          continue
        }

        // Check if product exists
        const existingProduct = await query('SELECT id FROM products WHERE sku = $1', [product.sku])
        
        if (existingProduct.rows.length > 0) {
          // Update existing product
          await query(`
            UPDATE products 
            SET name = $1, category = $2, price = $3, quantity = $4, 
                description = $5, barcode = $6, is_active = $7, 
                updated_at = CURRENT_TIMESTAMP,
                needs_sync = true, last_modified = CURRENT_TIMESTAMP
            WHERE sku = $8
          `, [
            product.name,
            product.category || 'General',
            parseFloat(product.price) || 0,
            parseInt(product.quantity) || 0,
            product.description || '',
            product.barcode || product.sku,
            product.is_active !== false,
            product.sku
          ])
          updatedCount++
        } else {
          // Insert new product
          await query(`
            INSERT INTO products (sku, name, category, price, quantity, description, barcode, is_active, created_at, updated_at, needs_sync, last_modified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP)
          `, [
            product.sku,
            product.name,
            product.category || 'General',
            parseFloat(product.price) || 0,
            parseInt(product.quantity) || 0,
            product.description || '',
            product.barcode || product.sku,
            product.is_active !== false
          ])
          importedCount++
        }
      } catch (error) {
        console.error('Failed to import product:', product.sku, error)
        errors.push(`Failed to import ${product.sku}: ${error.message}`)
        errorCount++
      }
    }

    const totalProcessed = importedCount + updatedCount + errorCount

    res.status(200).json({
      success: true,
      message: `Processed ${totalProcessed} products: ${importedCount} imported, ${updatedCount} updated, ${errorCount} errors`,
      results: {
        total_processed: totalProcessed,
        imported: importedCount,
        updated: updatedCount,
        errors: errorCount,
        error_details: errors.slice(0, 10) // Limit error details
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Import products error:', error)
    
    if (error.message === 'Authentication failed' || error.message === 'No token provided') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    if (error.message === 'Insufficient permissions') {
      return res.status(403).json({ message: 'Insufficient permissions' })
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to import products: ' + error.message 
    })
  }
}

