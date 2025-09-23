// Frontend Shopify service functions for API calls

/**
 * Get Shopify inventory for a specific SKU from a store
 */
export async function getShopifyInventory(storeDomain, accessToken, sku) {
  try {
    const response = await fetch(`https://${storeDomain}/admin/api/2023-10/products.json?limit=250`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`)
    }

    const data = await response.json()
    const products = data.products || []

    // Search for the SKU in all products and variants
    for (const product of products) {
      for (const variant of product.variants) {
        if (variant.sku === sku) {
          return {
            product_id: product.id,
            variant_id: variant.id,
            inventory_quantity: variant.inventory_quantity || 0,
            inventory_item_id: variant.inventory_item_id
          }
        }
      }
    }

    return null // SKU not found
  } catch (error) {
    console.error(`Error fetching Shopify inventory for SKU ${sku}:`, error)
    throw error
  }
}

/**
 * Update Shopify inventory for a specific SKU
 */
export async function updateShopifyInventory(storeDomain, accessToken, sku, quantity) {
  try {
    // First, find the product by SKU
    const inventoryData = await getShopifyInventory(storeDomain, accessToken, sku)
    
    if (!inventoryData) {
      return {
        success: false,
        message: `Product with SKU "${sku}" not found in store`
      }
    }

    // Get locations to find the primary location
    const locationsResponse = await fetch(`https://${storeDomain}/admin/api/2023-10/locations.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    })

    if (!locationsResponse.ok) {
      throw new Error(`Failed to fetch locations: ${locationsResponse.status}`)
    }

    const locationsData = await locationsResponse.json()
    const locations = locationsData.locations || []
    
    if (locations.length === 0) {
      return {
        success: false,
        message: 'No locations found in store'
      }
    }

    const locationId = locations[0].id // Use first location

    // Update inventory level
    const updateResponse = await fetch(`https://${storeDomain}/admin/api/2023-10/inventory_levels/set.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location_id: locationId,
        inventory_item_id: inventoryData.inventory_item_id,
        available: quantity
      })
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to update inventory: ${updateResponse.status} - ${errorText}`)
    }

    const updateData = await updateResponse.json()

    return {
      success: true,
      message: `Successfully updated ${sku} to ${quantity} units`,
      inventory_level: updateData.inventory_level
    }

  } catch (error) {
    console.error(`Error updating Shopify inventory for SKU ${sku}:`, error)
    return {
      success: false,
      message: error.message || 'Unknown error occurred'
    }
  }
}
