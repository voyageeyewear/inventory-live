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
  const { method } = req

  try {
    // Authenticate user
    const user = await authenticateToken(req)

    switch (method) {
      case 'GET':
        try {
          const result = await query(
            'SELECT * FROM stores WHERE is_active = true ORDER BY name ASC'
          )
          const stores = result.rows
          
          res.status(200).json(stores)
        } catch (error) {
          console.error('Get stores error:', error)
          res.status(500).json({ message: 'Failed to fetch stores' })
        }
        break

      case 'POST':
        try {
          const { store_name, store_domain, access_token, name, address, phone, email, manager } = req.body
          
          // Handle both Shopify store format and regular store format
          const storeName = store_name || name
          
          if (!storeName) {
            return res.status(400).json({ message: 'Store name is required' })
          }

          // For Shopify stores, also require domain and access token
          if (store_domain && !access_token) {
            return res.status(400).json({ message: 'Access token is required for Shopify stores' })
          }

          // Check if store already exists by name or domain
          let existingStoreResult
          if (store_domain) {
            existingStoreResult = await query(
              'SELECT id FROM stores WHERE LOWER(store_domain) = LOWER($1) OR LOWER(name) = LOWER($2)',
              [store_domain, storeName]
            )
          } else {
            existingStoreResult = await query(
              'SELECT id FROM stores WHERE LOWER(name) = LOWER($1)',
              [storeName]
            )
          }
          
          if (existingStoreResult.rows.length > 0) {
            return res.status(400).json({ message: 'Store with this name or domain already exists' })
          }

          // Test Shopify connection if it's a Shopify store
          let connected = false
          if (store_domain && access_token) {
            try {
              // Simple test to verify the access token works
              const testResponse = await fetch(`https://${store_domain}/admin/api/2023-10/shop.json`, {
                headers: {
                  'X-Shopify-Access-Token': access_token,
                  'Content-Type': 'application/json'
                }
              })
              
              if (testResponse.ok) {
                connected = true
              } else {
                console.log('Shopify connection test failed:', testResponse.status)
              }
            } catch (testError) {
              console.log('Shopify connection test error:', testError.message)
            }
          }

          const result = await query(`
            INSERT INTO stores (name, store_name, store_domain, access_token, connected, address, phone, email, manager_id, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
          `, [
            storeName, 
            storeName, 
            store_domain || null, 
            access_token || null, 
            connected,
            address || '', 
            phone || '', 
            email || '', 
            manager || null, 
            true, 
            user.id
          ])
          
          const store = result.rows[0]
          
          res.status(201).json({ 
            success: true, 
            message: connected ? 'Shopify store connected successfully' : 'Store added successfully', 
            store,
            connected 
          })
        } catch (error) {
          console.error('Create store error:', error)
          res.status(500).json({ message: 'Failed to create store: ' + error.message })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}
