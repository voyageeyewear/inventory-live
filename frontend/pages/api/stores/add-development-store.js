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
    const user = await authenticateToken(req)
    
    // Development Store details from localhost
    const storeData = {
      store_name: 'Development Store',
      store_domain: 'tryongoeye.myshopify.com',
      access_token: process.env.DEVELOPMENT_STORE_ACCESS_TOKEN || req.body.access_token || 'REPLACE_WITH_YOUR_TOKEN'
    }

    if (!storeData.access_token || storeData.access_token === 'REPLACE_WITH_YOUR_TOKEN') {
      return res.status(400).json({ 
        message: 'Development Store access token not configured. Please set DEVELOPMENT_STORE_ACCESS_TOKEN environment variable or provide access_token in request body.' 
      })
    }

    // Check if store already exists
    const existingStoreResult = await query(
      'SELECT id FROM stores WHERE LOWER(store_domain) = LOWER($1) OR LOWER(name) = LOWER($2)',
      [storeData.store_domain, storeData.store_name]
    )
    
    if (existingStoreResult.rows.length > 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Development Store already exists',
        store: existingStoreResult.rows[0]
      })
    }

    // Test Shopify connection
    let connected = false
    try {
      console.log(`Testing connection to ${storeData.store_domain}...`)
      
      const testResponse = await fetch(`https://${storeData.store_domain}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': storeData.access_token,
          'Content-Type': 'application/json'
        }
      })

      if (testResponse.ok) {
        const shopData = await testResponse.json()
        connected = true
        console.log(`✅ Successfully connected to ${shopData.shop?.name || storeData.store_name}`)
      } else {
        console.log(`❌ Shopify connection test failed: ${testResponse.status} ${testResponse.statusText}`)
        const errorText = await testResponse.text()
        console.log('Error details:', errorText)
      }
    } catch (testError) {
      console.log(`❌ Shopify connection test error: ${testError.message}`)
    }

    // Insert store into database
    const result = await query(`
      INSERT INTO stores (name, store_name, store_domain, access_token, connected, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      storeData.store_name, 
      storeData.store_name, 
      storeData.store_domain, 
      storeData.access_token, 
      connected,
      true,
      user.id
    ])

    const store = result.rows[0]
    
    res.status(201).json({ 
      success: true, 
      message: connected ? 
        '✅ Development Store connected successfully!' : 
        '⚠️ Development Store added but connection failed (check API key)',
      store,
      connected,
      connectionTest: {
        attempted: true,
        successful: connected,
        domain: storeData.store_domain
      }
    })
  } catch (error) {
    console.error('Add Development Store error:', error)
    
    // Handle authentication errors
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    res.status(500).json({ message: 'Failed to add Development Store: ' + error.message })
  }
}
