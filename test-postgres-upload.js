// Test PostgreSQL Script Upload
// Upload this via the UI to test if the fix works

const { Client } = require('pg');

async function main() {
    console.log('🚀 Starting PostgreSQL connection test...');
    console.log('Connection string length:', process.env.CONNECTION_STRING?.length || 0);
    
    try {
        const client = new Client({
            connectionString: process.env.CONNECTION_STRING,
            ssl: { rejectUnauthorized: false }
        });
        
        console.log('Connecting to PostgreSQL...');
        await client.connect();
        console.log('✅ Successfully connected to PostgreSQL!');
        
        // Get database info
        const dbInfo = await client.query('SELECT current_database(), current_user, version()');
        console.log('✅ Database:', dbInfo.rows[0].current_database);
        console.log('✅ User:', dbInfo.rows[0].current_user);
        console.log('✅ Version:', dbInfo.rows[0].version.substring(0, 80) + '...');
        
        // List tables
        const tables = await client.query(`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('\n✅ Tables found:', tables.rows.length);
        
        if (tables.rows.length > 0) {
            console.log('\nTable names:');
            tables.rows.forEach((table, index) => {
                console.log(`  ${index + 1}. ${table.table_name} (${table.table_type})`);
            });
        } else {
            console.log('No tables found in public schema');
        }
        
        // Get database size
        const sizeQuery = await client.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `);
        console.log('\nDatabase size:', sizeQuery.rows[0].size);
        
        // Get current time
        const timeQuery = await client.query('SELECT NOW() as current_time');
        console.log('Server time:', timeQuery.rows[0].current_time);
        
        await client.end();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error occurred:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        throw error;
    }
}

main().catch(err => {
    console.error('\n❌ Test failed!');
    process.exit(1);
});
