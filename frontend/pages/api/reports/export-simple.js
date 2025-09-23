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
      
      // Find user by ID or username
      let userResult = await query('SELECT id, username, email, is_active FROM users WHERE id = $1', [decoded.userId])
      
      if (userResult.rows.length === 0 && decoded.username) {
        userResult = await query('SELECT id, username, email, is_active FROM users WHERE username = $1', [decoded.username])
      }
      
      if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
        return res.status(401).json({ message: 'User not found or inactive' })
      }
      
      user = userResult.rows[0]
    } catch (error) {
      console.error('Authentication error:', error.message)
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const { type, startDate, endDate } = req.query

    if (!type) {
      return res.status(400).json({ message: 'Report type is required' })
    }

    // Use today's date if no dates provided
    const today = new Date().toISOString().split('T')[0]
    const dateFrom = startDate || today
    const dateTo = endDate || today

    console.log(`Export API - Generating ${type} report for ${dateFrom} to ${dateTo}`)

    let csvData = ''
    let filename = ''

    switch (type) {
      case 'sync':
        // Sync Report
        try {
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
            WHERE type = 'sync' AND DATE(created_at) BETWEEN $1 AND $2
            ORDER BY created_at DESC
          `
          const syncResult = await query(syncQuery, [dateFrom, dateTo])
          
          // Create CSV headers
          const headers = ['ID', 'SKU', 'Product Name', 'Type', 'Quantity', 'Previous Quantity', 'New Quantity', 'Notes', 'User', 'Created At']
          
          // Create CSV rows
          const rows = syncResult.rows.map(row => [
            row.id,
            row.sku || '',
            row.product_name || '',
            row.type || '',
            row.quantity || 0,
            row.previous_quantity || 0,
            row.new_quantity || 0,
            (row.notes || '').replace(/"/g, '""'), // Escape quotes
            row.user_name || '',
            new Date(row.created_at).toISOString()
          ])
          
          // Combine headers and rows
          csvData = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
          filename = `sync-report-${dateFrom}-to-${dateTo}.csv`
          
        } catch (error) {
          console.error('Sync export error:', error)
          return res.status(500).json({ message: 'Failed to generate sync report' })
        }
        break

      case 'stock-movements':
        // Stock Movements Report
        try {
          const stockQuery = `
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
            WHERE type IN ('stock_in', 'stock_out', 'adjustment') AND DATE(created_at) BETWEEN $1 AND $2
            ORDER BY created_at DESC
          `
          const stockResult = await query(stockQuery, [dateFrom, dateTo])
          
          const headers = ['ID', 'SKU', 'Product Name', 'Type', 'Quantity', 'Previous Quantity', 'New Quantity', 'Notes', 'User', 'Created At']
          const rows = stockResult.rows.map(row => [
            row.id,
            row.sku || '',
            row.product_name || '',
            row.type || '',
            row.quantity || 0,
            row.previous_quantity || 0,
            row.new_quantity || 0,
            (row.notes || '').replace(/"/g, '""'),
            row.user_name || '',
            new Date(row.created_at).toISOString()
          ])
          
          csvData = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
          filename = `stock-movements-${dateFrom}-to-${dateTo}.csv`
          
        } catch (error) {
          console.error('Stock movements export error:', error)
          return res.status(500).json({ message: 'Failed to generate stock movements report' })
        }
        break

      case 'products':
        // Product Performance Report
        try {
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
          const productsResult = await query(productsQuery, [dateFrom, dateTo])
          
          const headers = ['SKU', 'Product Name', 'Category', 'Current Quantity', 'Price', 'Is Active', 'Total Stock In', 'Total Stock Out', 'Sync Count', 'Last Activity', 'Product Created']
          const rows = productsResult.rows.map(row => [
            row.sku || '',
            row.product_name || '',
            row.category || '',
            row.current_quantity || 0,
            row.price || 0,
            row.is_active ? 'Yes' : 'No',
            row.total_stock_in || 0,
            row.total_stock_out || 0,
            row.sync_count || 0,
            row.last_activity ? new Date(row.last_activity).toISOString() : '',
            new Date(row.product_created).toISOString()
          ])
          
          csvData = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
          filename = `products-performance-${dateFrom}-to-${dateTo}.csv`
          
        } catch (error) {
          console.error('Products export error:', error)
          return res.status(500).json({ message: 'Failed to generate products report' })
        }
        break

      case 'user-activity':
        // User Activity Report
        try {
          const userActivityQuery = `
            SELECT 
              user_name,
              COUNT(*) as total_activities,
              COUNT(CASE WHEN type = 'sync' THEN 1 END) as sync_activities,
              COUNT(CASE WHEN type = 'stock_in' THEN 1 END) as stock_in_activities,
              COUNT(CASE WHEN type = 'stock_out' THEN 1 END) as stock_out_activities,
              COUNT(CASE WHEN type = 'adjustment' THEN 1 END) as adjustment_activities,
              MIN(created_at) as first_activity,
              MAX(created_at) as last_activity
            FROM stock_logs 
            WHERE DATE(created_at) BETWEEN $1 AND $2
            GROUP BY user_name
            ORDER BY total_activities DESC
          `
          const userActivityResult = await query(userActivityQuery, [dateFrom, dateTo])
          
          const headers = ['User Name', 'Total Activities', 'Sync Activities', 'Stock In Activities', 'Stock Out Activities', 'Adjustment Activities', 'First Activity', 'Last Activity']
          const rows = userActivityResult.rows.map(row => [
            row.user_name || 'System',
            row.total_activities || 0,
            row.sync_activities || 0,
            row.stock_in_activities || 0,
            row.stock_out_activities || 0,
            row.adjustment_activities || 0,
            row.first_activity ? new Date(row.first_activity).toISOString() : '',
            row.last_activity ? new Date(row.last_activity).toISOString() : ''
          ])
          
          csvData = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
          filename = `user-activity-${dateFrom}-to-${dateTo}.csv`
          
        } catch (error) {
          console.error('User activity export error:', error)
          return res.status(500).json({ message: 'Failed to generate user activity report' })
        }
        break

      default:
        return res.status(400).json({ message: 'Invalid report type' })
    }

    // Log the export activity
    try {
      await query(`
        INSERT INTO stock_logs (product_name, sku, type, quantity, notes, user_id, user_name, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [
        'Report Export',
        'REPORT_EXPORT',
        'report_export',
        1,
        `Exported ${type} report for period ${dateFrom} to ${dateTo}`,
        user.id,
        user.username
      ])
    } catch (logError) {
      console.log('Failed to log export activity:', logError.message)
      // Continue anyway
    }

    console.log(`Export successful: ${filename} (${csvData.split('\n').length - 1} rows)`)

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
