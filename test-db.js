// Simple database test script
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'knightfall_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'knightfall',
  password: process.env.DB_PASSWORD || 'knightfall_password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function testDatabase() {
  console.log('🧪 Testing Knightfall Database Connection...\n');
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database query successful:', result.rows[0]);
    
    // Test if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Database tables:');
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  No tables found (database may be empty)');
    }
    
    // Test sample data
    const usersResult = await client.query('SELECT COUNT(*) as user_count FROM users');
    console.log(`\n👥 Users in database: ${usersResult.rows[0].user_count}`);
    
    const teamsResult = await client.query('SELECT COUNT(*) as team_count FROM teams');
    console.log(`🏰 Teams in database: ${teamsResult.rows[0].team_count}`);
    
    const tournamentsResult = await client.query('SELECT COUNT(*) as tournament_count FROM tournaments');
    console.log(`🏆 Tournaments in database: ${tournamentsResult.rows[0].tournament_count}`);
    
    client.release();
    console.log('\n🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure Docker is installed and running');
    console.log('2. Start the database: docker compose up -d');
    console.log('3. Check if PostgreSQL is running on port 5432');
    console.log('4. Verify environment variables in .env file');
  } finally {
    await pool.end();
  }
}

testDatabase(); 