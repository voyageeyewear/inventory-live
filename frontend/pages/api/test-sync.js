import { query } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Create a test sync log entry for today
    await query(`
      INSERT INTO stock_logs (product_id, product_name, sku, type, quantity, previous_quantity, new_quantity, notes, user_id, user_name, created_at)
      VALUES (1, 'Test Product', 'TEST-SYNC', 'sync', 10, 10, 10, 'Test sync operation for dashboard', 1, 'admin', CURRENT_TIMESTAMP)
    `)

    res.status(200).json({ 
      success: true, 
      message: 'Test sync log created successfully' 
    })
  } catch (error) {
    console.error('Test sync error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create test sync: ' + error.message 
    })
  }
}
