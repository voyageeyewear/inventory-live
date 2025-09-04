import { connectToDatabase } from '../../../../lib/mongodb'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { sku } = req.query

  try {
    const { db } = await connectToDatabase()
    
    const product = await db.collection('products').findOne({ 
      sku: { $regex: new RegExp(`^${sku}$`, 'i') } 
    })
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    res.status(200).json(product)
  } catch (error) {
    console.error('Get product by SKU error:', error)
    res.status(500).json({ message: 'Failed to fetch product' })
  }
}
