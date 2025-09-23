import { query } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Create stores table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        store_name VARCHAR(255) NOT NULL,
        store_domain VARCHAR(255) NOT NULL,
        shopify_domain VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        connected BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shopify_domain)
      )
    `)

    // Check if table exists and has data
    const tableCheck = await query(`
      SELECT COUNT(*) as count FROM stores
    `)

    res.status(200).json({
      success: true,
      message: 'Stores table setup completed',
      existing_stores: parseInt(tableCheck.rows[0].count)
    })
  } catch (error) {
    console.error('Error setting up stores table:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to setup stores table',
      error: error.message
    })
  }
}
