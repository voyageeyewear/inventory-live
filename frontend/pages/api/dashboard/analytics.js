import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      period = '30d' // 7d, 30d, 90d, 1y
    } = req.query

    // Calculate date range based on period
    let dateRange
    const now = new Date()
    switch (period) {
      case '7d':
        dateRange = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        dateRange = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        dateRange = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        dateRange = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        dateRange = new Date(startDate)
    }

    // Overview Statistics
    const overviewResult = await query(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
        (SELECT COUNT(*) FROM stores) as total_stores,
        (SELECT COUNT(*) FROM stores WHERE access_token IS NOT NULL AND access_token != '') as connected_stores,
        (SELECT COUNT(*) FROM stock_logs WHERE type = 'sync' AND created_at >= $1) as todays_syncs,
        (SELECT COUNT(*) FROM stock_logs WHERE type IN ('stock_in', 'stock_out', 'bulk_in', 'bulk_out') AND created_at >= $1) as todays_stock_changes,
        (SELECT COUNT(*) FROM products WHERE is_active = true AND quantity < 10) as low_stock_items,
        (SELECT SUM(quantity * COALESCE(price, 0)) FROM products WHERE is_active = true) as total_inventory_value
    `, [dateRange])

    // Sync Statistics
    const syncStatsResult = await query(`
      SELECT 
        COUNT(CASE WHEN type = 'sync' AND notes LIKE '%SUCCESS%' THEN 1 END) as sync_success,
        COUNT(CASE WHEN type = 'sync' AND (notes LIKE '%FAILED%' OR notes LIKE '%ERROR%') THEN 1 END) as sync_failed,
        COUNT(CASE WHEN type = 'sync' AND notes LIKE '%SKIPPED%' THEN 1 END) as sync_skipped,
        COUNT(CASE WHEN type = 'sync' THEN 1 END) as total_syncs
      FROM stock_logs 
      WHERE created_at >= $1
    `, [dateRange])

    // Stock Movement Statistics
    const stockStatsResult = await query(`
      SELECT 
        COUNT(CASE WHEN type IN ('stock_in', 'bulk_in') THEN 1 END) as stock_in_count,
        SUM(CASE WHEN type IN ('stock_in', 'bulk_in') THEN quantity ELSE 0 END) as stock_in_total,
        COUNT(CASE WHEN type IN ('stock_out', 'bulk_out') THEN 1 END) as stock_out_count,
        SUM(CASE WHEN type IN ('stock_out', 'bulk_out') THEN quantity ELSE 0 END) as stock_out_total,
        COUNT(CASE WHEN type = 'adjustment' THEN 1 END) as adjustment_count
      FROM stock_logs 
      WHERE created_at >= $1 AND type IN ('stock_in', 'stock_out', 'bulk_in', 'bulk_out', 'adjustment')
    `, [dateRange])

    // Daily Activity Chart Data
    const dailyActivityResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_activities,
        COUNT(CASE WHEN type = 'sync' THEN 1 END) as sync_activities,
        COUNT(CASE WHEN type IN ('stock_in', 'bulk_in') THEN 1 END) as stock_in_activities,
        COUNT(CASE WHEN type IN ('stock_out', 'bulk_out') THEN 1 END) as stock_out_activities,
        COUNT(CASE WHEN type = 'scan' THEN 1 END) as scan_activities
      FROM stock_logs 
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
      LIMIT 30
    `, [dateRange])

    // Hourly Activity (for today)
    const today = new Date().toISOString().split('T')[0]
    const hourlyActivityResult = await query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as activities,
        COUNT(CASE WHEN type = 'sync' THEN 1 END) as syncs,
        COUNT(CASE WHEN type IN ('stock_in', 'stock_out') THEN 1 END) as stock_changes
      FROM stock_logs 
      WHERE DATE(created_at) = $1
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [today])

    // Recent Activity
    const recentActivityResult = await query(`
      SELECT 
        sl.id, sl.type, sl.quantity, sl.notes, sl.user_name, sl.created_at,
        p.sku, p.product_name, p.quantity as current_quantity
      FROM stock_logs sl
      LEFT JOIN products p ON sl.product_id = p.id
      WHERE sl.created_at >= $1
      ORDER BY sl.created_at DESC
      LIMIT 50
    `, [dateRange])

    // Low Stock Products
    const lowStockResult = await query(`
      SELECT 
        id, sku, product_name, quantity, price, category,
        CASE 
          WHEN quantity = 0 THEN 'critical'
          WHEN quantity < 5 THEN 'low'
          WHEN quantity < 10 THEN 'warning'
          ELSE 'normal'
        END as stock_status
      FROM products 
      WHERE is_active = true AND quantity < 10
      ORDER BY quantity ASC
      LIMIT 20
    `)

    // Top Categories by Activity
    const topCategoriesResult = await query(`
      SELECT 
        p.category,
        COUNT(*) as activity_count,
        COUNT(CASE WHEN sl.type IN ('stock_in', 'bulk_in') THEN 1 END) as stock_in_count,
        COUNT(CASE WHEN sl.type IN ('stock_out', 'bulk_out') THEN 1 END) as stock_out_count,
        COUNT(CASE WHEN sl.type = 'sync' THEN 1 END) as sync_count
      FROM stock_logs sl
      LEFT JOIN products p ON sl.product_id = p.id
      WHERE sl.created_at >= $1 AND p.category IS NOT NULL
      GROUP BY p.category
      ORDER BY activity_count DESC
      LIMIT 10
    `, [dateRange])

    // CSV Upload Statistics
    const csvStatsResult = await query(`
      SELECT 
        COUNT(CASE WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' OR type IN ('bulk_in', 'bulk_out') THEN 1 END) as total_csv_uploads,
        COUNT(CASE WHEN notes LIKE '%consolidated%' OR notes LIKE '%duplicate%' THEN 1 END) as consolidated_uploads,
        COUNT(DISTINCT CASE WHEN notes LIKE '%CSV%' OR notes LIKE '%csv%' THEN 
          COALESCE(SUBSTRING(notes FROM 'CSV: ([^,)]+)'), SUBSTRING(notes FROM 'csv: ([^,)]+)'), 'Unknown')
        END) as unique_csv_files
      FROM stock_logs 
      WHERE created_at >= $1
    `, [dateRange])

    // User Activity
    const userActivityResult = await query(`
      SELECT 
        user_name,
        COUNT(*) as total_activities,
        COUNT(CASE WHEN type = 'sync' THEN 1 END) as sync_activities,
        COUNT(CASE WHEN type IN ('stock_in', 'bulk_in') THEN 1 END) as stock_in_activities,
        COUNT(CASE WHEN type IN ('stock_out', 'bulk_out') THEN 1 END) as stock_out_activities,
        MAX(created_at) as last_activity
      FROM stock_logs 
      WHERE created_at >= $1 AND user_name IS NOT NULL
      GROUP BY user_name
      ORDER BY total_activities DESC
      LIMIT 10
    `, [dateRange])

    // Transform data for response
    const overview = overviewResult.rows[0] || {}
    const syncStats = syncStatsResult.rows[0] || {}
    const stockStats = stockStatsResult.rows[0] || {}
    const csvStats = csvStatsResult.rows[0] || {}

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProducts: parseInt(overview.total_products) || 0,
          totalStores: parseInt(overview.total_stores) || 0,
          connectedStores: parseInt(overview.connected_stores) || 0,
          todaysSyncs: parseInt(overview.todays_syncs) || 0,
          todaysStockChanges: parseInt(overview.todays_stock_changes) || 0,
          lowStockItems: parseInt(overview.low_stock_items) || 0,
          totalInventoryValue: parseFloat(overview.total_inventory_value) || 0
        },
        syncStats: {
          syncSuccess: parseInt(syncStats.sync_success) || 0,
          syncFailed: parseInt(syncStats.sync_failed) || 0,
          syncSkipped: parseInt(syncStats.sync_skipped) || 0,
          totalSyncs: parseInt(syncStats.total_syncs) || 0
        },
        stockStats: {
          stockIn: {
            count: parseInt(stockStats.stock_in_count) || 0,
            totalChange: parseInt(stockStats.stock_in_total) || 0
          },
          stockOut: {
            count: parseInt(stockStats.stock_out_count) || 0,
            totalChange: parseInt(stockStats.stock_out_total) || 0
          },
          adjustments: {
            count: parseInt(stockStats.adjustment_count) || 0
          }
        },
        csvStats: {
          totalCsvUploads: parseInt(csvStats.total_csv_uploads) || 0,
          consolidatedUploads: parseInt(csvStats.consolidated_uploads) || 0,
          uniqueCsvFiles: parseInt(csvStats.unique_csv_files) || 0
        },
        charts: {
          dailyActivity: dailyActivityResult.rows.map(row => ({
            date: row.date,
            total: parseInt(row.total_activities) || 0,
            syncs: parseInt(row.sync_activities) || 0,
            stockIn: parseInt(row.stock_in_activities) || 0,
            stockOut: parseInt(row.stock_out_activities) || 0,
            scans: parseInt(row.scan_activities) || 0
          })),
          hourlyActivity: hourlyActivityResult.rows.map(row => ({
            hour: parseInt(row.hour) || 0,
            activities: parseInt(row.activities) || 0,
            syncs: parseInt(row.syncs) || 0,
            stockChanges: parseInt(row.stock_changes) || 0
          }))
        },
        recentActivity: recentActivityResult.rows.map(row => ({
          id: row.id,
          type: row.type,
          quantity: parseInt(row.quantity) || 0,
          notes: row.notes,
          user_name: row.user_name,
          created_at: row.created_at,
          sku: row.sku,
          product_name: row.product_name,
          current_quantity: parseInt(row.current_quantity) || 0
        })),
        lowStockProducts: lowStockResult.rows.map(row => ({
          id: row.id,
          sku: row.sku,
          product_name: row.product_name,
          quantity: parseInt(row.quantity) || 0,
          price: parseFloat(row.price) || 0,
          category: row.category,
          stock_status: row.stock_status
        })),
        topCategories: topCategoriesResult.rows.map(row => ({
          category: row.category,
          activityCount: parseInt(row.activity_count) || 0,
          stockInCount: parseInt(row.stock_in_count) || 0,
          stockOutCount: parseInt(row.stock_out_count) || 0,
          syncCount: parseInt(row.sync_count) || 0
        })),
        userActivity: userActivityResult.rows.map(row => ({
          userName: row.user_name,
          totalActivities: parseInt(row.total_activities) || 0,
          syncActivities: parseInt(row.sync_activities) || 0,
          stockInActivities: parseInt(row.stock_in_activities) || 0,
          stockOutActivities: parseInt(row.stock_out_activities) || 0,
          lastActivity: row.last_activity
        }))
      },
      filters: {
        startDate: dateRange.toISOString().split('T')[0],
        endDate,
        period
      }
    })

  } catch (error) {
    console.error('Dashboard analytics error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard analytics',
      error: error.message
    })
  }
}
