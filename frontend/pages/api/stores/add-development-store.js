import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Development store credentials (replace with your actual development store)
    const developmentStore = {
      store_name: 'Development Store',
      store_domain: 'tryongoeye.myshopify.com',
      shopify_domain: 'tryongoeye.myshopify.com',
      access_token: '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' // Replace with your actual token
    }

    // Check if development store already exists
    const existingStore = await query(
      'SELECT id FROM stores WHERE shopify_domain = $1',
      [developmentStore.shopify_domain]
    )

    if (existingStore.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Development store already exists'
      })
    }

    // Test connection first
    try {
      const testResponse = await fetch(`https://${developmentStore.shopify_domain}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': developmentStore.access_token,
          'Content-Type': 'application/json'
        }
      })

      if (!testResponse.ok) {
        return res.status(400).json({
          success: false,
          message: 'Failed to connect to development store. Please check credentials.'
        })
      }
    } catch (testError) {
      return res.status(400).json({
        success: false,
        message: 'Failed to connect to development store',
        error: testError.message
      })
    }

    // Insert development store
    const result = await query(`
      INSERT INTO stores (store_name, store_domain, shopify_domain, access_token, connected, created_at, updated_at)
      VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      developmentStore.store_name,
      developmentStore.store_domain,
      developmentStore.shopify_domain,
      developmentStore.access_token
    ])

    res.status(201).json({
      success: true,
      message: 'Development store added successfully',
      store: result.rows[0]
    })
  } catch (error) {
    console.error('Error adding development store:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to add development store',
      error: error.message
    })
  }
}