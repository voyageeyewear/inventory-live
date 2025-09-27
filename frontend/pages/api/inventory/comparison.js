import { query } from '../../../lib/postgres'
import { shopifyFetch } from '../../../services/shopifyService'
import jwt from 'jsonwebtoken'

// Direct implementation of getShopifyInventory to avoid import issues
const getShopifyInventory = async (storeDomain, accessToken, sku) => {
  try {
    console.log(`Getting Shopify inventory for SKU ${sku} from store ${storeDomain}`)
    
    // Get ALL products with pagination to find products with matching SKU
    let allProducts = []
    let page = 1
    let hasMore = true
    
    console.log('Searching through all products to find SKU:', sku)
    
    // Simple API test
    console.log('Testing Shopify API connection for SKU:', sku)
    
    // Fetch products in batches until we find the SKU or exhaust all products
    while (hasMore && allProducts.length < 1000) { // Limit to prevent infinite loops
      try {
        const url = `https://${storeDomain}/admin/api/2023-10/products.json?page=${page}&limit=250`
        
        const response = await shopifyFetch(url, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        }, 'inventory-check')

        const data = await response.json()
        
        console.log(`Page ${page} response:`, {
          status: response.status,
          hasProducts: !!data.products,
          productCount: data.products?.length || 0,
          error: data.error
        })
        
        if (!data.products || data.products.length === 0) {
          hasMore = false
          break
        }
        
        allProducts = allProducts.concat(data.products)
        console.log(`Page ${page}: Found ${data.products.length} products, total: ${allProducts.length}`)
        
        // Check if we found any products with this SKU (case insensitive)
        const productsWithSku = data.products.filter(product => 
          product.variants.some(variant => 
            variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
          )
        )
        
        if (productsWithSku.length > 0) {
          console.log(`Found ${productsWithSku.length} products with SKU ${sku} on page ${page}`)
        }
        
        page++
        
        // Add delay to respect rate limits - increased for stability
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        console.error(`Error fetching products page ${page}:`, error.message)
        // Don't immediately stop on first error, try a few more pages
        if (page > 3) {
          hasMore = false
        } else {
          // Wait longer and retry
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
    
    console.log(`Total products fetched: ${allProducts.length}`)
    
    // Find all products that have variants with the matching SKU (case insensitive)
    const matchingProducts = allProducts.filter(product => 
      product.variants.some(variant => 
        variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
      )
    )

    console.log(`Found ${matchingProducts.length} products with SKU ${sku}`)

    if (matchingProducts.length === 0) {
      console.log(`No products found with SKU ${sku} for inventory check`)
      return {
        inventory_quantity: 0,
        variants: [],
        found: false,
        error: `No products found with SKU ${sku} in Shopify store`
      }
    }

    let totalInventory = 0
    const variants = []

    // Get inventory for all variants with this SKU
    for (const product of matchingProducts) {
      console.log(`Processing product: "${product.title}" (ID: ${product.id})`)
      console.log(`Product has ${product.variants.length} total variants`)
      
      const matchingVariants = product.variants.filter(variant => 
        variant.sku && variant.sku.toLowerCase().trim() === sku.toLowerCase().trim()
      )
      console.log(`Found ${matchingVariants.length} variants with SKU ${sku}`)
      
      for (const variant of matchingVariants) {
        console.log(`Processing variant: "${variant.title}" (ID: ${variant.id}) with SKU ${variant.sku}`)
        try {
          // Get current inventory level
          const inventoryUrl = `https://${storeDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`
          
          const inventoryResponse = await shopifyFetch(inventoryUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          }, 'inventory-check')

          const inventoryData = await inventoryResponse.json()
          
          if (inventoryData.inventory_levels && inventoryData.inventory_levels.length > 0) {
            // Sum inventory across all locations for this variant
            let variantTotalQuantity = 0
            const variantLocations = []
            
            for (const level of inventoryData.inventory_levels) {
              const locationQuantity = level.available || 0
              variantTotalQuantity += locationQuantity
              variantLocations.push({
                locationId: level.location_id,
                quantity: locationQuantity
              })
            }
            
            totalInventory += variantTotalQuantity
            variants.push({
              variantId: variant.id,
              variantTitle: variant.title || variant.id,
              inventoryItemId: variant.inventory_item_id,
              quantity: variantTotalQuantity,
              locations: variantLocations
            })
            
            console.log(`Variant ${variant.title || variant.id}: ${variantTotalQuantity} units across ${variantLocations.length} locations`)
          } else {
            console.log(`No inventory levels found for variant ${variant.title || variant.id}`)
          }
        } catch (variantError) {
          console.error(`Failed to get inventory for variant ${variant.title || variant.id}:`, variantError.message)
        }
      }
    }

    console.log(`Total inventory for SKU ${sku}: ${totalInventory} units across ${variants.length} variants`)

    return {
      inventory_quantity: totalInventory,
      variants: variants,
      found: true,
      total_variants: variants.length
    }

  } catch (error) {
    console.error(`Failed to get Shopify inventory for SKU ${sku}:`, error.message)
    return {
      inventory_quantity: 0,
      variants: [],
      found: false,
      error: error.message
    }
  }
}

// Middleware to authenticate token
const authenticateToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    throw new Error('No token provided')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'inventory-jwt-secret-2024-secure-key'); // Force deployment
    
    const userResult = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.id])

    if (userResult.rows.length === 0) {
      throw new Error('Invalid token or user inactive')
    }

    return userResult.rows[0]
  } catch (error) {
    throw new Error('Authentication failed')
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Authenticate user
    const user = await authenticateToken(req)
    console.log('Authenticated user:', user.username)
    console.log('=== INVENTORY COMPARISON API CALLED ===')
    console.log('Request timestamp:', new Date().toISOString())
    
    const { 
      page = 1, 
      limit = 25, 
      search = '', 
      status = 'all', 
      store = 'all', 
      category = 'all',
      sortBy = 'smart',
      sortOrder = 'desc',
      _t = Date.now() // Cache busting parameter
    } = req.query
    
    const offset = (parseInt(page) - 1) * parseInt(limit)

    console.log('Request params:', { page, limit, search, status, store, category, sortBy, sortOrder })

    // Build search condition
    let searchCondition = ''
    let queryParams = []
    let paramIndex = 1

    if (search && search.trim()) {
      searchCondition = `AND (LOWER(product_name) LIKE $${paramIndex} OR LOWER(sku) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    // Build category filter
    if (category && category !== 'all') {
      searchCondition += ` AND LOWER(category) = $${paramIndex}`
      queryParams.push(category.toLowerCase())
      paramIndex++
    }

    // Get ALL active products from local database with optional search
    console.log('Fetching products from local database...')
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
    console.log(`Found ${products.length} products in local database`)

    // Get total count for pagination (with search filter)
    const countResult = await query(`
      SELECT 
        COUNT(*) as all_total,
        COUNT(CASE WHEN COALESCE(needs_sync, false) = true THEN 1 END) as modified_total
      FROM products 
      WHERE is_active = true ${searchCondition}
    `, queryParams)
    
    const totalProducts = parseInt(countResult.rows[0].all_total)
    const modifiedProducts = parseInt(countResult.rows[0].modified_total)

    // Get all connected stores
    console.log('Fetching connected stores...')
    const storesResult = await query(`
      SELECT id, store_name, store_domain, shopify_domain, access_token
      FROM stores 
      WHERE connected = true
    `)

    const stores = storesResult.rows
    console.log(`Found ${stores.length} connected stores`)

    if (stores.length === 0) {
      return res.status(200).json({
        success: true,
        comparisons: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
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
        message: 'No products found matching criteria'
      })
    }

    // Fetch Shopify inventory for paginated products across all stores
    console.log('Fetching Shopify inventory for products...')
    const comparisons = []

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      console.log(`Processing product ${i + 1}/${products.length}: ${product.sku} - ${product.product_name}`)
      
      const shopifyQuantities = {}
      let totalShopifyQuantity = 0
      let totalVariantsFound = 0

      // Get inventory from each connected store
      for (const store of stores) {
        let retryCount = 0
        let success = false
        
        while (retryCount < 3 && !success) {
          try {
            console.log(`  Fetching from store: ${store.store_name} (attempt ${retryCount + 1})`)
            console.log(`  Calling getShopifyInventory with:`, {
              domain: store.shopify_domain,
              sku: product.sku,
              tokenLength: store.access_token?.length
            })
            
            const shopifyInventory = await getShopifyInventory(
              store.shopify_domain,
              store.access_token,
              product.sku
            )
            
            console.log(`  getShopifyInventory returned:`, shopifyInventory)

            console.log(`  Store ${store.store_name} result:`, {
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
            success = true

            // Add delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            retryCount++
            console.error(`  Failed to get inventory for ${product.sku} from ${store.store_name} (attempt ${retryCount}):`, error.message)
            
            if (retryCount >= 3) {
              // Final failure - set default values
              shopifyQuantities[store.id] = {
                quantity: 0,
                store_name: store.store_name,
                variants: [],
                variant_count: 0,
                found: false,
                error: error.message
              }
            } else {
              // Wait before retry with exponential backoff
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
            }
          }
        }
      }

      // Calculate difference and status
      const localQuantity = product.quantity
      const difference = localQuantity - totalShopifyQuantity

      let status = 'in_sync'
      if (totalVariantsFound === 0) {
        status = 'not_found'
      } else if (difference > 0) {
        status = 'local_higher'
      } else if (difference < 0) {
        status = 'shopify_higher'
      }

      console.log(`  Final comparison for ${product.sku}:`, {
        local_quantity: localQuantity,
        total_shopify_quantity: totalShopifyQuantity,
        total_variants_found: totalVariantsFound,
        difference,
        status
      })

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
    }

    console.log('Completed inventory comparisons:', comparisons.length)

    // Apply status filter
    let filteredComparisons = comparisons
    if (status && status !== 'all') {
      filteredComparisons = comparisons.filter(comp => comp.status === status)
      console.log(`Filtered by status '${status}': ${filteredComparisons.length} products`)
    }

    // Apply store filter
    if (store && store !== 'all') {
      filteredComparisons = filteredComparisons.filter(comp => 
        comp.shopify_quantities[store] !== undefined
      )
      console.log(`Filtered by store '${store}': ${filteredComparisons.length} products`)
    }

    // Apply smart sorting - prioritize products that exist in Shopify stores
    if (sortBy === 'smart') {
      filteredComparisons.sort((a, b) => {
        // First priority: Products that exist in Shopify stores (have variants)
        const aHasVariants = a.total_variants_found > 0
        const bHasVariants = b.total_variants_found > 0
        
        if (aHasVariants && !bHasVariants) return -1
        if (!aHasVariants && bHasVariants) return 1
        
        // Second priority: Products with more variants
        if (aHasVariants && bHasVariants) {
          if (sortOrder === 'desc') {
            return b.total_variants_found - a.total_variants_found
          } else {
            return a.total_variants_found - b.total_variants_found
          }
        }
        
        // Third priority: Products with higher Shopify inventory
        if (aHasVariants && bHasVariants) {
          if (sortOrder === 'desc') {
            return b.total_shopify_quantity - a.total_shopify_quantity
          } else {
            return a.total_shopify_quantity - b.total_shopify_quantity
          }
        }
        
        // Fourth priority: Products with larger differences (need more attention)
        const diffA = Math.abs(a.difference)
        const diffB = Math.abs(b.difference)
        if (sortOrder === 'desc') {
          return diffB - diffA
        } else {
          return diffA - diffB
        }
      })
    }

    // Apply difference sorting
    if (sortBy === 'difference') {
      filteredComparisons.sort((a, b) => {
        const diffA = Math.abs(a.difference)
        const diffB = Math.abs(b.difference)
        return sortOrder === 'desc' ? diffB - diffA : diffA - diffB
      })
    }

    // Apply shopify quantity sorting
    if (sortBy === 'shopify_quantity') {
      filteredComparisons.sort((a, b) => {
        return sortOrder === 'desc' 
          ? b.total_shopify_quantity - a.total_shopify_quantity
          : a.total_shopify_quantity - b.total_shopify_quantity
      })
    }

    console.log('=== INVENTORY COMPARISON API COMPLETED ===')

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
    console.error('=== INVENTORY COMPARISON API ERROR ===')
    console.error('Error fetching inventory comparison:', error)
    
    if (error.message === 'No token provided' || error.message === 'Authentication failed') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: error.message
      })
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory comparison',
      error: error.message
    })
  }
}