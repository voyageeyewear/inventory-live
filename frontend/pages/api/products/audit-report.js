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

    // Get quantity change history with detailed CSV information
    const quantityHistoryResult = await query(`
      SELECT 
        id, type, quantity, notes, user_name, created_at,
        CASE 
          WHEN type = 'stock_in' THEN 'increase'
          WHEN type = 'stock_out' THEN 'decrease'
          ELSE 'other'
        END as change_type,
        CASE 
          WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' OR notes LIKE '%bulk%' THEN true
          ELSE false
        END as is_csv_upload,
        CASE 
          WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' THEN 
            COALESCE(
              SUBSTRING(notes FROM 'CSV: ([^,)]+)'),
              SUBSTRING(notes FROM 'csv: ([^,)]+)'),
              SUBSTRING(notes FROM 'file: ([^,)]+)'),
              'Unknown CSV File'
            )
          ELSE NULL
        END as csv_filename,
        CASE 
          WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' THEN 
            COALESCE(
              SUBSTRING(notes FROM 'uploaded by ([^,)]+)'),
              SUBSTRING(notes FROM 'by ([^,)]+)'),
              user_name
            )
          ELSE user_name
        END as performed_by,
        CASE 
          WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' THEN 
            COALESCE(
              SUBSTRING(notes FROM 'row ([0-9]+)'),
              SUBSTRING(notes FROM 'line ([0-9]+)'),
              NULL
            )
          ELSE NULL
        END as csv_row_number,
        CASE 
          WHEN notes LIKE '%consolidated%' OR notes LIKE '%duplicate%' THEN true
          ELSE false
        END as is_consolidated,
        CASE 
          WHEN notes LIKE '%consolidated%' OR notes LIKE '%duplicate%' THEN 
            COALESCE(
              SUBSTRING(notes FROM '([0-9]+) duplicates'),
              SUBSTRING(notes FROM '([0-9]+) entries'),
              'Multiple'
            )
          ELSE NULL
        END as consolidation_count
      FROM stock_logs 
      WHERE product_id = $1 AND type IN ('stock_in', 'stock_out', 'adjustment', 'bulk_in', 'bulk_out')
      ORDER BY created_at DESC
      LIMIT 100
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

    // Get CSV upload sessions and batch information
    const csvSessionsResult = await query(`
      SELECT 
        DATE(created_at) as upload_date,
        DATE_TRUNC('hour', created_at) as upload_hour,
        user_name,
        type as upload_type,
        COUNT(*) as total_changes,
        SUM(CASE WHEN type = 'stock_in' OR type = 'bulk_in' THEN quantity ELSE 0 END) as total_stock_in,
        SUM(CASE WHEN type = 'stock_out' OR type = 'bulk_out' THEN quantity ELSE 0 END) as total_stock_out,
        MIN(created_at) as session_start,
        MAX(created_at) as session_end,
        CASE 
          WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' THEN 
            COALESCE(
              SUBSTRING(notes FROM 'CSV: ([^,)]+)'),
              SUBSTRING(notes FROM 'csv: ([^,)]+)'),
              SUBSTRING(notes FROM 'file: ([^,)]+)'),
              'Unknown CSV File'
            )
          ELSE NULL
        END as csv_filename,
        CASE 
          WHEN notes LIKE '%consolidated%' OR notes LIKE '%duplicate%' THEN true
          ELSE false
        END as has_consolidation
      FROM stock_logs 
      WHERE product_id = $1 
        AND (type IN ('bulk_in', 'bulk_out') OR notes LIKE '%CSV%' OR notes LIKE '%csv%')
      GROUP BY DATE(created_at), DATE_TRUNC('hour', created_at), user_name, type, 
               CASE WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' THEN 
                 COALESCE(SUBSTRING(notes FROM 'CSV: ([^,)]+)'), SUBSTRING(notes FROM 'csv: ([^,)]+)'), SUBSTRING(notes FROM 'file: ([^,)]+)'), 'Unknown CSV File')
               ELSE NULL END,
               CASE WHEN notes LIKE '%consolidated%' OR notes LIKE '%duplicate%' THEN true ELSE false END
      ORDER BY session_start DESC
      LIMIT 20
    `, [productId])

    // Get detailed audit timeline with enhanced information
    const auditTimelineResult = await query(`
      SELECT 
        id, type, quantity, notes, user_name, created_at,
        CASE 
          WHEN type = 'sync' THEN 'sync'
          WHEN type IN ('stock_in', 'bulk_in') THEN 'stock_in'
          WHEN type IN ('stock_out', 'bulk_out') THEN 'stock_out'
          WHEN type = 'adjustment' THEN 'adjustment'
          ELSE 'other'
        END as event_type,
        CASE 
          WHEN type = 'sync' THEN 
            CASE 
              WHEN notes LIKE '%FAILED%' OR notes LIKE '%ERROR%' THEN 'failed'
              WHEN notes LIKE '%SUCCESS%' THEN 'success'
              ELSE 'unknown'
            END
          ELSE NULL
        END as sync_status,
        CASE 
          WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' OR notes LIKE '%bulk%' THEN true
          ELSE false
        END as is_bulk_operation,
        CASE 
          WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' THEN 
            COALESCE(
              SUBSTRING(notes FROM 'CSV: ([^,)]+)'),
              SUBSTRING(notes FROM 'csv: ([^,)]+)'),
              SUBSTRING(notes FROM 'file: ([^,)]+)'),
              'Unknown CSV File'
            )
          ELSE NULL
        END as csv_filename,
        CASE 
          WHEN notes LIKE '%consolidated%' OR notes LIKE '%duplicate%' THEN true
          ELSE false
        END as is_consolidated,
        CASE 
          WHEN notes LIKE '%consolidated%' OR notes LIKE '%duplicate%' THEN 
            COALESCE(
              SUBSTRING(notes FROM '([0-9]+) duplicates'),
              SUBSTRING(notes FROM '([0-9]+) entries'),
              'Multiple'
            )
          ELSE NULL
        END as consolidation_count
      FROM stock_logs 
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT 200
    `, [productId])

    // Calculate enhanced statistics
    const csvStats = {
      totalCsvUploads: csvSessionsResult.rows.length,
      totalCsvChanges: csvSessionsResult.rows.reduce((sum, row) => sum + parseInt(row.total_changes), 0),
      csvUploadsWithConsolidation: csvSessionsResult.rows.filter(r => r.has_consolidation).length,
      lastCsvUpload: csvSessionsResult.rows.length > 0 ? csvSessionsResult.rows[0].session_start : null,
      uniqueCsvFiles: [...new Set(csvSessionsResult.rows.map(r => r.csv_filename).filter(f => f))].length
    }

    const timelineStats = {
      totalEvents: auditTimelineResult.rows.length,
      bulkOperations: auditTimelineResult.rows.filter(r => r.is_bulk_operation).length,
      consolidatedOperations: auditTimelineResult.rows.filter(r => r.is_consolidated).length,
      lastEvent: auditTimelineResult.rows.length > 0 ? auditTimelineResult.rows[0].created_at : null
    }

    res.status(200).json({
      success: true,
      product,
      auditReport: {
        syncHistory: syncHistoryResult.rows,
        quantityHistory: quantityHistoryResult.rows,
        scanHistory: scanHistoryResult.rows,
        mobileActivity: mobileActivityResult.rows,
        csvSessions: csvSessionsResult.rows,
        auditTimeline: auditTimelineResult.rows,
        statistics: {
          sync: syncStats,
          quantity: quantityStats,
          scan: scanStats,
          csv: csvStats,
          timeline: timelineStats,
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
