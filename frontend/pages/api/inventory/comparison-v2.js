import { query } from '../../../lib/postgres'

// Simple Shopify API fetch with proper error handling
const shopifyFetch = async (url, options, storeId) => {
  const maxRetries = 3
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(url, {
        ...options,
        timeout: 30000
      })
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2')
        console.log(`Rate limited, waiting ${retryAfter} seconds...`)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        retries++
        continue
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (error) {
      retries++
      if (retries >= maxRetries) {
        throw error
      }
      console.log(`Request failed, retrying... (${retries}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 1000 * retries))
    }
  }
}

// Simplified function to get Shopify inventory for a single SKU
const getShopifyInventoryForSKU = async (storeDomain, accessToken, sku) => {
  try {
    console.log(`🔍 Searching for SKU: ${sku} in store: ${storeDomain}`)
    
    // Step 1: Search for products containing this SKU
    const searchUrl = `https://${storeDomain}/admin/api/2025-01/products.json?limit=250`
    
    const response = await shopifyFetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    }, 'search')
    
    const data = await response.json()
    console.log(`📦 Found ${data.products?.length || 0} total products in store`)
    
    if (!data.products || data.products.length === 0) {
      return {
        inventory_quantity: 0,
        variants: [],
        found: false,
        error: 'No products found in store'
      }
    }
    
    // Step 2: Find products with matching SKU
    const matchingProducts = data.products.filter(product => {
      return product.variants.some(variant => 
        variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
      )
    })
    
    console.log(`🎯 Found ${matchingProducts.length} products with SKU ${sku}`)
    
    if (matchingProducts.length === 0) {
      return {
        inventory_quantity: 0,
        variants: [],
        found: false,
        error: `No product found with SKU ${sku}`
      }
    }
    
    // Step 3: Get inventory for all variants with this SKU
    let totalInventory = 0
    const variants = []
    
    for (const product of matchingProducts) {
      console.log(`📋 Processing product: "${product.title}"`)
      
      const matchingVariants = product.variants.filter(variant => 
        variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
      )
      
      console.log(`🔄 Found ${matchingVariants.length} variants with SKU ${sku}`)
      
      for (const variant of matchingVariants) {
        console.log(`📊 Getting inventory for variant: "${variant.title || variant.id}"`)
        
        try {
          // Get inventory levels for this variant
          const inventoryUrl = `https://${storeDomain}/admin/api/2025-01/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`
          
          const inventoryResponse = await shopifyFetch(inventoryUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          }, 'inventory')
          
          const inventoryData = await inventoryResponse.json()
          
          if (inventoryData.inventory_levels && inventoryData.inventory_levels.length > 0) {
            let variantTotal = 0
            
            for (const level of inventoryData.inventory_levels) {
              const quantity = level.available || 0
              variantTotal += quantity
              console.log(`📍 Location ${level.location_id}: ${quantity} units`)
            }
            
            totalInventory += variantTotal
            
            variants.push({
              variantId: variant.id,
              variantTitle: variant.title || `Variant ${variant.id}`,
              inventoryItemId: variant.inventory_item_id,
              quantity: variantTotal,
              locations: inventoryData.inventory_levels.map(level => ({
                locationId: level.location_id,
                quantity: level.available || 0
              }))
            })
            
            console.log(`✅ Variant "${variant.title || variant.id}": ${variantTotal} total units`)
          } else {
            console.log(`⚠️ No inventory levels found for variant ${variant.title || variant.id}`)
          }
        } catch (variantError) {
          console.error(`❌ Failed to get inventory for variant ${variant.title || variant.id}:`, variantError.message)
        }
      }
    }
    
    console.log(`🎉 Total inventory for SKU ${sku}: ${totalInventory} units across ${variants.length} variants`)
    
    return {
      inventory_quantity: totalInventory,
      variants: variants,
      found: true,
      total_variants: variants.length
    }
    
  } catch (error) {
    console.error(`💥 Error getting Shopify inventory for SKU ${sku}:`, error.message)
    return {
      inventory_quantity: 0,
      variants: [],
      found: false,
      error: error.message
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('🚀 === NEW INVENTORY COMPARISON API V2 ===')
    
    const { 
      page = 1, 
      limit = 25, 
      search = '', 
      status = 'all', 
      store = 'all', 
      category = 'all',
      sortBy = 'smart',
      sortOrder = 'desc'
    } = req.query
    
    const offset = (parseInt(page) - 1) * parseInt(limit)

    // Build search conditions
    let searchCondition = ''
    let queryParams = []
    let paramIndex = 1

    if (search && search.trim()) {
      searchCondition = `AND (LOWER(product_name) LIKE $${paramIndex} OR LOWER(sku) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    if (category && category !== 'all') {
      searchCondition += ` AND LOWER(category) = $${paramIndex}`
      queryParams.push(category.toLowerCase())
      paramIndex++
    }

    // Get products from local database
    console.log('📊 Fetching products from local database...')
    const productsResult = await query(`
      SELECT 
        id, sku, product_name, category, price, quantity, 
        description, image_url, is_active, created_at, updated_at,
        COALESCE(needs_sync, false) as needs_sync, 
        last_modified, last_synced
      FROM products 
      WHERE is_active = true ${searchCondition}
      ORDER BY product_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, parseInt(limit), offset])

    const products = productsResult.rows
    console.log(`📦 Found ${products.length} products in local database`)

    // Get total count
    const countResult = await query(`
      SELECT 
        COUNT(*) as all_total,
        COUNT(CASE WHEN COALESCE(needs_sync, false) = true THEN 1 END) as modified_total
      FROM products 
      WHERE is_active = true ${searchCondition}
    `, queryParams)
    
    const totalProducts = parseInt(countResult.rows[0].all_total)
    const modifiedProducts = parseInt(countResult.rows[0].modified_total)

    // Get connected stores
    console.log('🏪 Fetching connected stores...')
    const storesResult = await query(`
      SELECT id, store_name, store_domain, shopify_domain, access_token
      FROM stores 
      WHERE connected = true
    `)
    
    const stores = storesResult.rows
    console.log(`🔗 Found ${stores.length} connected stores`)

    if (stores.length === 0) {
      return res.status(200).json({
        success: true,
        comparisons: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalProducts,
          totalPages: Math.ceil(totalProducts / parseInt(limit)),
          hasNext: false,
          hasPrev: false
        },
        stats: {
          totalProducts,
          modifiedProducts
        },
        stores: [],
        message: 'No connected Shopify stores found'
      })
    }

    if (products.length === 0) {
      return res.status(200).json({
        success: true,
        comparisons: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalProducts,
          totalPages: Math.ceil(totalProducts / parseInt(limit)),
          hasNext: false,
          hasPrev: false
        },
        stats: {
          totalProducts,
          modifiedProducts
        },
        stores: stores.map(store => ({
          id: store.id,
          store_name: store.store_name,
          store_domain: store.store_domain
        })),
        message: 'No products found matching criteria.'
      })
    }

    // Process each product
    console.log('🔄 Processing inventory comparisons...')
    const comparisons = []

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      console.log(`\n📋 Processing product ${i + 1}/${products.length}: ${product.sku} - ${product.product_name}`)
      
      const shopifyQuantities = {}
      let totalShopifyQuantity = 0
      let totalVariantsFound = 0

      // Get inventory from each connected store
      for (const store of stores) {
        try {
          console.log(`  🏪 Fetching from store: ${store.store_name}`)
          
          const shopifyInventory = await getShopifyInventoryForSKU(
            store.shopify_domain,
            store.access_token,
            product.sku
          )

          console.log(`  📊 Store ${store.store_name} result:`, {
            found: shopifyInventory?.found,
            total_quantity: shopifyInventory?.inventory_quantity,
            variant_count: shopifyInventory?.total_variants,
            variants: shopifyInventory?.variants?.map(v => `${v.variantTitle}: ${v.quantity}`)
          })

          const quantity = shopifyInventory?.inventory_quantity || 0
          const variantCount = shopifyInventory?.total_variants || 0
          
          shopifyQuantities[store.id] = {
            quantity,
            store_name: store.store_name,
            variants: shopifyInventory?.variants || [],
            variant_count: variantCount,
            found: shopifyInventory?.found || false
          }
          
          totalShopifyQuantity += quantity
          totalVariantsFound += variantCount

          // Add delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`  ❌ Failed to get inventory for ${product.sku} from ${store.store_name}:`, error.message)
          shopifyQuantities[store.id] = {
            quantity: 0,
            store_name: store.store_name,
            variants: [],
            variant_count: 0,
            found: false,
            error: error.message
          }
        }
      }

      // Determine status
      const localQuantity = product.quantity
      const difference = localQuantity - totalShopifyQuantity

      let status = 'in_sync'
      if (totalShopifyQuantity === 0 && localQuantity > 0) {
        status = 'not_found'
      } else if (difference > 0) {
        status = 'local_higher'
      } else if (difference < 0) {
        status = 'shopify_higher'
      }

      comparisons.push({
        product: {
          id: product.id,
          sku: product.sku,
          product_name: product.product_name,
          category: product.category,
          price: product.price,
          quantity: product.quantity,
          description: product.description,
          image_url: product.image_url,
          is_active: product.is_active,
          created_at: product.created_at,
          updated_at: product.updated_at
        },
        local_quantity: localQuantity,
        shopify_quantities: shopifyQuantities,
        total_shopify_quantity: totalShopifyQuantity,
        total_variants_found: totalVariantsFound,
        difference,
        status
      })

      console.log(`  ✅ Final comparison for ${product.sku}:`, {
        local_quantity: localQuantity,
        total_shopify_quantity: totalShopifyQuantity,
        total_variants_found: totalVariantsFound,
        difference: difference,
        status: status
      })
    }

    // Apply filters
    let filteredComparisons = comparisons
    
    if (status && status !== 'all') {
      filteredComparisons = comparisons.filter(comp => comp.status === status)
    }

    if (store && store !== 'all') {
      filteredComparisons = filteredComparisons.filter(comp => 
        comp.shopify_quantities[store] && comp.shopify_quantities[store].quantity > 0
      )
    }

    // Apply sorting
    if (sortBy === 'smart' || sortBy === 'difference') {
      filteredComparisons.sort((a, b) => {
        const aHasShopifyInventory = a.total_shopify_quantity > 0
        const bHasShopifyInventory = b.total_shopify_quantity > 0
        
        if (aHasShopifyInventory && !bHasShopifyInventory) return -1
        if (!aHasShopifyInventory && bHasShopifyInventory) return 1
        
        if (aHasShopifyInventory && bHasShopifyInventory) {
          if (sortOrder === 'desc') {
            return b.total_shopify_quantity - a.total_shopify_quantity
          } else {
            return a.total_shopify_quantity - b.total_shopify_quantity
          }
        }
        
        const diffA = Math.abs(a.difference)
        const diffB = Math.abs(b.difference)
        if (sortOrder === 'desc') {
          return diffB - diffA
        } else {
          return diffA - diffB
        }
      })
    }

    console.log(`🎉 Completed inventory comparisons: ${comparisons.length}`)
    console.log('🚀 === NEW INVENTORY COMPARISON API V2 COMPLETED ===')

    res.status(200).json({
      success: true,
      comparisons: filteredComparisons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalProducts,
        totalPages: Math.ceil(totalProducts / parseInt(limit)),
        hasNext: offset + parseInt(limit) < totalProducts,
        hasPrev: parseInt(page) > 1
      },
      stats: {
        totalProducts,
        modifiedProducts
      },
      stores: stores.map(store => ({
        id: store.id,
        store_name: store.store_name,
        store_domain: store.store_domain
      }))
    })

  } catch (error) {
    console.error('💥 Error in inventory comparison API V2:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory comparison',
      error: error.message
    })
  }
}
