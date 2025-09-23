import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { productIds, type } = req.body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Product IDs are required' })
    }

    // Get product details for email
    const productsQuery = `
      SELECT 
        p.id,
        p.sku,
        p.product_name,
        p.category,
        p.quantity,
        p.price,
        p.updated_at
      FROM products p
      WHERE p.id = ANY($1) AND p.is_active = true
    `

    const productsResult = await query(productsQuery, [productIds])

    if (productsResult.rows.length === 0) {
      return res.status(404).json({ message: 'No products found' })
    }

    // Log the alert (in a real implementation, you would send actual emails)
    const alertLogQuery = `
      INSERT INTO stock_logs (
        product_id, 
        product_name, 
        sku, 
        type, 
        quantity, 
        notes, 
        user_name, 
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `

    for (const product of productsResult.rows) {
      await query(alertLogQuery, [
        product.id,
        product.product_name,
        product.sku,
        'alert',
        product.quantity,
        `Email alert sent for ${type} - Stock level: ${product.quantity}`,
        'System'
      ])
    }

    // In a real implementation, you would:
    // 1. Get admin/staff email addresses
    // 2. Generate email content
    // 3. Send emails via email service (SendGrid, AWS SES, etc.)
    
    // For now, we'll simulate the email sending
    const emailContent = {
      subject: `Low Stock Alert - ${productsResult.rows.length} Products`,
      body: `
        <h2>Low Stock Alert</h2>
        <p>The following products are running low on stock:</p>
        <ul>
          ${productsResult.rows.map(product => `
            <li>
              <strong>${product.product_name}</strong> (SKU: ${product.sku})
              <br>Current Stock: ${product.quantity}
              <br>Category: ${product.category}
              <br>Price: ₹${product.price}
            </li>
          `).join('')}
        </ul>
        <p>Please consider restocking these items.</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      `,
      recipients: ['admin@company.com', 'manager@company.com'], // In real implementation, get from database
      products: productsResult.rows
    }

    // Log email alert
    console.log('Email alert generated:', emailContent)

    res.status(200).json({
      success: true,
      message: `Email alerts sent for ${productsResult.rows.length} products`,
      emailContent,
      productsCount: productsResult.rows.length
    })

  } catch (error) {
    console.error('Error sending email alerts:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to send email alerts',
      error: error.message
    })
  }
}
