import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig: PoolConfig = {
  user: process.env.DB_USER || 'knightfall_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'knightfall',
  password: process.env.DB_PASSWORD || 'knightfall_password',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create the connection pool
const pool = new Pool(dbConfig);

// Test the database connection
pool.on('connect', () => {
  console.log('🗄️  Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Function to test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

// Function to initialize database tables
export const initializeDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'games', 'tournaments', 'teams')
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('🗄️  Initializing database tables...');
      // Tables don't exist, they will be created by the init.sql script
      console.log('✅ Database tables will be created by Docker init script');
    } else {
      console.log('✅ Database tables already exist');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

export default pool; 