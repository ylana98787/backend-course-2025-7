const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'course_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

console.log('🔧 Database Configuration:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Database: ${config.database}`);
console.log(`   User: ${config.user}`);

// Create connection pool
const pool = new Pool(config);

// Connection events
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err.message);
});

/**
 * Check database connection
 * @returns {Promise<boolean>} Connection status
 */
async function checkDbConnection() {
  try {
    console.log('🔄 Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');
    console.log(`   Server time: ${result.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
}

/**
 * Initialize database with required tables
 * @returns {Promise<boolean>} Initialization status
 */
async function initDatabase() {
  try {
    // Check if products table exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      )
    `);
    
    const tableExists = checkResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('📝 Creating products table...');
      
      await pool.query(`
        CREATE TABLE products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          stock_quantity INTEGER DEFAULT 0,
          photo_filename VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await pool.query('CREATE INDEX idx_products_name ON products(name)');
      
      console.log('✅ Products table created successfully');
      
      // Insert sample data
      await pool.query(`
        INSERT INTO products (name, description, price, stock_quantity) VALUES
          ('Модуль Node.js', 'Високопродуктивний мережевий модуль', 120.50, 50),
          ('Ліцензія Express Pro', 'Ліцензія для комерційного використання Express.js', 999.00, 10)
      `);
      
      console.log('✅ Sample data inserted');
    } else {
      console.log('📊 Products table already exists');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    return false;
  }
}

/**
 * Get database information
 * @returns {Promise<Object>} Database info
 */
async function getDatabaseInfo() {
  try {
    const client = await pool.connect();
    
    const versionResult = await client.query('SELECT version()');
    const dbNameResult = await client.query('SELECT current_database()');
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    client.release();
    
    return {
      version: versionResult.rows[0].version.split(',')[0],
      database: dbNameResult.rows[0].current_database,
      tables: tableResult.rows.map(row => row.table_name),
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return { 
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  checkDbConnection,
  initDatabase,
  getDatabaseInfo
};