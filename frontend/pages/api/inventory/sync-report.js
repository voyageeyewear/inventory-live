import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('📊 Generating sync report...')

    // Get basic statistics from stock_logs
    const stats = await query(`
      SELECT 
        COUNT(*) as total_activities,
        COUNT(CASE WHEN type = 'sync' OR notes LIKE '%SYNC%' THEN 1 END) as sync_activities,
        COUNT(CASE WHEN notes LIKE '%SUCCESS%' OR notes LIKE '%SYNC%' THEN 1 END) as successful_activities,
        COUNT(CASE WHEN notes LIKE '%FAILED%' OR notes LIKE '%ERROR%' THEN 1 END) as failed_activities,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as activities_last_hour,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as activities_last_24h
      FROM stock_logs 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `)

    // Get recent sync activities
    const recentActivities = await query(`
      SELECT 
        sl.id,
        sl.product_id,
        sl.sku,
        sl.product_name,
        sl.type,
        sl.notes,
        sl.user_name,
        sl.created_at
      FROM stock_logs sl
      WHERE sl.created_at >= NOW() - INTERVAL '24 hours'
        AND (sl.type = 'sync' OR sl.notes LIKE '%SYNC%')
      ORDER BY sl.created_at DESC
      LIMIT 20
    `)

    // Get store performance
    const storePerformance = await query(`
      SELECT 
        s.store_name,
        COUNT(sl.id) as total_activities,
        COUNT(CASE WHEN sl.notes LIKE '%SUCCESS%' OR sl.notes LIKE '%SYNC%' THEN 1 END) as successful_activities,
        COUNT(CASE WHEN sl.notes LIKE '%FAILED%' OR sl.notes LIKE '%ERROR%' THEN 1 END) as failed_activities
      FROM stores s
      LEFT JOIN stock_logs sl ON s.id = sl.store_id
      WHERE sl.created_at >= NOW() - INTERVAL '24 hours'
        AND (sl.type = 'sync' OR sl.notes LIKE '%SYNC%')
      GROUP BY s.id, s.store_name
      ORDER BY total_activities DESC
    `)

    // Get top synced products
    const topSyncedProducts = await query(`
      SELECT 
        sl.sku,
        sl.product_name,
        COUNT(sl.id) as sync_count,
        MAX(sl.created_at) as last_sync
      FROM stock_logs sl
      WHERE sl.created_at >= NOW() - INTERVAL '24 hours'
        AND (sl.type = 'sync' OR sl.notes LIKE '%SYNC%')
      GROUP BY sl.sku, sl.product_name
      ORDER BY sync_count DESC
      LIMIT 10
    `)

    const report = {
      success: true,
      generated_at: new Date().toISOString(),
      summary: {
        total_syncs: parseInt(stats.rows[0]?.sync_activities || 0),
        successful_syncs: parseInt(stats.rows[0]?.successful_activities || 0),
        failed_syncs: parseInt(stats.rows[0]?.failed_activities || 0),
        success_rate: stats.rows[0]?.sync_activities > 0 
          ? Math.round((stats.rows[0]?.successful_activities / stats.rows[0]?.sync_activities) * 100) 
          : 0,
        syncs_last_hour: parseInt(stats.rows[0]?.activities_last_hour || 0),
        syncs_last_24h: parseInt(stats.rows[0]?.activities_last_24h || 0)
      },
      recent_activities: recentActivities.rows.map(activity => ({
        id: activity.id,
        product_id: activity.product_id,
        sku: activity.sku,
        product_name: activity.product_name,
        success: activity.notes?.includes('SUCCESS') || activity.notes?.includes('SYNC') || activity.type === 'sync',
        variants_updated: 1,
        error_message: activity.notes?.includes('FAILED') || activity.notes?.includes('ERROR') ? activity.notes : null,
        created_at: activity.created_at
      })),
      store_performance: storePerformance.rows.map(store => ({
        store_name: store.store_name,
        total_syncs: parseInt(store.total_activities || 0),
        successful_syncs: parseInt(store.successful_activities || 0),
        failed_syncs: parseInt(store.failed_activities || 0),
        success_rate: store.total_activities > 0 
          ? Math.round((store.successful_activities / store.total_activities) * 100) 
          : 0
      })),
      top_synced_products: topSyncedProducts.rows.map(product => ({
        sku: product.sku,
        product_name: product.product_name,
        sync_count: parseInt(product.sync_count || 0),
        last_sync: product.last_sync
      }))
    }

    console.log('📊 Sync report generated successfully:', {
      total_syncs: report.summary.total_syncs,
      success_rate: report.summary.success_rate + '%',
      recent_activities: report.recent_activities.length
    })

    res.status(200).json(report)

  } catch (error) {
    console.error('❌ Error generating sync report:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to generate sync report',
      error: error.message
    })
  }
}