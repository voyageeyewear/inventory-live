import { query } from '../../../lib/postgres'

// Enhanced sync function that can create products and inventory levels
async function syncProductToShopify(storeDomain, accessToken, sku, quantity, productData, storeId) {
  try {
    console.log(`🔄 Starting sync for SKU ${sku} to quantity ${quantity} in store ${storeDomain}`)
    
    // First, search for existing products with this SKU
    let allProducts = []
    let pageInfo = null
    let page = 1
    let hasMore = true
    const maxPages = 50
    
    while (hasMore && page <= maxPages) {
      try {
        let url = `https://${storeDomain}/admin/api/2023-10/products.json?limit=250`
        if (pageInfo) {
          url += `&page_info=${pageInfo}`
        }
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          console.error(`❌ HTTP error: ${response.status}`)
          break
        }
        
        const data = await response.json()
        
        if (!data.products || data.products.length === 0) {
          hasMore = false
          break
        }
        
        allProducts = allProducts.concat(data.products)
        
        // Check for next page
        const linkHeader = response.headers.get('Link')
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
          if (nextMatch) {
            const nextUrl = new URL(nextMatch[1])
            pageInfo = nextUrl.searchParams.get('page_info')
            page++
          } else {
            hasMore = false
          }
        } else {
          hasMore = false
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message)
        hasMore = false
      }
    }
    
    // Find products with matching SKU
    const matchingProducts = allProducts.filter(product => 
      product.variants.some(variant => variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim())
    )
    
    console.log(`🎯 Found ${matchingProducts.length} products with SKU ${sku}`)
    
    if (matchingProducts.length === 0) {
      // Product doesn't exist in Shopify - create it
      console.log(`📦 Creating new product for SKU ${sku}`)
      
      const newProduct = {
        title: productData.product_name || `Product ${sku}`,
        body_html: productData.description || '',
        vendor: 'Inventory System',
        product_type: productData.category || 'General',
        tags: [sku, productData.category || 'General'].filter(Boolean).join(','),
        variants: [{
          sku: sku,
          price: productData.price || '0.00',
          inventory_management: 'shopify',
          inventory_policy: 'deny',
          inventory_quantity: quantity,
          requires_shipping: true,
          taxable: true
        }],
        images: productData.image_url ? [{
          src: productData.image_url
        }] : []
      }
      
      const createResponse = await fetch(`https://${storeDomain}/admin/api/2023-10/products.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product: newProduct })
      })
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        console.error(`❌ Failed to create product:`, errorData)
        throw new Error(`Failed to create product: ${errorData.errors || 'Unknown error'}`)
      }
      
      const createdProduct = await createResponse.json()
      console.log(`✅ Created product:`, createdProduct.product.id)
      
      // Get the first location for inventory level
      const locationsResponse = await fetch(`https://${storeDomain}/admin/api/2023-10/locations.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      })
      
      if (!locationsResponse.ok) {
        throw new Error('Failed to get store locations')
      }
      
      const locationsData = await locationsResponse.json()
      if (!locationsData.locations || locationsData.locations.length === 0) {
        throw new Error('No locations found in store')
      }
      
      const locationId = locationsData.locations[0].id
      const variant = createdProduct.product.variants[0]
      
      // Set inventory level
      const inventoryResponse = await fetch(`https://${storeDomain}/admin/api/2023-10/inventory_levels.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: variant.inventory_item_id,
          available: quantity
        })
      })
      
      if (!inventoryResponse.ok) {
        const errorData = await inventoryResponse.json()
        console.error(`❌ Failed to set inventory:`, errorData)
        throw new Error(`Failed to set inventory: ${errorData.errors || 'Unknown error'}`)
      }
      
      console.log(`✅ Set inventory to ${quantity} for new product`)
      
      return {
        success: true,
        variantsUpdated: 1,
        message: `Created new product and set inventory to ${quantity}`,
        results: [{
          variantTitle: variant.title,
          variantId: variant.id,
          previousQuantity: 0,
          newQuantity: quantity,
          success: true,
          action: 'created'
        }]
      }
    }
    
    // Product exists - update all variants with this SKU
    let totalVariantsUpdated = 0
    const results = []
    
    for (const product of matchingProducts) {
      console.log(`🔄 Processing product: "${product.title}" (ID: ${product.id})`)
      
      const matchingVariants = product.variants.filter(variant => 
        variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
      )
      
      console.log(`📋 Found ${matchingVariants.length} variants with SKU ${sku}`)
      
      for (const variant of matchingVariants) {
        try {
          console.log(`🔄 Updating variant ${variant.title || variant.id} for SKU ${sku}`)
          
          // Get current inventory level
          const inventoryUrl = `https://${storeDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`
          
          const inventoryResponse = await fetch(inventoryUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          })
          
          if (!inventoryResponse.ok) {
            console.error(`❌ Inventory API error: ${inventoryResponse.status}`)
            continue
          }
          
          const inventoryData = await inventoryResponse.json()
          
          let currentLevel = null
          let previousQuantity = 0
          
          if (!inventoryData.inventory_levels || inventoryData.inventory_levels.length === 0) {
            console.log(`⚠️ No inventory level found for variant ${variant.id}, creating one`)
            
            // Get the first available location
            const locationsResponse = await fetch(`https://${storeDomain}/admin/api/2023-10/locations.json`, {
              method: 'GET',
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
              }
            })
            
            if (!locationsResponse.ok) {
              throw new Error('Failed to get store locations')
            }
            
            const locationsData = await locationsResponse.json()
            if (!locationsData.locations || locationsData.locations.length === 0) {
              throw new Error('No locations found in store')
            }
            
            const locationId = locationsData.locations[0].id
            
            // Create inventory level
            const createResponse = await fetch(`https://${storeDomain}/admin/api/2023-10/inventory_levels.json`, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                location_id: locationId,
                inventory_item_id: variant.inventory_item_id,
                available: 0
              })
            })
            
            if (!createResponse.ok) {
              const errorData = await createResponse.json()
              console.error(`❌ Failed to create inventory level:`, errorData)
              continue
            }
            
            currentLevel = {
              location_id: locationId,
              available: 0
            }
            previousQuantity = 0
            
          } else {
            currentLevel = inventoryData.inventory_levels[0]
            previousQuantity = currentLevel.available
          }
          
          console.log(`📈 Current inventory for variant ${variant.id}: ${previousQuantity} units`)
          
          // Update inventory level
          const updateUrl = `https://${storeDomain}/admin/api/2023-10/inventory_levels/set.json`
          
          const updateResponse = await fetch(updateUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              location_id: currentLevel.location_id,
              inventory_item_id: variant.inventory_item_id,
              available: quantity
            })
          })
          
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json()
            console.error(`❌ Failed to update inventory:`, errorData)
            throw new Error(`Failed to update inventory: ${errorData.errors || 'Unknown error'}`)
          }
          
          totalVariantsUpdated++
          results.push({
            variantTitle: variant.title || variant.id,
            variantId: variant.id,
            previousQuantity: previousQuantity,
            newQuantity: quantity,
            success: true,
            action: 'updated'
          })
          
          console.log(`✅ Successfully updated variant ${variant.title || variant.id} from ${previousQuantity} to ${quantity}`)
          
        } catch (variantError) {
          console.error(`❌ Failed to update variant ${variant.title || variant.id}:`, variantError.message)
          results.push({
            variantTitle: variant.title || variant.id,
            variantId: variant.id,
            success: false,
            error: variantError.message,
            action: 'failed'
          })
        }
      }
    }
    
    return {
      success: true,
      variantsUpdated: totalVariantsUpdated,
      message: `Updated ${totalVariantsUpdated} variants to quantity ${quantity}`,
      results: results
    }
    
  } catch (error) {
    console.error(`💥 Error syncing SKU ${sku}:`, error.message)
    return {
      success: false,
      variantsUpdated: 0,
      message: error.message,
      results: []
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  console.log('🚀 Individual sync API V2 called with:', req.body)
  const { productId, sku, quantity } = req.body

  if (!productId || !sku || quantity === undefined) {
    console.log('❌ Missing required fields:', { productId, sku, quantity })
    return res.status(400).json({
      success: false,
      message: 'Product ID, SKU, and quantity are required'
    })
  }

  try {
    // Get product data from local database
    const productResult = await query(`
      SELECT * FROM products WHERE id = $1 AND is_active = true
    `, [productId])

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in local database'
      })
    }

    const productData = productResult.rows[0]

    // Get all connected stores
    const storesResult = await query(`
      SELECT id, store_name, store_domain, shopify_domain, access_token
      FROM stores 
      WHERE connected = true
    `)

    const stores = storesResult.rows

    if (stores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No connected Shopify stores found'
      })
    }

    // Update inventory in all connected stores
    const results = []
    let successCount = 0
    let errorCount = 0
    let totalVariantsUpdated = 0

    for (const store of stores) {
      try {
        console.log(`🔄 Syncing SKU ${sku} to quantity ${quantity} in store ${store.store_name}`)
        
        const syncResult = await syncProductToShopify(
          store.shopify_domain,
          store.access_token,
          sku,
          quantity,
          productData,
          store.id
        )

        results.push({
          store_id: store.id,
          store_name: store.store_name,
          success: syncResult.success,
          message: syncResult.message,
          variantsUpdated: syncResult.variantsUpdated,
          results: syncResult.results
        })

        if (syncResult.success) {
          successCount++
          totalVariantsUpdated += syncResult.variantsUpdated
        } else {
          errorCount++
        }

        console.log(`✅ Store ${store.store_name} result:`, {
          success: syncResult.success,
          variantsUpdated: syncResult.variantsUpdated,
          message: syncResult.message
        })

      } catch (error) {
        console.error(`❌ Error syncing to store ${store.store_name}:`, error.message)
        results.push({
          store_id: store.id,
          store_name: store.store_name,
          success: false,
          message: error.message,
          variantsUpdated: 0,
          results: []
        })
        errorCount++
      }
    }

    // Update local database
    if (successCount > 0) {
      await query(`
        UPDATE products 
        SET 
          quantity = $1,
          last_synced = CURRENT_TIMESTAMP,
          needs_sync = false,
          last_modified = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [quantity, productId])

      console.log(`✅ Updated local database for product ${productId}`)
    }

    return res.status(200).json({
      success: successCount > 0,
      message: `Synced ${totalVariantsUpdated} variants to ${successCount}/${stores.length} stores`,
      results: results,
      summary: {
        total_stores: stores.length,
        successful: successCount,
        failed: errorCount,
        total_variants_updated: totalVariantsUpdated
      }
    })

  } catch (error) {
    console.error('💥 Error in sync API:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    })
  }
}
