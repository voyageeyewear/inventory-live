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

// Helper function to escape CSV values
const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

// Helper function to convert array to CSV
const arrayToCsv = (data, headers) => {
  const csvHeaders = headers.join(',')
  const csvRows = data.map(row => 
    headers.map(header => escapeCsvValue(row[header])).join(',')
  )
  return [csvHeaders, ...csvRows].join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    
    const { type, startDate, endDate } = req.query

    if (!type) {
      return res.status(400).json({ message: 'Report type is required' })
    }

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

    let csvData = ''
    let filename = ''

    switch (type) {
      case 'sync':
        // Sync Report
        const syncQuery = `
          SELECT 
            id,
            sku,
            product_name,
            type,
            quantity,
            previous_quantity,
            new_quantity,
            notes,
            user_name,
            created_at
          FROM stock_logs 
          WHERE type = 'sync' ${dateFilter}
          ORDER BY created_at DESC
        `
        const syncResult = await query(syncQuery, queryParams)
        
        csvData = arrayToCsv(syncResult.rows, [
          'id', 'sku', 'product_name', 'type', 'quantity', 
          'previous_quantity', 'new_quantity', 'notes', 'user_name', 'created_at'
        ])
        filename = `sync-report-${startDate}-to-${endDate}.csv`
        break

      case 'stock-movements':
        // Stock Movements Report
        const stockMovementsQuery = `
          SELECT 
            id,
            sku,
            product_name,
            type,
            quantity,
            previous_quantity,
            new_quantity,
            notes,
            user_name,
            created_at
          FROM stock_logs 
          WHERE type IN ('stock_in', 'stock_out', 'adjustment') ${dateFilter}
          ORDER BY created_at DESC
        `
        const stockMovementsResult = await query(stockMovementsQuery, queryParams)
        
        csvData = arrayToCsv(stockMovementsResult.rows, [
          'id', 'sku', 'product_name', 'type', 'quantity', 
          'previous_quantity', 'new_quantity', 'notes', 'user_name', 'created_at'
        ])
        filename = `stock-movements-${startDate}-to-${endDate}.csv`
        break

      case 'products':
        // Product Performance Report
        const productsQuery = `
          SELECT 
            p.sku,
            p.product_name,
            p.category,
            p.quantity as current_quantity,
            p.price,
            p.is_active,
            COALESCE(SUM(CASE WHEN sl.type = 'stock_in' THEN sl.quantity ELSE 0 END), 0) as total_stock_in,
            COALESCE(SUM(CASE WHEN sl.type = 'stock_out' THEN sl.quantity ELSE 0 END), 0) as total_stock_out,
            COALESCE(SUM(CASE WHEN sl.type = 'sync' THEN 1 ELSE 0 END), 0) as sync_count,
            MAX(sl.created_at) as last_activity,
            p.created_at as product_created
          FROM products p
          LEFT JOIN stock_logs sl ON p.sku = sl.sku
          WHERE p.is_active = true
          AND (sl.created_at IS NULL OR sl.created_at::date BETWEEN $1 AND $2)
          GROUP BY p.sku, p.product_name, p.category, p.quantity, p.price, p.is_active, p.created_at
          ORDER BY total_stock_out DESC
        `
        const productsResult = await query(productsQuery, queryParams)
        
        csvData = arrayToCsv(productsResult.rows, [
          'sku', 'product_name', 'category', 'current_quantity', 'price', 
          'is_active', 'total_stock_in', 'total_stock_out', 'sync_count', 
          'last_activity', 'product_created'
        ])
        filename = `products-performance-${startDate}-to-${endDate}.csv`
        break

      case 'user-activity':
        // User Activity Report
        const userActivityQuery = `
          SELECT 
            user_name,
            COUNT(*) as total_activities,
            COUNT(CASE WHEN type = 'sync' THEN 1 END) as sync_activities,
            COUNT(CASE WHEN type = 'stock_in' THEN 1 END) as stock_in_activities,
            COUNT(CASE WHEN type = 'stock_out' THEN 1 END) as stock_out_activities,
            COUNT(CASE WHEN type = 'adjustment' THEN 1 END) as adjustment_activities,
            COUNT(CASE WHEN type = 'scan' THEN 1 END) as scan_activities,
            MIN(created_at) as first_activity,
            MAX(created_at) as last_activity
          FROM stock_logs 
          WHERE created_at::date BETWEEN $1 AND $2
          GROUP BY user_name
          ORDER BY total_activities DESC
        `
        const userActivityResult = await query(userActivityQuery, queryParams)
        
        csvData = arrayToCsv(userActivityResult.rows, [
          'user_name', 'total_activities', 'sync_activities', 'stock_in_activities', 
          'stock_out_activities', 'adjustment_activities', 'scan_activities', 
          'first_activity', 'last_activity'
        ])
        filename = `user-activity-${startDate}-to-${endDate}.csv`
        break

      case 'daily-summary':
        // Daily Summary Report
        const dailySummaryQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(CASE WHEN type = 'sync' THEN 1 END) as sync_operations,
            COUNT(CASE WHEN type = 'stock_in' THEN 1 END) as stock_in_operations,
            COUNT(CASE WHEN type = 'stock_out' THEN 1 END) as stock_out_operations,
            COUNT(CASE WHEN type = 'adjustment' THEN 1 END) as adjustment_operations,
            COUNT(CASE WHEN type = 'scan' THEN 1 END) as scan_operations,
            COUNT(*) as total_operations,
            COUNT(DISTINCT user_name) as active_users,
            COUNT(DISTINCT sku) as unique_products_affected
          FROM stock_logs 
          WHERE created_at::date BETWEEN $1 AND $2
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) DESC
        `
        const dailySummaryResult = await query(dailySummaryQuery, queryParams)
        
        csvData = arrayToCsv(dailySummaryResult.rows, [
          'date', 'sync_operations', 'stock_in_operations', 'stock_out_operations', 
          'adjustment_operations', 'scan_operations', 'total_operations', 
          'active_users', 'unique_products_affected'
        ])
        filename = `daily-summary-${startDate}-to-${endDate}.csv`
        break

      case 'sync-performance':
        // Sync Performance Report
        const syncPerformanceQuery = `
          SELECT 
            DATE(created_at) as date,
            CASE 
              WHEN notes LIKE '%store: %' THEN 
                SUBSTRING(notes FROM 'store: ([^)]+)')
              ELSE 'Unknown Store'
            END as store,
            COUNT(*) as total_syncs,
            COUNT(CASE WHEN notes LIKE '%Successfully synced%' THEN 1 END) as successful_syncs,
            COUNT(CASE WHEN notes LIKE '%FAILED%' OR notes LIKE '%Error:%' THEN 1 END) as failed_syncs,
            ROUND(
              (COUNT(CASE WHEN notes LIKE '%Successfully synced%' THEN 1 END)::FLOAT / COUNT(*)) * 100, 2
            ) as success_rate,
            AVG(CASE 
              WHEN notes LIKE '%Duration:%' THEN 
                CAST(SUBSTRING(notes FROM 'Duration: ([0-9.]+)s') AS NUMERIC)
              ELSE NULL 
            END) as avg_duration_seconds
          FROM stock_logs 
          WHERE type = 'sync' ${dateFilter}
          GROUP BY DATE(created_at), 
            CASE 
              WHEN notes LIKE '%store: %' THEN 
                SUBSTRING(notes FROM 'store: ([^)]+)')
              ELSE 'Unknown Store'
            END
          ORDER BY DATE(created_at) DESC, total_syncs DESC
        `
        const syncPerformanceResult = await query(syncPerformanceQuery, queryParams)
        
        csvData = arrayToCsv(syncPerformanceResult.rows, [
          'date', 'store', 'total_syncs', 'successful_syncs', 'failed_syncs', 
          'success_rate', 'avg_duration_seconds'
        ])
        filename = `sync-performance-${startDate}-to-${endDate}.csv`
        break

      default:
        return res.status(400).json({ message: 'Invalid report type' })
    }

    // Log the export activity
    await query(`
      INSERT INTO stock_logs (product_name, sku, type, quantity, notes, user_id, user_name, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      'Report Export',
      'REPORT_EXPORT',
      'report_export',
      1,
      `Exported ${type} report for period ${startDate} to ${endDate}`,
      user.id,
      user.username
    ])

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(200).send(csvData)

  } catch (error) {
    console.error('Export API error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export report'
    })
  }
}
