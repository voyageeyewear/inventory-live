# CSV Format Guide for Shopify Inventory Management

## Supported CSV Formats

Your system now supports **multiple CSV column formats** to make it easy to upload from different sources.

### Format 1: Standard Format
```csv
Product Name,SKU,Quantity,Image
Classic T-Shirt Red,TSH001,100,https://example.com/image.jpg
```

### Format 2: Shopify Export Format (Your Current Format)
```csv
Title,Type,Variant SKU,Variant Inventory Qty,Image Src
Classic T-Shirt Red,Apparel,TSH001,100,https://example.com/image.jpg
```

### Format 3: Alternative Naming
```csv
product_name,sku,quantity,image_url
Classic T-Shirt Red,TSH001,100,https://example.com/image.jpg
```

## Column Mapping

The system automatically detects and maps these column names:

| Required Data | Accepted Column Names |
|---------------|----------------------|
| **Product Name** | `Product Name`, `product_name`, `Title`, `title` |
| **SKU** | `SKU`, `sku`, `Variant SKU`, `variant_sku` |
| **Quantity** | `Quantity`, `quantity`, `Variant Inventory Qty`, `variant_inventory_qty` |
| **Image URL** | `Image`, `image`, `image_url`, `Image Src`, `image_src` |

## Stock-In/Stock-Out CSV Format

For inventory adjustments, use this simpler format:

```csv
SKU,Quantity
TSH001,20
TSH002,15
```

Alternative column names also supported:
- SKU: `SKU`, `sku`, `Variant SKU`, `variant_sku`
- Quantity: `Quantity`, `quantity`

## Sample Files

Check the `sample-data/` folder for example files:
- `products-template.csv` - Standard format
- `products-shopify-format.csv` - Shopify export format
- `stock-in-sample.csv` - Stock adjustment format

## Important Notes

1. **Required Fields**: Product Name/Title, SKU, and Quantity are mandatory
2. **Image URL**: Optional but recommended for better product display
3. **Quantity**: Must be a valid number (0 or positive integer)
4. **SKU**: Must be unique across all products
5. **File Size**: Maximum 5MB per CSV file
6. **Encoding**: Use UTF-8 encoding for special characters

## Your Current CSV

Your uploaded CSV with 6,687 products uses the Shopify export format:
- `Title` → Product Name
- `Variant SKU` → SKU  
- `Variant Inventory Qty` → Quantity
- `Image Src` → Image URL
- `Type` → Ignored (not needed for inventory management)

This format is now fully supported! You can upload your CSV directly without any modifications.
