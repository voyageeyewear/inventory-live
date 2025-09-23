import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('Access token required')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const userResult = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.userId])
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found or inactive')
    }
    
    return userResult.rows[0]
  } catch (error) {
    console.error('Authentication error:', error.message)
    throw new Error('Invalid or expired token')
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { startDate, endDate, period = 'today' } = req.query

    // Calculate date range
    let dateFilter = ''
    let queryParams = []
    
    if (startDate && endDate) {
      dateFilter = 'AND DATE(created_at) BETWEEN $1 AND $2'
      queryParams = [startDate, endDate]
    } else {
      // Default to today if no dates provided
      const today = new Date().toISOString().split('T')[0]
      dateFilter = 'AND DATE(created_at) = $1'
      queryParams = [today]
    }

    console.log('Reports API - Query params:', queryParams)

    // Overview Statistics
    let overview
    try {
      const overviewQuery = `
        SELECT 
          (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
          (SELECT COALESCE(SUM(quantity), 0) FROM products WHERE is_active = true) as total_quantity,
          (SELECT COUNT(*) FROM stock_logs WHERE created_at::date BETWEEN $1 AND $2) as transactions,
          (SELECT COUNT(*) FROM products WHERE quantity <= 10 AND is_active = true) as low_stock,
          (SELECT COUNT(*) FROM products WHERE quantity = 0 AND is_active = true) as out_of_stock,
          (SELECT COUNT(DISTINCT user_name) FROM stock_logs WHERE created_at::date BETWEEN $1 AND $2) as active_users,
          (SELECT COUNT(*) FROM scan_logs WHERE created_at::date BETWEEN $1 AND $2) as recent_scans
      `
      const overviewResult = await query(overviewQuery, queryParams)
      overview = overviewResult.rows[0]
    } catch (error) {
      console.error('Overview query error:', error)
      throw new Error(`Failed to fetch overview statistics: ${error.message}`)
    }

    // Sync Reports
    let syncReports
    try {
      const syncReportsQuery = `
        SELECT 
          COUNT(*) as total_syncs,
          COUNT(CASE WHEN notes LIKE '%Successfully synced%' THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN notes LIKE '%FAILED%' OR notes LIKE '%Error:%' THEN 1 END) as failed_syncs,
          COUNT(CASE WHEN notes LIKE '%BULK SYNC%' AND notes NOT LIKE '%FAILED%' THEN 1 END) as pending_syncs,
          AVG(CASE 
            WHEN notes LIKE '%Duration:%' THEN 
              CAST(SUBSTRING(notes FROM 'Duration: ([0-9.]+)s') AS NUMERIC)
            ELSE NULL 
          END) as average_sync_time,
          MAX(created_at) as last_sync_time
        FROM stock_logs 
        WHERE type = 'sync' AND created_at::date BETWEEN $1 AND $2
      `
      const syncReportsResult = await query(syncReportsQuery, queryParams)
      syncReports = syncReportsResult.rows[0]
    } catch (error) {
      console.error('Sync reports query error:', error)
      throw new Error(`Failed to fetch sync reports: ${error.message}`)
    }
    
    // Calculate sync success rate
    const syncSuccessRate = syncReports.total_syncs > 0 
      ? (syncReports.successful_syncs / syncReports.total_syncs) * 100 
      : 0

    // Get stores with sync issues
    const storesWithIssuesQuery = `
      SELECT COUNT(DISTINCT 
        CASE WHEN notes LIKE '%store:%' THEN 
          SUBSTRING(notes FROM 'store: ([^)]+)')
        END
      ) as stores_with_issues
      FROM stock_logs 
      WHERE type = 'sync' 
      AND (notes LIKE '%FAILED%' OR notes LIKE '%Error:%')
      AND created_at::date BETWEEN $1 AND $2
    `
    const storesWithIssuesResult = await query(storesWithIssuesQuery, queryParams)

    // Daily Activity
    const dailyActivityQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN type = 'sync' THEN 1 END) as syncs,
        COUNT(CASE WHEN type = 'stock_in' THEN 1 END) as stock_in,
        COUNT(CASE WHEN type = 'stock_out' THEN 1 END) as stock_out,
        COUNT(CASE WHEN type = 'scan' THEN 1 END) as scans,
        COUNT(*) as total
      FROM stock_logs 
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
      LIMIT 30
    `
    const dailyActivityResult = await query(dailyActivityQuery, queryParams)

    // Most Selling Products (based on stock_out activities)
    const mostSellingQuery = `
      SELECT 
        sl.sku,
        sl.product_name,
        COALESCE(SUM(sl.quantity), 0) as total_sold,
        COALESCE(SUM(sl.quantity * COALESCE(p.price, 0)), 0) as total_revenue,
        p.category,
        MAX(sl.created_at) as last_sale_date
      FROM stock_logs sl
      LEFT JOIN products p ON sl.sku = p.sku
      WHERE sl.type = 'stock_out' 
      AND sl.created_at::date BETWEEN $1 AND $2
      GROUP BY sl.sku, sl.product_name, p.category
      ORDER BY total_sold DESC
      LIMIT 10
    `
    const mostSellingResult = await query(mostSellingQuery, queryParams)

    // Least Selling Products
    const leastSellingQuery = `
      SELECT 
        p.sku,
        p.product_name,
        COALESCE(SUM(CASE WHEN sl.type = 'stock_out' THEN sl.quantity ELSE 0 END), 0) as total_sold,
        p.category,
        COALESCE(MAX(sl.created_at), p.created_at) as last_sale_date,
        EXTRACT(DAYS FROM NOW() - COALESCE(MAX(sl.created_at), p.created_at)) as days_since_last_sale
      FROM products p
      LEFT JOIN stock_logs sl ON p.sku = sl.sku
      WHERE p.is_active = true
      AND (sl.created_at::date BETWEEN $1 AND $2 OR sl.created_at IS NULL)
      GROUP BY p.sku, p.product_name, p.category, p.created_at
      ORDER BY total_sold ASC, days_since_last_sale DESC
      LIMIT 10
    `
    const leastSellingResult = await query(leastSellingQuery, queryParams)

    // Sync Timeline (Recent sync operations)
    const syncTimelineQuery = `
      SELECT 
        id,
        created_at as timestamp,
        CASE 
          WHEN notes LIKE '%store: %' THEN 
            SUBSTRING(notes FROM 'store: ([^)]+)')
          ELSE 'Unknown Store'
        END as store,
        CASE 
          WHEN notes LIKE '%products' THEN 
            CAST(SUBSTRING(notes FROM '([0-9]+) products') AS INTEGER)
          ELSE 1
        END as product_count,
        CASE 
          WHEN notes LIKE '%Successfully synced%' THEN 1
          ELSE 0
        END as success_count,
        CASE 
          WHEN notes LIKE '%FAILED%' OR notes LIKE '%Error:%' THEN 1
          ELSE 0
        END as failed_count,
        CASE 
          WHEN notes LIKE '%Duration:%' THEN 
            CAST(SUBSTRING(notes FROM 'Duration: ([0-9.]+)s') AS NUMERIC)
          ELSE 0
        END as duration,
        CASE 
          WHEN notes LIKE '%Error:%' THEN 
            ARRAY[SUBSTRING(notes FROM 'Error: ([^)]+)')]
          ELSE ARRAY[]::TEXT[]
        END as errors
      FROM stock_logs 
      WHERE type = 'sync'
      AND created_at::date BETWEEN $1 AND $2
      ORDER BY created_at DESC
      LIMIT 20
    `
    const syncTimelineResult = await query(syncTimelineQuery, queryParams)

    // Stock Movements
    const stockMovementsQuery = `
      SELECT 
        id,
        sku,
        product_name,
        type,
        quantity,
        created_at as timestamp,
        user_name as user,
        notes
      FROM stock_logs 
      WHERE type IN ('stock_in', 'stock_out', 'adjustment')
      AND created_at::date BETWEEN $1 AND $2
      ORDER BY created_at DESC
      LIMIT 50
    `
    const stockMovementsResult = await query(stockMovementsQuery, queryParams)

    // User Activity
    const userActivityQuery = `
      SELECT 
        user_name as user,
        COUNT(*) as activities,
        MAX(created_at) as last_activity,
        COUNT(CASE WHEN type = 'sync' THEN 1 END) as sync_activities,
        COUNT(CASE WHEN type IN ('stock_in', 'stock_out', 'adjustment') THEN 1 END) as stock_activities
      FROM stock_logs 
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY user_name
      ORDER BY activities DESC
      LIMIT 10
    `
    const userActivityResult = await query(userActivityQuery, queryParams)

    // Compile the response
    const reportData = {
      overview: {
        totalProducts: parseInt(overview.total_products) || 0,
        totalQuantity: parseInt(overview.total_quantity) || 0,
        transactions: parseInt(overview.transactions) || 0,
        lowStock: parseInt(overview.low_stock) || 0,
        outOfStock: parseInt(overview.out_of_stock) || 0,
        activeUsers: parseInt(overview.active_users) || 0,
        recentScans: parseInt(overview.recent_scans) || 0
      },
      syncReports: {
        totalSyncs: parseInt(syncReports.total_syncs) || 0,
        successfulSyncs: parseInt(syncReports.successful_syncs) || 0,
        failedSyncs: parseInt(syncReports.failed_syncs) || 0,
        pendingSyncs: parseInt(syncReports.pending_syncs) || 0,
        syncSuccessRate: parseFloat(syncSuccessRate) || 0,
        averageSyncTime: parseFloat(syncReports.average_sync_time) || 0,
        lastSyncTime: syncReports.last_sync_time || null,
        storesWithIssues: parseInt(storesWithIssuesResult.rows[0]?.stores_with_issues) || 0
      },
      dailyActivity: dailyActivityResult.rows.map(row => ({
        date: row.date,
        syncs: parseInt(row.syncs) || 0,
        stockIn: parseInt(row.stock_in) || 0,
        stockOut: parseInt(row.stock_out) || 0,
        scans: parseInt(row.scans) || 0,
        total: parseInt(row.total) || 0
      })),
      mostSelling: mostSellingResult.rows.map(row => ({
        sku: row.sku,
        product_name: row.product_name,
        totalSold: parseInt(row.total_sold) || 0,
        totalRevenue: parseFloat(row.total_revenue) || 0,
        category: row.category || 'Uncategorized',
        lastSaleDate: row.last_sale_date
      })),
      leastSelling: leastSellingResult.rows.map(row => ({
        sku: row.sku,
        product_name: row.product_name,
        totalSold: parseInt(row.total_sold) || 0,
        category: row.category || 'Uncategorized',
        lastSaleDate: row.last_sale_date,
        daysSinceLastSale: parseInt(row.days_since_last_sale) || 0
      })),
      syncTimeline: syncTimelineResult.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        store: row.store,
        productCount: parseInt(row.product_count) || 0,
        successCount: parseInt(row.success_count) || 0,
        failedCount: parseInt(row.failed_count) || 0,
        duration: parseFloat(row.duration) || 0,
        errors: Array.isArray(row.errors) ? row.errors : []
      })),
      stockMovements: stockMovementsResult.rows.map(row => ({
        id: row.id,
        sku: row.sku,
        product_name: row.product_name,
        type: row.type,
        quantity: parseInt(row.quantity) || 0,
        timestamp: row.timestamp,
        user: row.user || 'System',
        notes: row.notes || ''
      })),
      userActivity: userActivityResult.rows.map(row => ({
        user: row.user || 'System',
        activities: parseInt(row.activities) || 0,
        lastActivity: row.last_activity,
        syncActivities: parseInt(row.sync_activities) || 0,
        stockActivities: parseInt(row.stock_activities) || 0
      }))
    }

    res.status(200).json({
      success: true,
      data: reportData,
      period: {
        startDate: queryParams[0],
        endDate: queryParams[1] || queryParams[0],
        period
      }
    })

  } catch (error) {
    console.error('Reports API error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch reports data'
    })
  }
}
