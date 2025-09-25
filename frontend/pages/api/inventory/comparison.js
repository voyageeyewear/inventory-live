import { query } from '../../../lib/postgres'
import { getShopifyInventory } from '../../../services/shopifyService'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('=== INVENTORY COMPARISON API CALLED ===')
    
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
        try {
          console.log(`  Fetching from store: ${store.store_name}`)
          
          const shopifyInventory = await getShopifyInventory(
            store.shopify_domain,
            store.access_token,
            product.sku
          )

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

          // Add delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`  Failed to get inventory for ${product.sku} from ${store.store_name}:`, error)
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory comparison',
      error: error.message
    })
  }
}