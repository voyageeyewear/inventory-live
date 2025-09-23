import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Get all stores
      const result = await query(`
        SELECT id, store_name, store_domain, shopify_domain, access_token, connected, created_at, updated_at
        FROM stores 
        ORDER BY created_at DESC
      `)

      res.status(200).json(result.rows)
    } catch (error) {
      console.error('Error fetching stores:', error)
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch stores',
        error: error.message 
      })
    }
  } else if (req.method === 'POST') {
    try {
      const { store_name, store_domain, access_token } = req.body

      if (!store_name || !store_domain || !access_token) {
        return res.status(400).json({
          success: false,
          message: 'Store name, domain, and access token are required'
        })
      }

      // Clean up domain (remove https:// and trailing slashes)
      const cleanDomain = store_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const shopifyDomain = cleanDomain.includes('.myshopify.com') ? cleanDomain : `${cleanDomain}.myshopify.com`

      // Check if store already exists
      const existingStore = await query(
        'SELECT id FROM stores WHERE store_domain = $1 OR shopify_domain = $2',
        [cleanDomain, shopifyDomain]
      )

      if (existingStore.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Store with this domain already exists'
        })
      }

      // Test connection before adding (skip for development)
      if (!access_token.startsWith('dev_')) {
        try {
          const testResponse = await fetch(`https://${shopifyDomain}/admin/api/2023-10/shop.json`, {
            headers: {
              'X-Shopify-Access-Token': access_token,
              'Content-Type': 'application/json'
            }
          })

          if (!testResponse.ok) {
            return res.status(400).json({
              success: false,
              message: 'Invalid access token or store domain'
            })
          }
        } catch (testError) {
          return res.status(400).json({
            success: false,
            message: 'Failed to connect to Shopify store. Please check your credentials.'
          })
        }
      }

      // Insert new store (handle both name and store_name columns)
      const result = await query(`
        INSERT INTO stores (name, store_name, store_domain, shopify_domain, access_token, connected, created_at, updated_at)
        VALUES ($1, $1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [store_name, cleanDomain, shopifyDomain, access_token])

      res.status(201).json({
        success: true,
        message: 'Store added successfully',
        store: result.rows[0]
      })
    } catch (error) {
      console.error('Error adding store:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to add store',
        error: error.message
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}