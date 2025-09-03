const fetch = require('node-fetch');

class ShopifyService {
  constructor(storeDomain, accessToken) {
    this.storeDomain = storeDomain;
    this.accessToken = accessToken;
    this.baseUrl = `https://${storeDomain}/admin/api/2023-10`;
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getProducts(limit = 250) {
    try {
      const response = await this.makeRequest(`/products.json?limit=${limit}`);
      return response.products || [];
    } catch (error) {
      console.error('Error fetching products from Shopify:', error);
      throw error;
    }
  }

  async getProductBySku(sku) {
    try {
      // Search for product variants by SKU
      const response = await this.makeRequest(`/products.json?limit=250`);
      const products = response.products || [];
      
      for (const product of products) {
        for (const variant of product.variants) {
          if (variant.sku === sku) {
            return {
              product,
              variant
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding product by SKU:', error);
      throw error;
    }
  }

  async updateInventoryQuantity(variantId, quantity, locationId = null) {
    try {
      // If no location ID provided, get the first location
      if (!locationId) {
        const locations = await this.getLocations();
        if (locations.length === 0) {
          throw new Error('No locations found in store');
        }
        locationId = locations[0].id;
      }

      // Get current inventory item
      const variant = await this.makeRequest(`/variants/${variantId}.json`);
      const inventoryItemId = variant.variant.inventory_item_id;

      // Update inventory level
      const response = await this.makeRequest('/inventory_levels/set.json', 'POST', {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: quantity
      });

      return response;
    } catch (error) {
      console.error('Error updating inventory quantity:', error);
      throw error;
    }
  }

  async getLocations() {
    try {
      const response = await this.makeRequest('/locations.json');
      return response.locations || [];
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      const shopifyProduct = {
        product: {
          title: productData.product_name,
          vendor: 'Default',
          product_type: 'Default',
          variants: [{
            sku: productData.sku,
            inventory_quantity: productData.quantity,
            inventory_management: 'shopify'
          }]
        }
      };

      if (productData.image_url) {
        shopifyProduct.product.images = [{
          src: productData.image_url
        }];
      }

      const response = await this.makeRequest('/products.json', 'POST', shopifyProduct);
      return response.product;
    } catch (error) {
      console.error('Error creating product in Shopify:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.makeRequest('/shop.json');
      return { success: true, shop: response.shop };
    } catch (error) {
      console.error('Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Static method for updating inventory by SKU
  static async updateInventory(storeDomain, accessToken, sku, quantity) {
    try {
      const service = new ShopifyService(storeDomain, accessToken);
      
      // Find the product by SKU
      const productData = await service.getProductBySku(sku);
      
      if (!productData) {
        return {
          success: false,
          error: `Product with SKU "${sku}" not found in store`
        };
      }

      // Get current inventory quantity before updating
      const oldQuantity = productData.variant.inventory_quantity || 0;

      // Update the inventory quantity
      await service.updateInventoryQuantity(productData.variant.id, quantity);
      
      return {
        success: true,
        message: `Updated ${sku} to ${quantity} units`,
        product_id: productData.product.id,
        variant_id: productData.variant.id,
        old_quantity: oldQuantity,
        new_quantity: quantity,
        quantity_change: quantity - oldQuantity
      };
      
    } catch (error) {
      console.error(`Error updating inventory for SKU ${sku}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ShopifyService;

