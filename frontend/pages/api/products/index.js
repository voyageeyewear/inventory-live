import { connectToDatabase } from '../../../lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function handler(req, res) {
  const { method } = req

  try {
    const { db } = await connectToDatabase()

    switch (method) {
      case 'GET':
        try {
          const { search } = req.query
          let query = {}

          if (search) {
            // Search by SKU, product name, or category (case-insensitive)
            query = {
              $or: [
                { sku: { $regex: search, $options: 'i' } },
                { product_name: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
              ]
            }
          }

          const products = await db.collection('products')
            .find(query)
            .sort({ createdAt: -1 })
            .toArray()

          res.status(200).json(products)
        } catch (error) {
          console.error('Error fetching products:', error)
          res.status(500).json({ message: 'Failed to fetch products' })
        }
        break

      case 'POST':
        try {
          const productData = req.body

          // Check if SKU already exists
          const existingProduct = await db.collection('products').findOne({ sku: productData.sku })
          if (existingProduct) {
            return res.status(400).json({ message: 'Product with this SKU already exists' })
          }

          // Add timestamps
          productData.createdAt = new Date()
          productData.updatedAt = new Date()
          productData.needsSync = true

          const result = await db.collection('products').insertOne(productData)
          
          res.status(201).json({
            message: 'Product created successfully',
            product: { ...productData, _id: result.insertedId }
          })
        } catch (error) {
          console.error('Error creating product:', error)
          res.status(500).json({ message: 'Failed to create product' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Database connection error:', error)
    res.status(500).json({ message: 'Database connection failed' })
  }
}
