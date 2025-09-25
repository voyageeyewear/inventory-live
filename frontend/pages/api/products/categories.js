import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Get all unique categories from products
    const result = await query(`
      SELECT DISTINCT category
      FROM products 
      WHERE is_active = true 
        AND category IS NOT NULL 
        AND category != ''
      ORDER BY category ASC
    `)

    const categories = result.rows.map(row => row.category).filter(Boolean)

    res.status(200).json({
      success: true,
      categories
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch categories',
      error: error.message 
    })
  }
}
