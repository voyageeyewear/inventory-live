import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Get stores with product counts and activity information
    const result = await query(`
      SELECT 
        s.id,
        s.store_name,
        s.store_domain,
        s.shopify_domain,
        s.connected,
        s.created_at,
        s.updated_at,
        -- Count total products synced to this store
        COUNT(DISTINCT CASE 
          WHEN sl.product_id IS NOT NULL AND sl.type = 'sync' 
          THEN sl.product_id 
        END) as total_products_synced,
        -- Count products needing sync
        COUNT(DISTINCT CASE 
          WHEN sl.product_id IS NOT NULL AND sl.type = 'sync' 
          AND sl.notes NOT LIKE '%FAILED%' AND sl.notes NOT LIKE '%ERROR%'
          THEN sl.product_id 
        END) as successful_syncs,
        -- Count failed syncs
        COUNT(DISTINCT CASE 
          WHEN sl.product_id IS NOT NULL AND sl.type = 'sync' 
          AND (sl.notes LIKE '%FAILED%' OR sl.notes LIKE '%ERROR%')
          THEN sl.product_id 
        END) as failed_syncs,
        -- Last sync activity
        MAX(CASE WHEN sl.type = 'sync' THEN sl.created_at END) as last_sync_activity,
        -- Recent activity count (last 7 days)
        COUNT(DISTINCT CASE 
          WHEN sl.type = 'sync' AND sl.created_at >= NOW() - INTERVAL '7 days'
          THEN sl.product_id 
        END) as recent_activity_count
      FROM stores s
      LEFT JOIN stock_logs sl ON s.id::text = ANY(
        SELECT unnest(string_to_array(notes, 'store: ')) 
        FROM stock_logs 
        WHERE notes LIKE '%store:%' AND type = 'sync'
      )
      GROUP BY s.id, s.store_name, s.store_domain, s.shopify_domain, s.connected, s.created_at, s.updated_at
      ORDER BY 
        -- Priority: stores with products first, then by activity
        CASE WHEN COUNT(DISTINCT CASE WHEN sl.product_id IS NOT NULL AND sl.type = 'sync' THEN sl.product_id END) > 0 THEN 0 ELSE 1 END,
        total_products_synced DESC,
        last_sync_activity DESC NULLS LAST,
        s.created_at DESC
    `)

    // Format the results
    const stores = result.rows.map(store => ({
      id: store.id,
      store_name: store.store_name,
      store_domain: store.store_domain,
      shopify_domain: store.shopify_domain,
      connected: store.connected,
      created_at: store.created_at,
      updated_at: store.updated_at,
      stats: {
        total_products_synced: parseInt(store.total_products_synced) || 0,
        successful_syncs: parseInt(store.successful_syncs) || 0,
        failed_syncs: parseInt(store.failed_syncs) || 0,
        last_sync_activity: store.last_sync_activity,
        recent_activity_count: parseInt(store.recent_activity_count) || 0,
        sync_success_rate: store.total_products_synced > 0 
          ? Math.round((parseInt(store.successful_syncs) / parseInt(store.total_products_synced)) * 100)
          : 0
      }
    }))

    res.status(200).json(stores)
  } catch (error) {
    console.error('Error fetching stores with product counts:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stores with product counts',
      error: error.message 
    })
  }
}
