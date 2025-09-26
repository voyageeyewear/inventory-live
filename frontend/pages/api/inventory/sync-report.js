import { query } from '../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('📊 Generating comprehensive sync report...')

    // Get sync statistics from the last 24 hours
    const syncStats = await query(`
      SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_syncs,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as syncs_last_hour,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as syncs_last_24h
      FROM sync_audits 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `)

    // Get recent sync activities
    const recentSyncs = await query(`
      SELECT 
        sa.*,
        p.sku,
        p.product_name,
        p.category
      FROM sync_audits sa
      LEFT JOIN products p ON sa.product_id = p.id
      WHERE sa.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY sa.created_at DESC
      LIMIT 50
    `)

    // Get sync performance by store
    const storeStats = await query(`
      SELECT 
        s.store_name,
        COUNT(sa.id) as total_syncs,
        COUNT(CASE WHEN sa.success = true THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN sa.success = false THEN 1 END) as failed_syncs,
        ROUND(
          COUNT(CASE WHEN sa.success = true THEN 1 END) * 100.0 / NULLIF(COUNT(sa.id), 0), 2
        ) as success_rate
      FROM stores s
      LEFT JOIN sync_audits sa ON s.id = sa.store_id
      WHERE sa.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY s.id, s.store_name
      ORDER BY total_syncs DESC
    `)

    // Get sync performance by product category
    const categoryStats = await query(`
      SELECT 
        p.category,
        COUNT(sa.id) as total_syncs,
        COUNT(CASE WHEN sa.success = true THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN sa.success = false THEN 1 END) as failed_syncs,
        ROUND(
          COUNT(CASE WHEN sa.success = true THEN 1 END) * 100.0 / NULLIF(COUNT(sa.id), 0), 2
        ) as success_rate
      FROM sync_audits sa
      LEFT JOIN products p ON sa.product_id = p.id
      WHERE sa.created_at >= NOW() - INTERVAL '24 hours'
        AND p.category IS NOT NULL
      GROUP BY p.category
      ORDER BY total_syncs DESC
    `)

    // Get hourly sync distribution
    const hourlyStats = await query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as sync_count,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_count
      FROM sync_audits 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `)

    // Get error analysis
    const errorAnalysis = await query(`
      SELECT 
        error_message,
        COUNT(*) as error_count,
        COUNT(DISTINCT product_id) as affected_products
      FROM sync_audits 
      WHERE success = false 
        AND created_at >= NOW() - INTERVAL '24 hours'
        AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY error_count DESC
      LIMIT 10
    `)

    // Get top synced products
    const topSyncedProducts = await query(`
      SELECT 
        p.sku,
        p.product_name,
        p.category,
        COUNT(sa.id) as sync_count,
        COUNT(CASE WHEN sa.success = true THEN 1 END) as successful_syncs,
        MAX(sa.created_at) as last_sync
      FROM sync_audits sa
      LEFT JOIN products p ON sa.product_id = p.id
      WHERE sa.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY p.id, p.sku, p.product_name, p.category
      ORDER BY sync_count DESC
      LIMIT 20
    `)

    // Get variant sync details
    const variantStats = await query(`
      SELECT 
        sa.variants_updated,
        COUNT(*) as sync_count,
        AVG(sa.variants_updated) as avg_variants_per_sync
      FROM sync_audits sa
      WHERE sa.created_at >= NOW() - INTERVAL '24 hours'
        AND sa.success = true
      GROUP BY sa.variants_updated
      ORDER BY sa.variants_updated
    `)

    const report = {
      success: true,
      generated_at: new Date().toISOString(),
      summary: {
        total_syncs: parseInt(syncStats.rows[0]?.total_syncs || 0),
        successful_syncs: parseInt(syncStats.rows[0]?.successful_syncs || 0),
        failed_syncs: parseInt(syncStats.rows[0]?.failed_syncs || 0),
        success_rate: syncStats.rows[0]?.total_syncs > 0 
          ? Math.round((syncStats.rows[0]?.successful_syncs / syncStats.rows[0]?.total_syncs) * 100) 
          : 0,
        syncs_last_hour: parseInt(syncStats.rows[0]?.syncs_last_hour || 0),
        syncs_last_24h: parseInt(syncStats.rows[0]?.syncs_last_24h || 0)
      },
      recent_activities: recentSyncs.rows.map(sync => ({
        id: sync.id,
        product_id: sync.product_id,
        sku: sync.sku,
        product_name: sync.product_name,
        category: sync.category,
        success: sync.success,
        variants_updated: sync.variants_updated,
        error_message: sync.error_message,
        created_at: sync.created_at
      })),
      store_performance: storeStats.rows.map(store => ({
        store_name: store.store_name,
        total_syncs: parseInt(store.total_syncs || 0),
        successful_syncs: parseInt(store.successful_syncs || 0),
        failed_syncs: parseInt(store.failed_syncs || 0),
        success_rate: parseFloat(store.success_rate || 0)
      })),
      category_performance: categoryStats.rows.map(category => ({
        category: category.category,
        total_syncs: parseInt(category.total_syncs || 0),
        successful_syncs: parseInt(category.successful_syncs || 0),
        failed_syncs: parseInt(category.failed_syncs || 0),
        success_rate: parseFloat(category.success_rate || 0)
      })),
      hourly_distribution: hourlyStats.rows.map(hour => ({
        hour: parseInt(hour.hour),
        sync_count: parseInt(hour.sync_count || 0),
        successful_count: parseInt(hour.successful_count || 0)
      })),
      error_analysis: errorAnalysis.rows.map(error => ({
        error_message: error.error_message,
        error_count: parseInt(error.error_count || 0),
        affected_products: parseInt(error.affected_products || 0)
      })),
      top_synced_products: topSyncedProducts.rows.map(product => ({
        sku: product.sku,
        product_name: product.product_name,
        category: product.category,
        sync_count: parseInt(product.sync_count || 0),
        successful_syncs: parseInt(product.successful_syncs || 0),
        last_sync: product.last_sync
      })),
      variant_statistics: variantStats.rows.map(variant => ({
        variants_updated: parseInt(variant.variants_updated || 0),
        sync_count: parseInt(variant.sync_count || 0),
        avg_variants_per_sync: parseFloat(variant.avg_variants_per_sync || 0)
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
