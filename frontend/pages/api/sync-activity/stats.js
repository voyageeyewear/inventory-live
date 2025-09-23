import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Get current date for time-based calculations
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Initialize stats object
    const stats = {
      total_activities: 0,
      today_activities: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      pending_syncs: 0,
      total_products_synced: 0,
      total_stock_movements: 0,
      total_barcode_scans: 0,
      total_mobile_activities: 0,
      average_sync_time: 250, // Mock value
      last_sync_time: null,
      sync_success_rate: 0,
      most_active_user: null,
      most_synced_product: null,
      hourly_activity: [],
      daily_activity: [],
      activity_by_type: [],
      activity_by_status: [],
      // Consolidation stats
      total_duplicates_consolidated: 0,
      total_quantity_changes: 0,
      average_duplicates_per_sku: 0
    }

    // Get stock logs statistics
    try {
      const stockStatsResult = await query(`
        SELECT 
          COUNT(*) as total_stock_activities,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today_stock_activities,
          COUNT(CASE WHEN type = 'sync' AND (notes NOT LIKE '%FAILED%' AND notes NOT LIKE '%ERROR%') THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN type = 'sync' AND (notes LIKE '%FAILED%' OR notes LIKE '%ERROR%') THEN 1 END) as failed_syncs,
          COUNT(CASE WHEN type = 'sync' THEN 1 END) as total_syncs,
          COUNT(CASE WHEN type IN ('stock_in', 'stock_out', 'adjustment') THEN 1 END) as stock_movements,
          COUNT(DISTINCT CASE WHEN type = 'sync' AND product_id IS NOT NULL THEN product_id END) as products_synced,
          MAX(CASE WHEN type = 'sync' THEN created_at END) as last_sync_time
        FROM stock_logs
      `, [today.toISOString()])

      const stockStats = stockStatsResult.rows[0]
      stats.total_activities = parseInt(stockStats.total_stock_activities)
      stats.today_activities = parseInt(stockStats.today_stock_activities)
      stats.successful_syncs = parseInt(stockStats.successful_syncs)
      stats.failed_syncs = parseInt(stockStats.failed_syncs)
      stats.total_products_synced = parseInt(stockStats.products_synced)
      stats.total_stock_movements = parseInt(stockStats.stock_movements)
      stats.last_sync_time = stockStats.last_sync_time

      // Calculate sync success rate
      const totalSyncs = parseInt(stockStats.total_syncs)
      if (totalSyncs > 0) {
        stats.sync_success_rate = (stats.successful_syncs / totalSyncs) * 100
      }
    } catch (error) {
      console.error('Error fetching stock logs stats:', error)
    }

    // Get scan logs statistics
    try {
      const scanStatsResult = await query(`
        SELECT 
          COUNT(*) as total_scans,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today_scans
        FROM scan_logs
      `, [today.toISOString()])

      const scanStats = scanStatsResult.rows[0]
      stats.total_activities += parseInt(scanStats.total_scans)
      stats.today_activities += parseInt(scanStats.today_scans)
      stats.total_barcode_scans = parseInt(scanStats.total_scans)
    } catch (error) {
      console.error('Error fetching scan logs stats:', error)
    }

    // Get most active user
    try {
      const userStatsResult = await query(`
        SELECT user_name, COUNT(*) as activity_count
        FROM stock_logs 
        WHERE user_name IS NOT NULL
        GROUP BY user_name
        ORDER BY activity_count DESC
        LIMIT 1
      `)

      if (userStatsResult.rows.length > 0) {
        stats.most_active_user = userStatsResult.rows[0].user_name
      }
    } catch (error) {
      console.error('Error fetching most active user:', error)
    }

    // Get most synced product
    try {
      const productStatsResult = await query(`
        SELECT product_name, COUNT(*) as sync_count
        FROM stock_logs 
        WHERE type = 'sync' AND product_name IS NOT NULL
        GROUP BY product_name
        ORDER BY sync_count DESC
        LIMIT 1
      `)

      if (productStatsResult.rows.length > 0) {
        stats.most_synced_product = productStatsResult.rows[0].product_name
      }
    } catch (error) {
      console.error('Error fetching most synced product:', error)
    }

    // Get activity by type
    try {
      const typeStatsResult = await query(`
        SELECT 
          CASE 
            WHEN type IN ('stock_in', 'stock_out', 'adjustment') THEN 'stock_movement'
            WHEN type = 'sync' THEN 'product_sync'
            ELSE 'system_event'
          END as activity_type,
          COUNT(*) as count
        FROM stock_logs
        GROUP BY 
          CASE 
            WHEN type IN ('stock_in', 'stock_out', 'adjustment') THEN 'stock_movement'
            WHEN type = 'sync' THEN 'product_sync'
            ELSE 'system_event'
          END
      `)

      stats.activity_by_type = typeStatsResult.rows.map(row => ({
        type: row.activity_type,
        count: parseInt(row.count)
      }))

      // Add barcode scans if we have them
      if (stats.total_barcode_scans > 0) {
        stats.activity_by_type.push({
          type: 'barcode_scan',
          count: stats.total_barcode_scans
        })
      }
    } catch (error) {
      console.error('Error fetching activity by type:', error)
      stats.activity_by_type = []
    }

    // Get activity by status
    try {
      const statusStatsResult = await query(`
        SELECT 
          CASE 
            WHEN notes LIKE '%FAILED%' OR notes LIKE '%ERROR%' THEN 'failed'
            ELSE 'success'
          END as status,
          COUNT(*) as count
        FROM stock_logs
        GROUP BY 
          CASE 
            WHEN notes LIKE '%FAILED%' OR notes LIKE '%ERROR%' THEN 'failed'
            ELSE 'success'
          END
      `)

      stats.activity_by_status = statusStatsResult.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count)
      }))
    } catch (error) {
      console.error('Error fetching activity by status:', error)
      stats.activity_by_status = []
    }

    // Get hourly activity for today
    try {
      const hourlyStatsResult = await query(`
        SELECT 
          EXTRACT(hour FROM created_at) as hour,
          COUNT(*) as count
        FROM stock_logs
        WHERE created_at >= $1
        GROUP BY EXTRACT(hour FROM created_at)
        ORDER BY hour
      `, [today.toISOString()])

      stats.hourly_activity = hourlyStatsResult.rows.map(row => ({
        hour: parseInt(row.hour),
        count: parseInt(row.count)
      }))
    } catch (error) {
      console.error('Error fetching hourly activity:', error)
      stats.hourly_activity = []
    }

    // Get daily activity for last 7 days
    try {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const dailyStatsResult = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM stock_logs
        WHERE created_at >= $1
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
      `, [sevenDaysAgo.toISOString()])

      stats.daily_activity = dailyStatsResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      }))
    } catch (error) {
      console.error('Error fetching daily activity:', error)
      stats.daily_activity = []
    }

    // Get consolidation statistics
    try {
      const consolidationStatsResult = await query(`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(DISTINCT sku) as unique_skus,
          SUM(quantity) as total_quantity_changes,
          AVG(quantity) as avg_quantity_per_entry
        FROM stock_logs
        WHERE sku IS NOT NULL AND quantity IS NOT NULL
      `)

      if (consolidationStatsResult.rows.length > 0) {
        const consolidationStats = consolidationStatsResult.rows[0]
        stats.total_quantity_changes = parseInt(consolidationStats.total_quantity_changes) || 0
        
        // Calculate duplicates consolidated (total entries - unique SKUs)
        const totalEntries = parseInt(consolidationStats.total_entries) || 0
        const uniqueSkus = parseInt(consolidationStats.unique_skus) || 0
        stats.total_duplicates_consolidated = Math.max(0, totalEntries - uniqueSkus)
        
        // Calculate average duplicates per SKU
        if (uniqueSkus > 0) {
          stats.average_duplicates_per_sku = totalEntries / uniqueSkus
        }
      }
    } catch (error) {
      console.error('Error fetching consolidation stats:', error)
    }

    res.status(200).json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error fetching sync activity stats:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync activity stats',
      error: error.message
    })
  }
}