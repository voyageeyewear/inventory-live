import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Simple authentication check
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ message: 'Access token required' })
    }

    let user
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('Token decoded for user ID:', decoded.userId)
      console.log('Token payload:', decoded)
      
      // Check what users exist in the database
      const allUsersResult = await query('SELECT id, username, email, is_active FROM users ORDER BY id')
      console.log('All users in database:', allUsersResult.rows)
      
      // First check if user exists
      const userCheckResult = await query('SELECT id, username, email, is_active FROM users WHERE id = $1', [decoded.userId])
      console.log('User lookup result for ID', decoded.userId, ':', userCheckResult.rows)
      
      if (userCheckResult.rows.length === 0) {
        console.log('User not found in database. Looking for user ID:', decoded.userId)
        console.log('Available user IDs:', allUsersResult.rows.map(u => u.id))
        
        // Try to find user by username if ID doesn't match
        if (decoded.username) {
          console.log('Trying to find user by username:', decoded.username)
          const userByNameResult = await query('SELECT id, username, email, is_active FROM users WHERE username = $1', [decoded.username])
          if (userByNameResult.rows.length > 0) {
            console.log('Found user by username:', userByNameResult.rows[0])
            user = userByNameResult.rows[0]
          } else {
            return res.status(401).json({ 
              message: 'User not found',
              debug: {
                requestedUserId: decoded.userId,
                requestedUsername: decoded.username,
                availableUsers: allUsersResult.rows
              }
            })
          }
        } else {
          return res.status(401).json({ 
            message: 'User not found',
            debug: {
              requestedUserId: decoded.userId,
              availableUsers: allUsersResult.rows
            }
          })
        }
      } else {
        const userData = userCheckResult.rows[0]
        console.log('User found by ID:', userData)
        
        if (!userData.is_active) {
          console.log('User is inactive:', userData)
          return res.status(401).json({ message: 'User account is inactive' })
        }
        
        user = userData
      }
    } catch (error) {
      console.error('Authentication error:', error.message)
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const { startDate, endDate } = req.query

    // Use today's date if no dates provided
    const today = new Date().toISOString().split('T')[0]
    const dateFrom = startDate || today
    const dateTo = endDate || today

    console.log(`Reports API - Fetching data for ${dateFrom} to ${dateTo}`)

    // Basic overview statistics with error handling
    let overview = {
      total_products: 0,
      total_quantity: 0,
      transactions: 0,
      low_stock: 0,
      out_of_stock: 0,
      active_users: 0,
      recent_scans: 0
    }

    try {
      // Get total products and quantity
      const productsResult = await query('SELECT COUNT(*) as total, COALESCE(SUM(quantity), 0) as total_qty FROM products WHERE is_active = true')
      if (productsResult.rows.length > 0) {
        overview.total_products = parseInt(productsResult.rows[0].total) || 0
        overview.total_quantity = parseInt(productsResult.rows[0].total_qty) || 0
      }

      // Get low stock and out of stock
      const stockResult = await query('SELECT COUNT(*) as low_stock FROM products WHERE quantity <= 10 AND is_active = true')
      if (stockResult.rows.length > 0) {
        overview.low_stock = parseInt(stockResult.rows[0].low_stock) || 0
      }

      const outOfStockResult = await query('SELECT COUNT(*) as out_of_stock FROM products WHERE quantity = 0 AND is_active = true')
      if (outOfStockResult.rows.length > 0) {
        overview.out_of_stock = parseInt(outOfStockResult.rows[0].out_of_stock) || 0
      }

      // Get transactions for the date range
      const transactionsResult = await query('SELECT COUNT(*) as transactions FROM stock_logs WHERE DATE(created_at) BETWEEN $1 AND $2', [dateFrom, dateTo])
      if (transactionsResult.rows.length > 0) {
        overview.transactions = parseInt(transactionsResult.rows[0].transactions) || 0
      }

      // Get active users for the date range
      const usersResult = await query('SELECT COUNT(DISTINCT user_name) as active_users FROM stock_logs WHERE DATE(created_at) BETWEEN $1 AND $2', [dateFrom, dateTo])
      if (usersResult.rows.length > 0) {
        overview.active_users = parseInt(usersResult.rows[0].active_users) || 0
      }

      // Get recent scans
      try {
        const scansResult = await query('SELECT COUNT(*) as recent_scans FROM scan_logs WHERE DATE(created_at) BETWEEN $1 AND $2', [dateFrom, dateTo])
        if (scansResult.rows.length > 0) {
          overview.recent_scans = parseInt(scansResult.rows[0].recent_scans) || 0
        }
      } catch (scanError) {
        console.log('Scan logs table not available, skipping scan count')
        overview.recent_scans = 0
      }

    } catch (error) {
      console.error('Overview query error:', error)
      // Continue with default values
    }

    // Basic sync reports
    let syncReports = {
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      pending_syncs: 0,
      sync_success_rate: 0,
      average_sync_time: 0,
      last_sync_time: null,
      stores_with_issues: 0
    }

    try {
      const syncResult = await query('SELECT COUNT(*) as total_syncs FROM stock_logs WHERE type = \'sync\' AND DATE(created_at) BETWEEN $1 AND $2', [dateFrom, dateTo])
      if (syncResult.rows.length > 0) {
        syncReports.total_syncs = parseInt(syncResult.rows[0].total_syncs) || 0
      }

      const successResult = await query('SELECT COUNT(*) as successful_syncs FROM stock_logs WHERE type = \'sync\' AND notes LIKE \'%Successfully synced%\' AND DATE(created_at) BETWEEN $1 AND $2', [dateFrom, dateTo])
      if (successResult.rows.length > 0) {
        syncReports.successful_syncs = parseInt(successResult.rows[0].successful_syncs) || 0
      }

      const failedResult = await query('SELECT COUNT(*) as failed_syncs FROM stock_logs WHERE type = \'sync\' AND (notes LIKE \'%FAILED%\' OR notes LIKE \'%Error:%\') AND DATE(created_at) BETWEEN $1 AND $2', [dateFrom, dateTo])
      if (failedResult.rows.length > 0) {
        syncReports.failed_syncs = parseInt(failedResult.rows[0].failed_syncs) || 0
      }

      // Calculate success rate
      if (syncReports.total_syncs > 0) {
        syncReports.sync_success_rate = (syncReports.successful_syncs / syncReports.total_syncs) * 100
      }

    } catch (error) {
      console.error('Sync reports query error:', error)
      // Continue with default values
    }

    // Daily activity (last 7 days)
    let dailyActivity = []
    try {
      const dailyResult = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(CASE WHEN type = 'sync' THEN 1 END) as syncs,
          COUNT(CASE WHEN type = 'stock_in' THEN 1 END) as stock_in,
          COUNT(CASE WHEN type = 'stock_out' THEN 1 END) as stock_out,
          COUNT(*) as total
        FROM stock_logs 
        WHERE DATE(created_at) BETWEEN $1 AND $2
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) DESC
        LIMIT 7
      `, [dateFrom, dateTo])
      
      dailyActivity = dailyResult.rows.map(row => ({
        date: row.date,
        syncs: parseInt(row.syncs) || 0,
        stockIn: parseInt(row.stock_in) || 0,
        stockOut: parseInt(row.stock_out) || 0,
        scans: 0,
        total: parseInt(row.total) || 0
      }))
    } catch (error) {
      console.error('Daily activity query error:', error)
      // Continue with empty array
    }

    // Most selling products (top 5)
    let mostSelling = []
    try {
      const mostSellingResult = await query(`
        SELECT 
          sku,
          product_name,
          COALESCE(SUM(quantity), 0) as total_sold,
          MAX(created_at) as last_sale_date
        FROM stock_logs 
        WHERE type = 'stock_out' AND DATE(created_at) BETWEEN $1 AND $2
        GROUP BY sku, product_name
        ORDER BY total_sold DESC
        LIMIT 5
      `, [dateFrom, dateTo])
      
      mostSelling = mostSellingResult.rows.map(row => ({
        sku: row.sku,
        product_name: row.product_name,
        totalSold: parseInt(row.total_sold) || 0,
        totalRevenue: 0,
        category: 'Uncategorized',
        lastSaleDate: row.last_sale_date
      }))
    } catch (error) {
      console.error('Most selling query error:', error)
      // Continue with empty array
    }

    // Least selling products (bottom 5)
    let leastSelling = []
    try {
      const leastSellingResult = await query(`
        SELECT 
          p.sku,
          p.product_name,
          COALESCE(SUM(CASE WHEN sl.type = 'stock_out' THEN sl.quantity ELSE 0 END), 0) as total_sold,
          COALESCE(MAX(sl.created_at), p.created_at) as last_sale_date,
          EXTRACT(DAYS FROM NOW() - COALESCE(MAX(sl.created_at), p.created_at)) as days_since_last_sale
        FROM products p
        LEFT JOIN stock_logs sl ON p.sku = sl.sku
        WHERE p.is_active = true
        GROUP BY p.sku, p.product_name, p.created_at
        ORDER BY total_sold ASC, days_since_last_sale DESC
        LIMIT 5
      `)
      
      leastSelling = leastSellingResult.rows.map(row => ({
        sku: row.sku,
        product_name: row.product_name,
        totalSold: parseInt(row.total_sold) || 0,
        category: 'Uncategorized',
        lastSaleDate: row.last_sale_date,
        daysSinceLastSale: parseInt(row.days_since_last_sale) || 0
      }))
    } catch (error) {
      console.error('Least selling query error:', error)
      // Continue with empty array
    }

    // Sync timeline (last 10 operations)
    let syncTimeline = []
    try {
      const syncTimelineResult = await query(`
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
        WHERE type = 'sync' AND DATE(created_at) BETWEEN $1 AND $2
        ORDER BY created_at DESC
        LIMIT 10
      `, [dateFrom, dateTo])
      
      syncTimeline = syncTimelineResult.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        store: row.store,
        productCount: parseInt(row.product_count) || 0,
        successCount: parseInt(row.success_count) || 0,
        failedCount: parseInt(row.failed_count) || 0,
        duration: parseFloat(row.duration) || 0,
        errors: Array.isArray(row.errors) ? row.errors : []
      }))
    } catch (error) {
      console.error('Sync timeline query error:', error)
      // Continue with empty array
    }

    // Stock movements (last 20)
    let stockMovements = []
    try {
      const stockMovementsResult = await query(`
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
        WHERE type IN ('stock_in', 'stock_out', 'adjustment') AND DATE(created_at) BETWEEN $1 AND $2
        ORDER BY created_at DESC
        LIMIT 20
      `, [dateFrom, dateTo])
      
      stockMovements = stockMovementsResult.rows.map(row => ({
        id: row.id,
        sku: row.sku,
        product_name: row.product_name,
        type: row.type,
        quantity: parseInt(row.quantity) || 0,
        timestamp: row.timestamp,
        user: row.user || 'System',
        notes: row.notes || ''
      }))
    } catch (error) {
      console.error('Stock movements query error:', error)
      // Continue with empty array
    }

    // User activity (last 10 users)
    let userActivity = []
    try {
      const userActivityResult = await query(`
        SELECT 
          user_name as user,
          COUNT(*) as activities,
          MAX(created_at) as last_activity,
          COUNT(CASE WHEN type = 'sync' THEN 1 END) as sync_activities,
          COUNT(CASE WHEN type IN ('stock_in', 'stock_out', 'adjustment') THEN 1 END) as stock_activities
        FROM stock_logs 
        WHERE DATE(created_at) BETWEEN $1 AND $2
        GROUP BY user_name
        ORDER BY activities DESC
        LIMIT 10
      `, [dateFrom, dateTo])
      
      userActivity = userActivityResult.rows.map(row => ({
        user: row.user || 'System',
        activities: parseInt(row.activities) || 0,
        lastActivity: row.last_activity,
        syncActivities: parseInt(row.sync_activities) || 0,
        stockActivities: parseInt(row.stock_activities) || 0
      }))
    } catch (error) {
      console.error('User activity query error:', error)
      // Continue with empty array
    }

    // Compile the response
    const reportData = {
      overview: {
        totalProducts: overview.total_products,
        totalQuantity: overview.total_quantity,
        transactions: overview.transactions,
        lowStock: overview.low_stock,
        outOfStock: overview.out_of_stock,
        activeUsers: overview.active_users,
        recentScans: overview.recent_scans
      },
      syncReports: {
        totalSyncs: syncReports.total_syncs,
        successfulSyncs: syncReports.successful_syncs,
        failedSyncs: syncReports.failed_syncs,
        pendingSyncs: syncReports.pending_syncs,
        syncSuccessRate: syncReports.sync_success_rate,
        averageSyncTime: syncReports.average_sync_time,
        lastSyncTime: syncReports.last_sync_time,
        storesWithIssues: syncReports.stores_with_issues
      },
      dailyActivity,
      mostSelling,
      leastSelling,
      syncTimeline,
      stockMovements,
      userActivity
    }

    console.log('Reports API - Successfully generated report data')

    res.status(200).json({
      success: true,
      data: reportData,
      period: {
        startDate: dateFrom,
        endDate: dateTo,
        period: 'custom'
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
