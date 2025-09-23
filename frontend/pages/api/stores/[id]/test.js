import { query } from '../../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { id } = req.query

  try {
    // Get store details
    const storeResult = await query(
      'SELECT id, store_name, shopify_domain, access_token FROM stores WHERE id = $1',
      [id]
    )

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      })
    }

    const store = storeResult.rows[0]

    // Test connection to Shopify
    try {
      const response = await fetch(`https://${store.shopify_domain}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        // Update store as disconnected
        await query(
          'UPDATE stores SET connected = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [id]
        )

        return res.status(400).json({
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}`
        })
      }

      const shopData = await response.json()

      // Update store as connected
      await query(
        'UPDATE stores SET connected = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      )

      res.status(200).json({
        success: true,
        message: 'Connection successful',
        shop: {
          name: shopData.shop.name,
          domain: shopData.shop.domain,
          email: shopData.shop.email,
          plan: shopData.shop.plan_name
        }
      })
    } catch (connectionError) {
      console.error('Shopify connection error:', connectionError)

      // Update store as disconnected
      await query(
        'UPDATE stores SET connected = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      )

      res.status(400).json({
        success: false,
        message: 'Failed to connect to Shopify. Please check your access token and domain.',
        error: connectionError.message
      })
    }
  } catch (error) {
    console.error('Error testing store connection:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to test connection',
      error: error.message
    })
  }
}
