// Test PostgreSQL script for prod-target-aws instance
// This should work with the analytics_db database

const { Client } = require('pg');

async function main() {
    console.log('Starting PostgreSQL test...');
    
    // Get connection details from environment
    const client = new Client({
        connectionString: process.env.CONNECTION_STRING,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');
        
        // Test query
        const result = await client.query('SELECT current_database(), version()');
        console.log('Database:', result.rows[0].current_database);
        console.log('Version:', result.rows[0].version.substring(0, 50) + '...');
        
        // List tables
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('\nTables in database:');
        tables.rows.forEach(row => {
            console.log('  -', row.table_name);
        });
        
        console.log('\n✅ PostgreSQL test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

main();
