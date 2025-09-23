import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'DELETE') {
    try {
      // Check if store exists
      const storeCheck = await query('SELECT id FROM stores WHERE id = $1', [id])
      
      if (storeCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        })
      }

      // Delete the store
      await query('DELETE FROM stores WHERE id = $1', [id])

      res.status(200).json({
        success: true,
        message: 'Store deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting store:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to delete store',
        error: error.message
      })
    }
  } else if (req.method === 'PUT') {
    try {
      const { store_name, store_domain, access_token } = req.body

      if (!store_name || !store_domain || !access_token) {
        return res.status(400).json({
          success: false,
          message: 'Store name, domain, and access token are required'
        })
      }

      // Clean up domain
      const cleanDomain = store_domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const shopifyDomain = cleanDomain.includes('.myshopify.com') ? cleanDomain : `${cleanDomain}.myshopify.com`

      // Update the store
      const result = await query(`
        UPDATE stores 
        SET store_name = $1, store_domain = $2, shopify_domain = $3, access_token = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `, [store_name, cleanDomain, shopifyDomain, access_token, id])

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        })
      }

      res.status(200).json({
        success: true,
        message: 'Store updated successfully',
        store: result.rows[0]
      })
    } catch (error) {
      console.error('Error updating store:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update store',
        error: error.message
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
