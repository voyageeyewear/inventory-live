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
      page = 1,
      limit = 25,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query

    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    // Simple approach: Get stock logs first
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
        COALESCE(product_id::text, sku) as entity_id,
        COALESCE(product_name, sku) as entity_name,
        sku,
        product_name,
        user_name,
        quantity,
        previous_quantity as old_quantity,
        new_quantity,
        notes,
        created_at,
        updated_at
      FROM stock_logs
      WHERE 1=1
    `

    let queryParams = []
    let paramIndex = 1

    // Add filters
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

    // Add ordering and pagination
    const validSortColumns = ['created_at', 'type', 'status', 'entity_name', 'user_name']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at'
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC'

    stockLogsQuery += ` ORDER BY ${sortColumn === 'entity_name' ? 'product_name' : sortColumn} ${sortDirection}`
    stockLogsQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    
    queryParams.push(parseInt(limit))
    queryParams.push(offset)

    // Execute query
    const result = await query(stockLogsQuery, queryParams)

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM stock_logs WHERE 1=1`
    let countParams = []
    let countParamIndex = 1

    // Apply same filters for count
    if (type && type !== '') {
      if (type === 'stock_movement') {
        countQuery += ` AND type IN ('stock_in', 'stock_out', 'adjustment')`
      } else if (type === 'product_sync') {
        countQuery += ` AND type = 'sync'`
      }
    }

    if (status && status !== '') {
      if (status === 'success') {
        countQuery += ` AND (notes NOT LIKE '%FAILED%' AND notes NOT LIKE '%ERROR%')`
      } else if (status === 'failed') {
        countQuery += ` AND (notes LIKE '%FAILED%' OR notes LIKE '%ERROR%')`
      }
    }

    if (search && search.trim() !== '') {
      countQuery += ` AND (
        LOWER(product_name) LIKE $${countParamIndex} OR 
        LOWER(sku) LIKE $${countParamIndex} OR 
        LOWER(user_name) LIKE $${countParamIndex} OR
        LOWER(notes) LIKE $${countParamIndex}
      )`
      countParams.push(`%${search.toLowerCase()}%`)
      countParamIndex++
    }

    if (start_date && start_date !== '') {
      countQuery += ` AND created_at >= $${countParamIndex}`
      countParams.push(start_date + ' 00:00:00')
      countParamIndex++
    }

    if (end_date && end_date !== '') {
      countQuery += ` AND created_at <= $${countParamIndex}`
      countParams.push(end_date + ' 23:59:59')
      countParamIndex++
    }

    if (user && user !== '') {
      countQuery += ` AND LOWER(user_name) LIKE $${countParamIndex}`
      countParams.push(`%${user.toLowerCase()}%`)
      countParamIndex++
    }

    const countResult = await query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].total)
    const pages = Math.ceil(total / parseInt(limit))

    // Group activities by SKU and type for consolidation
    const groupedActivities = {}
    
    result.rows.forEach(row => {
      const key = `${row.sku}_${row.type}_${row.entity_name}`
      
      if (!groupedActivities[key]) {
        groupedActivities[key] = {
          id: row.id,
          type: row.type,
          action: row.action,
          status: row.status,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          entity_name: row.entity_name,
          sku: row.sku,
          product_name: row.product_name,
          store_name: null,
          user_name: row.user_name,
          quantity: row.quantity,
          old_quantity: row.old_quantity,
          new_quantity: row.new_quantity,
          notes: row.notes,
          error_message: null,
          duration_ms: null,
          created_at: row.created_at,
          updated_at: row.updated_at,
          duplicate_count: 1,
          consolidated_quantities: [row.quantity],
          total_quantity_change: row.quantity,
          duplicate_activities: [row.id]
        }
      } else {
        // Consolidate duplicate entries
        const existing = groupedActivities[key]
        existing.duplicate_count++
        existing.consolidated_quantities.push(row.quantity)
        existing.total_quantity_change += row.quantity
        existing.duplicate_activities.push(row.id)
        
        // Use the most recent timestamp
        if (new Date(row.created_at) > new Date(existing.created_at)) {
          existing.created_at = row.created_at
          existing.updated_at = row.updated_at
          existing.user_name = row.user_name
          existing.notes = row.notes
        }
        
        // Update quantity fields for consolidated view
        existing.old_quantity = Math.min(existing.old_quantity || row.old_quantity, row.old_quantity || existing.old_quantity || 0)
        existing.new_quantity = Math.max(existing.new_quantity || row.new_quantity, row.new_quantity || existing.new_quantity || 0)
        
        // Combine notes if different
        if (row.notes && existing.notes && row.notes !== existing.notes) {
          existing.notes = `${existing.notes} | ${row.notes}`
        }
      }
    })
    
    // Transform grouped activities back to array format
    const activities = Object.values(groupedActivities).map(activity => ({
      ...activity,
      // Add consolidation info to notes for display
      notes: activity.duplicate_count > 1 ? 
        `${activity.notes} [Consolidated from ${activity.duplicate_count} entries: ${activity.consolidated_quantities.join('+')}=${activity.total_quantity_change}]` :
        activity.notes
    }))

    res.status(200).json({
      success: true,
      activities,
      pagination: {
        page: parseInt(page),
        pages,
        total,
        limit: parseInt(limit),
        hasNext: parseInt(page) < pages,
        hasPrev: parseInt(page) > 1
      }
    })

  } catch (error) {
    console.error('Error fetching sync activities:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sync activities',
      error: error.message
    })
  }
}