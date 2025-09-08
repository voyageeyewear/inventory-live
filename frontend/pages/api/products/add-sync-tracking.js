import { query } from '../../../lib/postgres'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Adding sync tracking columns to products table...')

    // Check if columns already exist
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('last_modified', 'last_synced', 'needs_sync')
    `)

    const existingColumns = columnCheck.rows.map(row => row.column_name)
    
    // Add last_modified column if it doesn't exist
    if (!existingColumns.includes('last_modified')) {
      await query(`
        ALTER TABLE products 
        ADD COLUMN last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `)
      console.log('Added last_modified column')
    }

    // Add last_synced column if it doesn't exist
    if (!existingColumns.includes('last_synced')) {
      await query(`
        ALTER TABLE products 
        ADD COLUMN last_synced TIMESTAMP
      `)
      console.log('Added last_synced column')
    }

    // Add needs_sync column if it doesn't exist
    if (!existingColumns.includes('needs_sync')) {
      await query(`
        ALTER TABLE products 
        ADD COLUMN needs_sync BOOLEAN DEFAULT true
      `)
      console.log('Added needs_sync column')
    }

    // Create trigger to automatically update last_modified when product is updated
    await query(`
      CREATE OR REPLACE FUNCTION update_last_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_modified = CURRENT_TIMESTAMP;
        NEW.needs_sync = true;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `)

    // Drop existing trigger if it exists
    await query(`
      DROP TRIGGER IF EXISTS update_products_last_modified ON products;
    `)

    // Create trigger
    await query(`
      CREATE TRIGGER update_products_last_modified
        BEFORE UPDATE ON products
        FOR EACH ROW
        EXECUTE FUNCTION update_last_modified_column();
    `)

    // Initialize existing products
    await query(`
      UPDATE products 
      SET last_modified = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
          needs_sync = true
      WHERE last_modified IS NULL
    `)

    console.log('Sync tracking setup completed successfully')

    res.status(200).json({ 
      success: true,
      message: 'Sync tracking columns and triggers added successfully'
    })
  } catch (error) {
    console.error('Sync tracking setup error:', error)
    res.status(500).json({ 
      success: false,
      message: 'Failed to add sync tracking: ' + error.message 
    })
  }
}
