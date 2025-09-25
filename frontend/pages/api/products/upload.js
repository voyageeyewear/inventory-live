import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'
import formidable from 'formidable'
import fs from 'fs'
import csv from 'csv-parser'

// Disable default body parser for file uploads
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

// Parse CSV file and return products array
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const products = []
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Map CSV columns to our database schema
        // Expected CSV format: Title, Type, Variant SKU, Variant Inventory Qty, Image Src
        const product = {
          product_name: row['Title'] || row['title'] || '',
          category: row['Type'] || row['type'] || row['Category'] || row['category'] || 'General',
          sku: row['Variant SKU'] || row['variant_sku'] || row['SKU'] || row['sku'] || '',
          quantity: parseInt(row['Variant Inventory Qty'] || row['variant_inventory_qty'] || row['Quantity'] || row['quantity'] || '0'),
          price: parseFloat(row['Price'] || row['price'] || row['Variant Price'] || row['variant_price'] || '1999'), // Default price 1999 INR for eyeglasses
          description: row['Description'] || row['description'] || row['Title'] || row['title'] || '',
          image_url: row['Image Src'] || row['image_src'] || row['Image URL'] || row['image_url'] || ''
        }
        
        // Only add products with valid SKU and name
        if (product.sku && product.product_name) {
          products.push(product)
        }
      })
      .on('end', () => {
        resolve(products)
      })
      .on('error', (error) => {
        reject(error)
      })
  })
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
    const user = await authenticateToken(req)
    
    // Parse form data
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    })

    const [fields, files] = await form.parse(req)
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file
    
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    // Validate file type
    if (!file.originalFilename?.endsWith('.csv')) {
      // Clean up uploaded file
      fs.unlinkSync(file.filepath)
      return res.status(400).json({ message: 'Please upload a CSV file' })
    }

    // Parse CSV file
    const rawProducts = await parseCSV(file.filepath)
    
    // Clean up uploaded file
    fs.unlinkSync(file.filepath)

    if (rawProducts.length === 0) {
      return res.status(400).json({ message: 'No valid products found in CSV file' })
    }

    // Consolidate duplicate SKUs by combining quantities
    const productMap = new Map()
    
    for (const product of rawProducts) {
      if (productMap.has(product.sku)) {
        // SKU already exists, add quantities together
        const existing = productMap.get(product.sku)
        existing.quantity += product.quantity
        console.log(`Duplicate SKU ${product.sku}: Combined quantity ${existing.quantity}`)
      } else {
        // New SKU, add to map
        productMap.set(product.sku, { ...product })
      }
    }
    
    // Convert map back to array
    const products = Array.from(productMap.values())
    
    console.log(`Processed ${rawProducts.length} raw products into ${products.length} unique products`)

    // Insert products into database
    let successCount = 0
    let errorCount = 0
    const errors = []

    for (const product of products) {
      try {
        // Check if product with this SKU already exists
        const existingResult = await query('SELECT id FROM products WHERE sku = $1', [product.sku])
        
        if (existingResult.rows.length > 0) {
          // Update existing product and mark as synced (up to date)
          await query(`
            UPDATE products 
            SET product_name = $1, category = $2, price = $3, quantity = $4, 
                description = $5, image_url = $6, updated_at = CURRENT_TIMESTAMP,
                last_synced = CURRENT_TIMESTAMP, needs_sync = false
            WHERE sku = $7 AND is_active = true
          `, [
            product.product_name,
            product.category,
            product.price,
            product.quantity,
            product.description,
            product.image_url,
            product.sku
          ])
        } else {
          // Insert new product and mark as synced (up to date)
          await query(`
            INSERT INTO products (sku, product_name, category, price, quantity, description, image_url, is_active, created_at, updated_at, last_synced, needs_sync)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false)
          `, [
            product.sku,
            product.product_name,
            product.category,
            product.price,
            product.quantity,
            product.description,
            product.image_url
          ])
        }

        // Create audit log
        await query(`
          INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name, created_at)
          VALUES ((SELECT id FROM products WHERE sku = $1), $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        `, [
          product.sku,
          product.product_name,
          product.sku,
          'csv_upload',
          product.quantity,
          0,
          product.quantity,
          `CSV upload: ${product.product_name} - Sync status set to up-to-date`,
          user.id,
          user.username
        ])

        successCount++
      } catch (error) {
        console.error(`Error processing product ${product.sku}:`, error)
        errors.push(`${product.sku}: ${error.message}`)
        errorCount++
      }
    }

    const message = `CSV upload completed: ${successCount} products processed successfully. All products marked as up-to-date for sync.`
    const responseData = {
      success: true,
      message,
      count: successCount,
      total: products.length,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors.slice(0, 10) : [] // Limit error details
    }

    if (errorCount > 0) {
      responseData.message += `, ${errorCount} errors occurred`
    }

    res.status(200).json(responseData)
  } catch (error) {
    console.error('CSV upload error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to upload CSV: ' + error.message })
  }
}
