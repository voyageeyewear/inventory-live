import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const {
      type = '',
      status = '',
      entity_type = '',
      search = '',
      start_date = '',
      end_date = '',
      user = '',
      store = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query

    // Simple query to get stock logs
    let stockLogsQuery = `
      SELECT 
        id,
        'stock_movement' as type,
        CASE 
          WHEN type = 'stock_in' THEN 'Stock Added'
          WHEN type = 'stock_out' THEN 'Stock Removed'
          WHEN type = 'sync' THEN 'Product Synced'
          ELSE 'Stock Updated'
        END as action,
        CASE 
          WHEN notes LIKE '%FAILED%' OR notes LIKE '%ERROR%' THEN 'failed'
          WHEN notes LIKE '%SUCCESS%' OR notes LIKE '%SYNC%' THEN 'success'
          WHEN type = 'sync' THEN 'success'
          ELSE 'success'
        END as status,
        'product' as entity_type,
        COALESCE(product_name, sku) as entity_name,
        sku,
        product_name,
        user_name,
        quantity,
        previous_quantity as old_quantity,
        new_quantity,
        notes,
        created_at
      FROM stock_logs
      WHERE 1=1
    `

    let queryParams = []
    let paramIndex = 1

    // Add filters (same logic as activities.js)
    if (type && type !== '') {
      if (type === 'stock_movement') {
        stockLogsQuery += ` AND type IN ('stock_in', 'stock_out', 'adjustment')`
      } else if (type === 'product_sync') {
        stockLogsQuery += ` AND type = 'sync'`
      }
    }

    if (status && status !== '') {
      if (status === 'success') {
        stockLogsQuery += ` AND (notes NOT LIKE '%FAILED%' AND notes NOT LIKE '%ERROR%')`
      } else if (status === 'failed') {
        stockLogsQuery += ` AND (notes LIKE '%FAILED%' OR notes LIKE '%ERROR%')`
      }
    }

    if (search && search.trim() !== '') {
      stockLogsQuery += ` AND (
        LOWER(product_name) LIKE $${paramIndex} OR 
        LOWER(sku) LIKE $${paramIndex} OR 
        LOWER(user_name) LIKE $${paramIndex} OR
        LOWER(notes) LIKE $${paramIndex}
      )`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    if (start_date && start_date !== '') {
      stockLogsQuery += ` AND created_at >= $${paramIndex}`
      queryParams.push(start_date + ' 00:00:00')
      paramIndex++
    }

    if (end_date && end_date !== '') {
      stockLogsQuery += ` AND created_at <= $${paramIndex}`
      queryParams.push(end_date + ' 23:59:59')
      paramIndex++
    }

    if (user && user !== '') {
      stockLogsQuery += ` AND LOWER(user_name) LIKE $${paramIndex}`
      queryParams.push(`%${user.toLowerCase()}%`)
      paramIndex++
    }

    // Add ordering
    const validSortColumns = ['created_at', 'type', 'status', 'entity_name', 'user_name']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at'
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC'

    stockLogsQuery += ` ORDER BY ${sortColumn === 'entity_name' ? 'product_name' : sortColumn} ${sortDirection}`
    stockLogsQuery += ` LIMIT 10000` // Limit for export

    // Execute query
    const result = await query(stockLogsQuery, queryParams)

    // Generate CSV content
    const csvHeaders = [
      'ID',
      'Type',
      'Action',
      'Status',
      'Entity Type',
      'Entity Name',
      'SKU',
      'Product Name',
      'User Name',
      'Quantity',
      'Old Quantity',
      'New Quantity',
      'Notes',
      'Created At'
    ]

    let csvContent = csvHeaders.join(',') + '\n'

    result.rows.forEach(row => {
      const csvRow = [
        `"${row.id || ''}"`,
        `"${row.type || ''}"`,
        `"${row.action || ''}"`,
        `"${row.status || ''}"`,
        `"${row.entity_type || ''}"`,
        `"${row.entity_name || ''}"`,
        `"${row.sku || ''}"`,
        `"${row.product_name || ''}"`,
        `"${row.user_name || ''}"`,
        `"${row.quantity || ''}"`,
        `"${row.old_quantity || ''}"`,
        `"${row.new_quantity || ''}"`,
        `"${(row.notes || '').replace(/"/g, '""')}"`,
        `"${row.created_at || ''}"`
      ]
      csvContent += csvRow.join(',') + '\n'
    })

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="sync-activities-${new Date().toISOString().split('T')[0]}.csv"`)
    res.status(200).send(csvContent)

  } catch (error) {
    console.error('Error exporting sync activities:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export sync activities',
      error: error.message
    })
  }
}