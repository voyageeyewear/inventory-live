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
