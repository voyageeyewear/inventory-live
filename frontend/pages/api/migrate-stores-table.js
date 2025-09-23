import { query } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Check if shopify_domain column exists
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stores' AND column_name = 'shopify_domain'
    `)

    if (columnCheck.rows.length === 0) {
      // Add shopify_domain column
      await query(`
        ALTER TABLE stores 
        ADD COLUMN shopify_domain VARCHAR(255)
      `)

      // Update existing records to set shopify_domain from store_domain
      await query(`
        UPDATE stores 
        SET shopify_domain = CASE 
          WHEN store_domain LIKE '%.myshopify.com' THEN store_domain
          ELSE store_domain || '.myshopify.com'
        END
        WHERE shopify_domain IS NULL
      `)

      console.log('Added shopify_domain column and updated existing records')
    }

    // Check if access_token column exists
    const tokenCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stores' AND column_name = 'access_token'
    `)

    if (tokenCheck.rows.length === 0) {
      // Add access_token column
      await query(`
        ALTER TABLE stores 
        ADD COLUMN access_token TEXT
      `)

      console.log('Added access_token column')
    }

    // Check if connected column exists
    const connectedCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stores' AND column_name = 'connected'
    `)

    if (connectedCheck.rows.length === 0) {
      // Add connected column
      await query(`
        ALTER TABLE stores 
        ADD COLUMN connected BOOLEAN DEFAULT false
      `)

      console.log('Added connected column')
    }

    // Get current table structure
    const tableInfo = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'stores'
      ORDER BY ordinal_position
    `)

    res.status(200).json({
      success: true,
      message: 'Stores table migration completed',
      columns: tableInfo.rows
    })
  } catch (error) {
    console.error('Error migrating stores table:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to migrate stores table',
      error: error.message
    })
  }
}
