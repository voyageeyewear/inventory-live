const axios = require('axios');

async function testShopifySKU() {
  try {
    console.log('Testing Shopify SKU lookup for 891PMG4467 and 892PMG4475...');
    
    // Test the comparison API
    const response = await axios.get('https://inventory-live-production.up.railway.app/api/inventory/comparison?page=1&limit=5&search=PMG446');
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.comparisons) {
      console.log(`Found ${response.data.comparisons.length} comparisons`);
      
      response.data.comparisons.forEach((comp, index) => {
        console.log(`\n--- Product ${index + 1} ---`);
        console.log(`SKU: ${comp.product.sku}`);
        console.log(`Product Name: ${comp.product.product_name}`);
        console.log(`Local Quantity: ${comp.local_quantity}`);
        console.log(`Total Shopify Quantity: ${comp.total_shopify_quantity}`);
        console.log(`Total Variants Found: ${comp.total_variants_found}`);
        console.log(`Status: ${comp.status}`);
        console.log(`Shopify Quantities:`, comp.shopify_quantities);
      });
    }
    
  } catch (error) {
    console.error('Error testing Shopify SKU:', error.response?.data || error.message);
  }
}

testShopifySKU();
