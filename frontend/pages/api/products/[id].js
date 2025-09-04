import { connectToDatabase } from '../../../lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function handler(req, res) {
  const { method } = req
  const { id } = req.query

  try {
    const { db } = await connectToDatabase()

    switch (method) {
      case 'GET':
        try {
          const product = await db.collection('products').findOne({ 
            _id: new ObjectId(id) 
          })
          
          if (!product) {
            return res.status(404).json({ message: 'Product not found' })
          }
          
          res.status(200).json(product)
        } catch (error) {
          console.error('Get product error:', error)
          res.status(500).json({ message: 'Failed to fetch product' })
        }
        break

      case 'PUT':
        try {
          const updateData = req.body
          delete updateData._id // Remove _id from update data
          
          const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { 
              $set: {
                ...updateData,
                updatedAt: new Date()
              }
            }
          )
          
          if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Product not found' })
          }
          
          const updatedProduct = await db.collection('products').findOne({ 
            _id: new ObjectId(id) 
          })
          
          res.status(200).json(updatedProduct)
        } catch (error) {
          console.error('Update product error:', error)
          res.status(500).json({ message: 'Failed to update product' })
        }
        break

      case 'DELETE':
        try {
          const result = await db.collection('products').deleteOne({ 
            _id: new ObjectId(id) 
          })
          
          if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Product not found' })
          }
          
          res.status(200).json({ message: 'Product deleted successfully' })
        } catch (error) {
          console.error('Delete product error:', error)
          res.status(500).json({ message: 'Failed to delete product' })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Database connection error:', error)
    res.status(500).json({ message: 'Database connection failed' })
  }
}
