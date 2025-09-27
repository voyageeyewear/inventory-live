import { query } from '../../../lib/postgres'

// Enhanced Shopify service with better error handling and logging
async function getShopifyInventoryForSKU(storeDomain, accessToken, sku, storeId) {
  try {
    console.log(`🔍 Searching for SKU ${sku} in store ${storeDomain}`)
    
    let allProducts = []
    let pageInfo = null
    let page = 1
    let hasMore = true
    const maxPages = 50 // Increased limit
    
    while (hasMore && page <= maxPages) {
      try {
        let url = `https://${storeDomain}/admin/api/2023-10/products.json?limit=250`
        if (pageInfo) {
          url += `&page_info=${pageInfo}`
        }
        
        console.log(`📄 Fetching page ${page}...`)
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          console.error(`❌ HTTP error: ${response.status} ${response.statusText}`)
          break
        }
        
        const data = await response.json()
        
        if (!data.products || data.products.length === 0) {
          console.log(`No more products found on page ${page}`)
          hasMore = false
          break
        }
        
        allProducts = allProducts.concat(data.products)
        console.log(`📦 Page ${page}: Found ${data.products.length} products, total: ${allProducts.length}`)
        
        // Check for next page using Link header
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
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message)
        hasMore = false
      }
    }
    
    console.log(`📊 Total products fetched: ${allProducts.length}`)
    
    // Find products with matching SKU
    const matchingProducts = allProducts.filter(product => 
      product.variants.some(variant => variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim())
    )
    
    console.log(`🎯 Found ${matchingProducts.length} products with SKU ${sku}`)
    
    if (matchingProducts.length === 0) {
      return {
        inventory_quantity: 0,
        variants: [],
        found: false,
        total_variants: 0,
        message: `SKU ${sku} not found in Shopify`
      }
    }
    
    // Process all matching products and their variants
    const allVariants = []
    let totalInventory = 0
    
    for (const product of matchingProducts) {
      console.log(`🔄 Processing product: ${product.title} (ID: ${product.id})`)
      
      const matchingVariants = product.variants.filter(variant => 
        variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
      )
      
      console.log(`📋 Found ${matchingVariants.length} variants with SKU ${sku}`)
      
      for (const variant of matchingVariants) {
        try {
          // Get inventory levels for this variant
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
          
          let variantQuantity = 0
          const locations = []
          
          if (inventoryData.inventory_levels && inventoryData.inventory_levels.length > 0) {
            for (const level of inventoryData.inventory_levels) {
              variantQuantity += level.available || 0
              locations.push({
                locationId: level.location_id,
                quantity: level.available || 0
              })
            }
          }
          
          allVariants.push({
            variantId: variant.id,
            variantTitle: variant.title || 'Default Title',
            inventoryItemId: variant.inventory_item_id,
            quantity: variantQuantity,
            locations: locations
          })
          
          totalInventory += variantQuantity
          
          console.log(`✅ Variant ${variant.title}: ${variantQuantity} units`)
          
        } catch (error) {
          console.error(`❌ Error processing variant ${variant.id}:`, error.message)
        }
      }
    }
    
    console.log(`🎉 Total inventory for SKU ${sku}: ${totalInventory} units across ${allVariants.length} variants`)
    
    return {
      inventory_quantity: totalInventory,
      variants: allVariants,
      found: true,
      total_variants: allVariants.length,
      products_found: matchingProducts.length
    }
    
  } catch (error) {
    console.error(`💥 Error getting Shopify inventory for SKU ${sku}:`, error.message)
    return {
      inventory_quantity: 0,
      variants: [],
      found: false,
      total_variants: 0,
      error: error.message
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('🚀 === NEW INVENTORY COMPARISON API V3 ===')
    
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
      // If search looks like a SKU (alphanumeric with specific pattern), search by exact SKU
      if (/^[A-Z0-9]+$/.test(search.trim())) {
        searchCondition = `AND LOWER(sku) = $${paramIndex}`
        queryParams.push(search.toLowerCase().trim())
      } else {
        searchCondition = `AND (LOWER(product_name) LIKE $${paramIndex} OR LOWER(sku) LIKE $${paramIndex})`
        queryParams.push(`%${search.toLowerCase()}%`)
      }
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
        *,
        COALESCE(needs_sync, true) as needs_sync,
        last_modified,
        last_synced,
        CASE 
          WHEN last_synced IS NULL THEN 'Never synced'
          WHEN last_modified > last_synced THEN 'Modified since last sync'
          ELSE 'Up to date'
        END as sync_status
      FROM products 
      WHERE is_active = true ${searchCondition}
      ORDER BY 
        CASE WHEN $${paramIndex} = 'smart' THEN 
          CASE WHEN COALESCE(needs_sync, true) = true THEN 0 ELSE 1 END
        ELSE 0 END,
        product_name ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `, [...queryParams, sortBy, parseInt(limit), offset])

    const products = productsResult.rows
    console.log(`📦 Found ${products.length} products in local database`)

    // Get total count
    const countResult = await query(`
      SELECT 
        COUNT(*) as all_total,
        COUNT(CASE WHEN COALESCE(needs_sync, true) = true THEN 1 END) as modified_total
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
            product.sku,
            store.id
          )

          shopifyQuantities[store.id] = {
            quantity: shopifyInventory.inventory_quantity,
            store_name: store.store_name,
            variants: shopifyInventory.variants,
            variant_count: shopifyInventory.total_variants,
            found: shopifyInventory.found,
            error: shopifyInventory.error
          }

          totalShopifyQuantity += shopifyInventory.inventory_quantity
          totalVariantsFound += shopifyInventory.total_variants

          console.log(`  📊 Store ${store.store_name}: ${shopifyInventory.inventory_quantity} units, ${shopifyInventory.total_variants} variants`)

        } catch (error) {
          console.error(`  ❌ Error fetching from store ${store.store_name}:`, error.message)
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

      // Calculate difference and status
      const localQuantity = product.quantity || 0
      const difference = localQuantity - totalShopifyQuantity
      
      let status = 'in_sync'
      if (totalVariantsFound === 0) {
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
          updated_at: product.updated_at,
          needs_sync: product.needs_sync,
          last_modified: product.last_modified,
          last_synced: product.last_synced,
          sync_status: product.sync_status
        },
        local_quantity: localQuantity,
        shopify_quantities: shopifyQuantities,
        total_shopify_quantity: totalShopifyQuantity,
        total_variants_found: totalVariantsFound,
        difference: difference,
        status: status
      })

      console.log(`  ✅ Final comparison for ${product.sku}:`, {
        local_quantity: localQuantity,
        total_shopify_quantity: totalShopifyQuantity,
        total_variants_found: totalVariantsFound,
        difference: difference,
        status: status
      })
    }

    console.log(`🎉 Completed inventory comparisons: ${comparisons.length}`)

    return res.status(200).json({
      success: true,
      comparisons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalProducts,
        totalPages: Math.ceil(totalProducts / parseInt(limit)),
        hasNext: parseInt(page) < Math.ceil(totalProducts / parseInt(limit)),
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
    console.error('💥 Error in inventory comparison API:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    })
  }
}
