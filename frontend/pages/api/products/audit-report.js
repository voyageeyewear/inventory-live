import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { productId } = req.query

  if (!productId) {
    return res.status(400).json({ message: 'Product ID is required' })
  }

  try {
    // Get product details
    const productResult = await query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    )

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const product = productResult.rows[0]

    // Get sync history from stock_logs
    const syncHistoryResult = await query(`
      SELECT 
        id, type, quantity, notes, user_name, created_at,
        CASE 
          WHEN notes LIKE '%FAILED%' OR notes LIKE '%ERROR%' THEN 'failed'
          WHEN notes LIKE '%SUCCESS%' OR notes LIKE '%SYNC%' THEN 'success'
          ELSE 'unknown'
        END as sync_status
      FROM stock_logs 
      WHERE product_id = $1 AND type = 'sync'
      ORDER BY created_at DESC
      LIMIT 50
    `, [productId])

    // Get quantity change history
    const quantityHistoryResult = await query(`
      SELECT 
        id, type, quantity, notes, user_name, created_at,
        CASE 
          WHEN type = 'stock_in' THEN 'increase'
          WHEN type = 'stock_out' THEN 'decrease'
          ELSE 'other'
        END as change_type
      FROM stock_logs 
      WHERE product_id = $1 AND type IN ('stock_in', 'stock_out', 'adjustment')
      ORDER BY created_at DESC
      LIMIT 50
    `, [productId])

    // Get scan history from scan_logs (check if table exists first)
    let scanHistoryResult = { rows: [] }
    try {
      scanHistoryResult = await query(`
        SELECT 
          id, 
          COALESCE(scan_type, 'scan') as scan_type, 
          COALESCE(quantity_scanned, quantity) as quantity_scanned, 
          notes, user_name, created_at
        FROM scan_logs 
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [productId])
    } catch (error) {
      console.log('Scan logs table may not exist or have different schema:', error.message)
      // If scan_logs doesn't exist or has different schema, return empty array
      scanHistoryResult = { rows: [] }
    }

    // Calculate statistics
    const syncStats = {
      totalSyncs: syncHistoryResult.rows.length,
      successfulSyncs: syncHistoryResult.rows.filter(r => r.sync_status === 'success').length,
      failedSyncs: syncHistoryResult.rows.filter(r => r.sync_status === 'failed').length,
      lastSyncDate: syncHistoryResult.rows.length > 0 ? syncHistoryResult.rows[0].created_at : null
    }

    const quantityStats = {
      totalChanges: quantityHistoryResult.rows.length,
      stockInCount: quantityHistoryResult.rows.filter(r => r.change_type === 'increase').length,
      stockOutCount: quantityHistoryResult.rows.filter(r => r.change_type === 'decrease').length,
      lastChangeDate: quantityHistoryResult.rows.length > 0 ? quantityHistoryResult.rows[0].created_at : null
    }

    const scanStats = {
      totalScans: scanHistoryResult.rows.length,
      lastScanDate: scanHistoryResult.rows.length > 0 ? scanHistoryResult.rows[0].created_at : null
    }

    // Get mobile activity for this product (check if table exists first)
    let mobileActivityResult = { rows: [] }
    try {
      mobileActivityResult = await query(`
        SELECT 
          id, activity_type, quantity, notes, user_name, created_at
        FROM mobile_activities 
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT 20
      `, [productId])
    } catch (error) {
      console.log('Mobile activities table may not exist:', error.message)
      // If mobile_activities doesn't exist, return empty array
      mobileActivityResult = { rows: [] }
    }

    res.status(200).json({
      success: true,
      product,
      auditReport: {
        syncHistory: syncHistoryResult.rows,
        quantityHistory: quantityHistoryResult.rows,
        scanHistory: scanHistoryResult.rows,
        mobileActivity: mobileActivityResult.rows,
        statistics: {
          sync: syncStats,
          quantity: quantityStats,
          scan: scanStats,
          mobile: {
            totalActivities: mobileActivityResult.rows.length,
            lastActivityDate: mobileActivityResult.rows.length > 0 ? mobileActivityResult.rows[0].created_at : null
          }
        }
      }
    })

  } catch (error) {
    console.error('Error fetching audit report:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit report',
      error: error.message
    })
  }
}
