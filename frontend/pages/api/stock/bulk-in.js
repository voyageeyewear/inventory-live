import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'
import formidable from 'formidable'
import fs from 'fs'
import csv from 'csv-parser'

// Disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
}

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
    
    // Parse form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    })

    const [fields, files] = await form.parse(req)
    const csvFile = files.csv?.[0]

    if (!csvFile) {
      return res.status(400).json({ message: 'No CSV file provided' })
    }

    // Read and parse CSV
    const csvData = []
    const filePath = csvFile.filepath

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Handle different column name variations
          const sku = row.SKU || row.sku || row.Sku
          const quantity = row.Quantity || row.quantity || row.qty || row.Qty
          
          if (sku && quantity && !isNaN(parseInt(quantity))) {
            csvData.push({
              sku: sku.trim(),
              quantity: parseInt(quantity)
            })
          }
        })
        .on('end', resolve)
        .on('error', reject)
    })

    if (csvData.length === 0) {
      return res.status(400).json({ 
        message: 'No valid data found in CSV. Expected columns: SKU, Quantity' 
      })
    }

    const results = {
      processed: 0,
      errors: [],
      success: []
    }

    // Process each row
    for (const row of csvData) {
      try {
        // Find product by SKU
        const productResult = await query(
          'SELECT * FROM products WHERE sku = $1 AND is_active = true', 
          [row.sku]
        )
        
        if (productResult.rows.length === 0) {
          results.errors.push(`Product not found: ${row.sku}`)
          continue
        }

        const product = productResult.rows[0]
        const previousQuantity = product.quantity || 0
        const newQuantity = previousQuantity + row.quantity

        // Update product quantity
        await query(
          'UPDATE products SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newQuantity, product.id]
        )

        // Create stock log entry
        await query(`
          INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          product.id,
          product.product_name,
          product.sku,
          'stock_in',
          row.quantity,
          previousQuantity,
          newQuantity,
          'Bulk stock-in via CSV upload',
          user.id,
          user.username
        ])

        results.processed++
        results.success.push(`${row.sku}: +${row.quantity} (${previousQuantity} → ${newQuantity})`)
      } catch (error) {
        console.error(`Error processing ${row.sku}:`, error)
        results.errors.push(`${row.sku}: ${error.message}`)
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath)
    } catch (cleanupError) {
      console.error('File cleanup error:', cleanupError)
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.processed} stock-in entries`,
      count: results.processed,
      results: results
    })

  } catch (error) {
    console.error('Bulk stock-in error:', error)
    if (error.message === 'Authentication failed') {
      res.status(401).json({ message: 'Authentication required' })
    } else {
      res.status(500).json({ 
        message: 'Failed to process bulk stock-in',
        error: error.message 
      })
    }
  }
}
