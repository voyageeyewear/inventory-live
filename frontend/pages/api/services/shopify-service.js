import { query } from '../../../lib/postgres'

// Rate limiting configuration
const RATE_LIMITS = {
  requestsPerSecond: 2, // Conservative limit
  burstLimit: 10,
  retryAfter: 1000 // Default retry delay in ms
}

// Request queue for rate limiting
const requestQueue = []
let isProcessingQueue = false

// Track request counts per store
const storeRequestCounts = new Map()

class ShopifyRateLimiter {
  constructor(storeId) {
    this.storeId = storeId
    this.requests = []
    this.lastReset = Date.now()
  }

  canMakeRequest() {
    const now = Date.now()
    
    // Reset counter every second
    if (now - this.lastReset >= 1000) {
      this.requests = this.requests.filter(time => now - time < 1000)
      this.lastReset = now
    }
    
    return this.requests.length < RATE_LIMITS.requestsPerSecond
  }

  recordRequest() {
    this.requests.push(Date.now())
  }

  getWaitTime() {
    if (this.requests.length === 0) return 0
    
    const oldestRequest = Math.min(...this.requests)
    const waitTime = 1000 - (Date.now() - oldestRequest)
    return Math.max(0, waitTime)
  }
}

// Get or create rate limiter for store
const getRateLimiter = (storeId) => {
  if (!storeRequestCounts.has(storeId)) {
    storeRequestCounts.set(storeId, new ShopifyRateLimiter(storeId))
  }
  return storeRequestCounts.get(storeId)
}

// Enhanced fetch with rate limiting and retry logic
const shopifyFetch = async (url, options, storeId, retryCount = 0) => {
  const rateLimiter = getRateLimiter(storeId)
  
  // Wait if we're at rate limit
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getWaitTime()
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  
  // Record this request
  rateLimiter.recordRequest()
  
  try {
    const response = await fetch(url, options)
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : RATE_LIMITS.retryAfter
      
      console.log(`Rate limited for store ${storeId}. Waiting ${waitTime}ms before retry ${retryCount + 1}`)
      
      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return shopifyFetch(url, options, storeId, retryCount + 1)
      } else {
        throw new Error(`Rate limit exceeded after ${retryCount + 1} retries for store ${storeId}`)
      }
    }
    
    // Handle other HTTP errors
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shopify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }
    
    return response
  } catch (error) {
    // Handle network errors with retry
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      if (retryCount < 2) {
        const waitTime = Math.pow(2, retryCount) * 1000 // Exponential backoff
        console.log(`Network error for store ${storeId}. Retrying in ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return shopifyFetch(url, options, storeId, retryCount + 1)
      }
    }
    
    throw error
  }
}

// Enhanced function to update inventory in Shopify store with rate limiting
export const updateShopifyInventory = async (store, product) => {
  try {
    console.log(`Starting sync for product ${product.sku} to store ${store.store_name}`)
    
    // First, search for the product by SKU in Shopify
    const searchUrl = `https://${store.store_domain}/admin/api/2023-10/products.json?fields=id,variants&limit=250`
    
    const searchResponse = await shopifyFetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    }, store.id)

    const searchData = await searchResponse.json()
    let targetVariant = null
    let targetProduct = null

    // Find the product variant with matching SKU
    for (const shopifyProduct of searchData.products) {
      for (const variant of shopifyProduct.variants) {
        if (variant.sku === product.sku) {
          targetVariant = variant
          targetProduct = shopifyProduct
          break
        }
      }
      if (targetVariant) break
    }

    if (!targetVariant) {
      throw new Error(`Product with SKU "${product.sku}" not found in Shopify store`)
    }

    // Get current inventory levels
    const inventoryUrl = `https://${store.store_domain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${targetVariant.inventory_item_id}`
    
    const inventoryResponse = await shopifyFetch(inventoryUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    }, store.id)

    const inventoryData = await inventoryResponse.json()
    const currentLevel = inventoryData.inventory_levels[0]
    const previousQuantity = currentLevel ? currentLevel.available : 0

    // Update inventory level
    const updateUrl = `https://${store.store_domain}/admin/api/2023-10/inventory_levels/set.json`
    
    const updateResponse = await shopifyFetch(updateUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location_id: currentLevel.location_id,
        inventory_item_id: targetVariant.inventory_item_id,
        available: product.quantity
      })
    }, store.id)

    const updateData = await updateResponse.json()

    console.log(`Successfully synced product ${product.sku} to store ${store.store_name}`)

    return {
      success: true,
      previousQuantity: previousQuantity,
      newQuantity: product.quantity,
      shopifyProductId: targetProduct.id,
      shopifyVariantId: targetVariant.id,
      inventoryItemId: targetVariant.inventory_item_id
    }
  } catch (error) {
    console.error(`Failed to sync product ${product.sku} to store ${store.store_name}:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// Sync all variants of a SKU to the same quantity
export const syncAllVariantsForSKU = async (store, sku, quantity) => {
  try {
    console.log(`Syncing all variants for SKU ${sku} to quantity ${quantity} in store ${store.store_name}`)
    
    // Search for product by SKU
    const searchUrl = `https://${store.store_domain}/admin/api/2023-10/products.json?title=${encodeURIComponent(sku)}`
    
    const searchResponse = await shopifyFetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    }, store.id)

    const searchData = await searchResponse.json()
    
    if (!searchData.products || searchData.products.length === 0) {
      console.log(`No product found for SKU ${sku} in store ${store.store_name}`)
      return {
        success: false,
        message: `Product with SKU ${sku} not found in Shopify`,
        variantsUpdated: 0
      }
    }

    // Find all products that match the SKU (could be multiple if SKU is in title)
    const matchingProducts = searchData.products.filter(product => 
      product.variants.some(variant => variant.sku === sku)
    )

    if (matchingProducts.length === 0) {
      return {
        success: false,
        message: `No product with exact SKU ${sku} found`,
        variantsUpdated: 0
      }
    }

    let totalVariantsUpdated = 0
    const results = []

    // Process each matching product
    for (const product of matchingProducts) {
      // Find all variants with the matching SKU
      const matchingVariants = product.variants.filter(variant => variant.sku === sku)
      
      for (const variant of matchingVariants) {
        try {
          console.log(`Updating variant ${variant.title || variant.id} for SKU ${sku}`)
          
          // Get current inventory level
          const inventoryUrl = `https://${store.store_domain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`
          
          const inventoryResponse = await shopifyFetch(inventoryUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': store.access_token,
              'Content-Type': 'application/json'
            }
          }, store.id)

          const inventoryData = await inventoryResponse.json()
          
          if (!inventoryData.inventory_levels || inventoryData.inventory_levels.length === 0) {
            console.log(`No inventory level found for variant ${variant.id}`)
            continue
          }

          const currentLevel = inventoryData.inventory_levels[0]
          const previousQuantity = currentLevel.available

          // Update inventory level for this variant
          const updateUrl = `https://${store.store_domain}/admin/api/2023-10/inventory_levels/set.json`
          
          const updateResponse = await shopifyFetch(updateUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': store.access_token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              location_id: currentLevel.location_id,
              inventory_item_id: variant.inventory_item_id,
              available: quantity
            })
          }, store.id)

          const updateData = await updateResponse.json()
          
          totalVariantsUpdated++
          results.push({
            variantTitle: variant.title || variant.id,
            variantId: variant.id,
            previousQuantity: previousQuantity,
            newQuantity: quantity,
            success: true
          })
          
          console.log(`Successfully updated variant ${variant.title || variant.id} from ${previousQuantity} to ${quantity}`)
          
        } catch (variantError) {
          console.error(`Failed to update variant ${variant.title || variant.id}:`, variantError.message)
          results.push({
            variantTitle: variant.title || variant.id,
            variantId: variant.id,
            success: false,
            error: variantError.message
          })
        }
      }
    }

    return {
      success: totalVariantsUpdated > 0,
      message: `Updated ${totalVariantsUpdated} variants for SKU ${sku}`,
      variantsUpdated: totalVariantsUpdated,
      results: results
    }

  } catch (error) {
    console.error(`Failed to sync all variants for SKU ${sku} in store ${store.store_name}:`, error.message)
    return {
      success: false,
      message: error.message,
      variantsUpdated: 0
    }
  }
}

// Batch sync function with proper rate limiting
export const batchSyncProducts = async (store, products, onProgress = null) => {
  const results = []
  
  // Process products sequentially to avoid rate limiting completely
  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    
    try {
      console.log(`Syncing product ${i + 1}/${products.length}: ${product.sku}`)
      const result = await updateShopifyInventory(store, product)
      
      if (onProgress) {
        onProgress(i + 1, products.length, product.sku, result.success)
      }
      
      results.push(result)
      
      // Add delay between each product to avoid rate limiting
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
      }
      
    } catch (error) {
      console.error(`Failed to sync product ${product.sku}:`, error.message)
      
      if (onProgress) {
        onProgress(i + 1, products.length, product.sku, false)
      }
      
      results.push({
        success: false,
        error: error.message,
        product_name: product.product_name,
        sku: product.sku
      })
      
      // Still add delay even on failure
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  return results
}

// Test Shopify connection with rate limiting
export const testShopifyConnection = async (store) => {
  try {
    const testUrl = `https://${store.store_domain}/admin/api/2023-10/shop.json`
    
    const response = await shopifyFetch(testUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    }, store.id)
    
    const data = await response.json()
    return {
      success: true,
      shop: data.shop
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// Get store rate limit status
export const getStoreRateLimitStatus = (storeId) => {
  const rateLimiter = getRateLimiter(storeId)
  return {
    canMakeRequest: rateLimiter.canMakeRequest(),
    waitTime: rateLimiter.getWaitTime(),
    requestCount: rateLimiter.requests.length
  }
}
