import bcrypt from 'bcryptjs'
import { connectToDatabase } from '../../lib/mongodb'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { db } = await connectToDatabase()
    
    // Check if admin user already exists
    const existingAdmin = await db.collection('users').findOne({ 
      email: 'admin@inventory.com' 
    })

    if (existingAdmin) {
      return res.status(200).json({ 
        message: 'Admin user already exists',
        user: {
          email: existingAdmin.email,
          username: existingAdmin.username,
          role: existingAdmin.role
        }
      })
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    const adminUser = {
      username: 'admin',
      email: 'admin@inventory.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await db.collection('users').insertOne(adminUser)
    
    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: result.insertedId,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    })
  } catch (error) {
    console.error('Setup error:', error)
    res.status(500).json({ message: 'Setup failed: ' + error.message })
  }
}
