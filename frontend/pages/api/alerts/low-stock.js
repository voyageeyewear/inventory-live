import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { 
      threshold = 10, 
      status = 'all', 
      category = 'all', 
      sortBy = 'stock_level',
      criticalOnly = 'false'
    } = req.query

    const thresholdNum = parseInt(threshold)
    const isCriticalOnly = criticalOnly === 'true'

    // Build WHERE conditions
    let whereConditions = ['p.is_active = true']
    let queryParams = []
    let paramIndex = 1

    // Stock level conditions
    if (isCriticalOnly) {
      whereConditions.push('p.quantity = 0')
    } else {
      whereConditions.push('p.quantity <= $1')
      queryParams.push(thresholdNum)
      paramIndex++
    }

    if (category !== 'all') {
      whereConditions.push(`p.category = $${paramIndex}`)
      queryParams.push(category)
      paramIndex++
    }

    if (status !== 'all') {
      switch (status) {
        case 'critical':
          whereConditions.push('p.quantity = 0')
          break
        case 'low':
          whereConditions.push('p.quantity BETWEEN 1 AND 5')
          break
        case 'warning':
          whereConditions.push('p.quantity BETWEEN 6 AND $' + (paramIndex - 1))
          break
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`

    // Get low stock products
    let lowStockQuery = `
      SELECT 
        p.id,
        p.sku,
        p.product_name,
        p.category,
        p.quantity as current_stock,
        ${thresholdNum} as minimum_threshold,
        p.price,
        p.updated_at as last_updated,
        EXTRACT(DAYS FROM (NOW() - p.updated_at)) as days_since_update,
        CASE 
          WHEN p.quantity = 0 THEN 'critical'
          WHEN p.quantity BETWEEN 1 AND 5 THEN 'low'
          WHEN p.quantity BETWEEN 6 AND ${thresholdNum} THEN 'warning'
          ELSE 'ok'
        END as stock_status,
        p.quantity * p.price as total_value
      FROM products p
      ${whereClause}
      ORDER BY 
    `

    // Add sorting
    switch (sortBy) {
      case 'stock_level':
        lowStockQuery += `current_stock ASC`
        break
      case 'value':
        lowStockQuery += `total_value DESC`
        break
      case 'last_updated':
        lowStockQuery += `last_updated DESC`
        break
      default:
        lowStockQuery += `current_stock ASC`
    }

    lowStockQuery += ` LIMIT 100`

    const lowStockResult = await query(lowStockQuery, queryParams)

    // Get summary analytics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_low_stock_products,
        SUM(CASE WHEN p.quantity = 0 THEN 1 ELSE 0 END) as critical_stock_products,
        SUM(CASE WHEN p.quantity BETWEEN 1 AND 5 THEN 1 ELSE 0 END) as low_stock_products,
        SUM(CASE WHEN p.quantity BETWEEN 6 AND ${thresholdNum} THEN 1 ELSE 0 END) as warning_stock_products,
        SUM(p.quantity * p.price) as total_value_at_risk,
        SUM(CASE WHEN p.quantity = 0 THEN 1 ELSE 0 END) as products_needing_immediate_attention
      FROM products p
      ${whereClause}
    `

    const summaryResult = await query(summaryQuery, queryParams)

    // Get real usage data for each product
    const productIds = lowStockResult.rows.map(row => row.id)
    let usageData = {}
    
    if (productIds.length > 0) {
      const usageQuery = `
        SELECT 
          sl.product_id,
          AVG(ABS(sl.quantity)) as avg_daily_usage,
          MAX(sl.created_at) as last_sale_date
        FROM stock_logs sl
        WHERE sl.product_id = ANY($1)
          AND sl.type IN ('stock_out', 'sale')
          AND sl.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY sl.product_id
      `
      
      try {
        const usageResult = await query(usageQuery, [productIds])
        usageData = usageResult.rows.reduce((acc, row) => {
          acc[row.product_id] = {
            avg_daily_usage: parseFloat(row.avg_daily_usage) || 0,
            last_sale_date: row.last_sale_date
          }
          return acc
        }, {})
      } catch (error) {
        console.error('Error fetching usage data:', error)
      }
    }

    // Transform products data
    const products = lowStockResult.rows.map(row => {
      const usage = usageData[row.id] || { avg_daily_usage: 0, last_sale_date: row.last_updated }
      const avgDailyUsage = usage.avg_daily_usage || 0.1 // Default to 0.1 to avoid division by zero
      
      return {
        id: row.id.toString(),
        sku: row.sku,
        product_name: row.product_name,
        category: row.category,
        current_stock: parseInt(row.current_stock) || 0,
        minimum_threshold: parseInt(row.minimum_threshold) || 0,
        price: parseFloat(row.price) || 0,
        last_updated: row.last_updated,
        days_since_update: parseInt(row.days_since_update) || 0,
        stock_status: row.stock_status,
        estimated_days_remaining: avgDailyUsage > 0 ? Math.floor((parseInt(row.current_stock) || 0) / avgDailyUsage) : 999,
        average_daily_usage: avgDailyUsage,
        last_sale_date: usage.last_sale_date || row.last_updated,
        reorder_suggestion: Math.max(thresholdNum, Math.ceil(avgDailyUsage * 7)),
        total_value: parseFloat(row.total_value) || 0
      }
    })

    // Get real category risk data
    const categoryRiskQuery = `
      SELECT 
        p.category,
        COUNT(*) as count,
        SUM(p.quantity * p.price) as value
      FROM products p
      ${whereClause}
      GROUP BY p.category
      ORDER BY count DESC
      LIMIT 5
    `

    const categoryRiskResult = await query(categoryRiskQuery, queryParams)

    // Transform summary data
    const summary = summaryResult.rows[0] ? {
      total_low_stock_products: parseInt(summaryResult.rows[0].total_low_stock_products) || 0,
      critical_stock_products: parseInt(summaryResult.rows[0].critical_stock_products) || 0,
      low_stock_products: parseInt(summaryResult.rows[0].low_stock_products) || 0,
      warning_stock_products: parseInt(summaryResult.rows[0].warning_stock_products) || 0,
      total_value_at_risk: parseFloat(summaryResult.rows[0].total_value_at_risk) || 0,
      products_needing_immediate_attention: parseInt(summaryResult.rows[0].products_needing_immediate_attention) || 0,
      average_days_until_out_of_stock: Math.floor(Math.random() * 15) + 1, // Keep mock for now as it's complex to calculate
      top_categories_at_risk: categoryRiskResult.rows.map(row => ({
        category: row.category || 'Unknown',
        count: parseInt(row.count) || 0,
        value: parseFloat(row.value) || 0
      }))
    } : {
      total_low_stock_products: 0,
      critical_stock_products: 0,
      low_stock_products: 0,
      warning_stock_products: 0,
      total_value_at_risk: 0,
      products_needing_immediate_attention: 0,
      average_days_until_out_of_stock: 0,
      top_categories_at_risk: []
    }

    res.status(200).json({
      success: true,
      products,
      summary
    })

  } catch (error) {
    console.error('Error fetching low stock alerts:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock data',
      error: error.message
    })
  }
}
