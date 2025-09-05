import { Pool } from 'pg'

// Use your Neon PostgreSQL connection
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Database connection string not found. Please set POSTGRES_URL or DATABASE_URL environment variable.')
}

// Create a connection pool
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err)
})

export default pool

export async function query(text, params) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

export async function getClient() {
  return pool.connect()
}

// Initialize database tables
export async function initializeDatabase() {
  try {
    console.log('Initializing database tables...')
    
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        permissions TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create products table
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(255) UNIQUE NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        price DECIMAL(10,2) DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        description TEXT,
        image_url VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create stores table
    await query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        store_name VARCHAR(255),
        store_domain VARCHAR(255),
        access_token VARCHAR(500),
        connected BOOLEAN DEFAULT false,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        manager_id INTEGER REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Add missing columns if they don't exist (for existing databases)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'store_name') THEN
          ALTER TABLE stores ADD COLUMN store_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'store_domain') THEN
          ALTER TABLE stores ADD COLUMN store_domain VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'access_token') THEN
          ALTER TABLE stores ADD COLUMN access_token VARCHAR(500);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'connected') THEN
          ALTER TABLE stores ADD COLUMN connected BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'manager_id') THEN
          ALTER TABLE stores ADD COLUMN manager_id INTEGER REFERENCES users(id);
        END IF;
      END $$;
    `)

    // Create stock_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS stock_logs (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        product_name VARCHAR(255),
        sku VARCHAR(255),
        type VARCHAR(50) NOT NULL, -- 'stock_in' or 'stock_out'
        quantity INTEGER NOT NULL,
        previous_quantity INTEGER,
        new_quantity INTEGER,
        notes TEXT,
        store_id INTEGER REFERENCES stores(id),
        user_id INTEGER REFERENCES users(id),
        user_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create scan_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS scan_logs (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(255) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2) DEFAULT 0,
        category VARCHAR(255),
        last_scanned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scan_count INTEGER DEFAULT 1,
        user_id INTEGER REFERENCES users(id),
        session_id VARCHAR(255) DEFAULT 'mobile-session',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create mobile_transactions table for approval workflow
    await query(`
      CREATE TABLE IF NOT EXISTS mobile_transactions (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id),
        sku VARCHAR(255) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL, -- 'stock_in' or 'stock_out'
        quantity INTEGER NOT NULL,
        notes TEXT,
        current_stock INTEGER, -- Stock at time of request
        status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        requested_by_user_id INTEGER REFERENCES users(id),
        requested_by_username VARCHAR(255),
        approved_by_user_id INTEGER REFERENCES users(id),
        approved_by_username VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP
      )
    `)

    // Create indexes for better performance
    await query(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON stock_logs(product_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_stock_logs_user_id ON stock_logs(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_scan_logs_user_id ON scan_logs(user_id)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_scan_logs_sku ON scan_logs(sku)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_mobile_transactions_status ON mobile_transactions(status)`)
    await query(`CREATE INDEX IF NOT EXISTS idx_mobile_transactions_sku ON mobile_transactions(sku)`)

    console.log('Database tables initialized successfully')
    
    // Create default admin user if not exists
    const adminCheck = await query('SELECT id FROM users WHERE username = $1', ['admin'])
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      await query(`
        INSERT INTO users (username, email, password, role, permissions, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'admin',
        'admin@inventory.com',
        hashedPassword,
        'admin',
        ['viewProducts', 'addProducts', 'editProducts', 'deleteProducts', 'manageUsers', 'viewReports', 'manageStores', 'viewSyncActivity'],
        true
      ])
      console.log('Default admin user created')
    }

    return true
  } catch (error) {
    console.error('Database initialization error:', error)
    throw error
  }
}
