const csv = require('csv-parser');
const { Readable } = require('stream');

const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv())
      .on('data', (data) => {
        // Clean up the data by trimming whitespace from keys and values
        const cleanData = {};
        Object.keys(data).forEach(key => {
          const cleanKey = key.trim();
          const cleanValue = data[key] ? data[key].toString().trim() : '';
          cleanData[cleanKey] = cleanValue;
        });
        results.push(cleanData);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

const validateProductCSV = (data) => {
  const errors = [];
  
  data.forEach((row, index) => {
    const rowNum = index + 1;
    
    // Check required fields - support multiple column name formats
    const productName = row['Product Name'] || row['product_name'] || row['Title'] || row['title'];
    const sku = row['SKU'] || row['sku'] || row['Variant SKU'] || row['variant_sku'];
    const quantity = row['Quantity'] || row['quantity'] || row['Variant Inventory Qty'] || row['variant_inventory_qty'];
    
    if (!productName) {
      errors.push(`Row ${rowNum}: Product Name/Title is required`);
    }
    
    if (!sku) {
      errors.push(`Row ${rowNum}: SKU/Variant SKU is required`);
    }
    
    if (!quantity && quantity !== 0) {
      errors.push(`Row ${rowNum}: Quantity/Variant Inventory Qty is required`);
    }
    
    // Validate quantity is a number
    if (quantity && isNaN(parseInt(quantity))) {
      errors.push(`Row ${rowNum}: Quantity must be a number`);
    }
  });
  
  return errors;
};

const validateStockCSV = (data) => {
  const errors = [];
  
  data.forEach((row, index) => {
    const rowNum = index + 1;
    
    // Check required fields
    if (!row['SKU'] && !row['sku']) {
      errors.push(`Row ${rowNum}: SKU is required`);
    }
    
    if (!row['Quantity'] && !row['quantity']) {
      errors.push(`Row ${rowNum}: Quantity is required`);
    }
    
    // Validate quantity is a number
    const quantity = row['Quantity'] || row['quantity'];
    if (quantity && isNaN(parseInt(quantity))) {
      errors.push(`Row ${rowNum}: Quantity must be a number`);
    }
    
    // Validate quantity is positive
    if (quantity && parseInt(quantity) <= 0) {
      errors.push(`Row ${rowNum}: Quantity must be greater than 0`);
    }
  });
  
  return errors;
};

module.exports = {
  parseCSV,
  validateProductCSV,
  validateStockCSV
};

