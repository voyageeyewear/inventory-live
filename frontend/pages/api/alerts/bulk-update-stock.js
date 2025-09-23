import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { productIds, action, amount } = req.body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Product IDs are required' })
    }

    if (!action || !['increase', 'decrease'].includes(action)) {
      return res.status(400).json({ message: 'Action must be increase or decrease' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' })
    }

    const amountNum = parseInt(amount)
    const results = []

    // Process each product
    for (const productId of productIds) {
      try {
        // Get current product details
        const productQuery = 'SELECT * FROM products WHERE id = $1 AND is_active = true'
        const productResult = await query(productQuery, [productId])

        if (productResult.rows.length === 0) {
          results.push({
            productId,
            success: false,
            message: 'Product not found'
          })
          continue
        }

        const product = productResult.rows[0]
        const previousQuantity = product.quantity
        let newQuantity

        if (action === 'increase') {
          newQuantity = previousQuantity + amountNum
        } else {
          newQuantity = Math.max(0, previousQuantity - amountNum)
        }

        // Update product quantity
        const updateQuery = `
          UPDATE products 
          SET 
            quantity = $1,
            updated_at = CURRENT_TIMESTAMP,
            needs_sync = true,
            last_modified = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `

        const updateResult = await query(updateQuery, [newQuantity, productId])

        // Log the stock change
        const logQuery = `
          INSERT INTO stock_logs (
            product_id,
            product_name,
            sku,
            type,
            quantity,
            previous_quantity,
            new_quantity,
            notes,
            user_name,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        `

        await query(logQuery, [
          productId,
          product.product_name,
          product.sku,
          action === 'increase' ? 'stock_in' : 'stock_out',
          amountNum,
          previousQuantity,
          newQuantity,
          `Bulk ${action} by ${amountNum} units`,
          'System'
        ])

        results.push({
          productId,
          success: true,
          message: `Stock ${action}d by ${amountNum}`,
          previousQuantity,
          newQuantity,
          product: {
            sku: product.sku,
            name: product.product_name
          }
        })

      } catch (error) {
        console.error(`Error updating product ${productId}:`, error)
        results.push({
          productId,
          success: false,
          message: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    res.status(200).json({
      success: true,
      message: `Bulk update completed: ${successCount} successful, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        action,
        amount: amountNum
      }
    })

  } catch (error) {
    console.error('Error in bulk stock update:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update stock',
      error: error.message
    })
  }
}
