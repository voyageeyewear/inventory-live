import { query } from '../../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Get basic stats
    const totalUsersResult = await query('SELECT COUNT(*) FROM users WHERE is_active = true')
    const totalProductsResult = await query('SELECT COUNT(*) FROM products WHERE is_active = true')
    const activeUsersResult = await query('SELECT COUNT(*) FROM users WHERE is_active = true')
    
    res.status(200).json({
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      totalProducts: parseInt(totalProductsResult.rows[0].count),
      activeUsers: parseInt(activeUsersResult.rows[0].count),
      totalStores: 0, // Placeholder
      recentActivity: []
    })
  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({ message: 'Failed to fetch stats' })
  }
}