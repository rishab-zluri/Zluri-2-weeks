// PostgreSQL Connection Test Script
// This script tests the PostgreSQL connection and displays database information
// Upload this via the UI to test PostgreSQL script execution

async function main() {
    console.log('🚀 Starting PostgreSQL connection test...');
    console.log('Testing database connection and querying information...\n');

    try {
        // Test 1: Get database information
        console.log('📊 Test 1: Database Information');
        const dbInfo = await db.query('SELECT current_database(), current_user, version()');
        console.log('✅ Database:', dbInfo.rows[0].current_database);
        console.log('✅ User:', dbInfo.rows[0].current_user);
        console.log('✅ Version:', dbInfo.rows[0].version.substring(0, 80) + '...\n');

        // Test 2: List all tables
        console.log('📋 Test 2: Tables in Public Schema');
        const tables = await db.query(`
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        console.log(`✅ Found ${tables.rowCount} tables:`);
        if (tables.rows.length > 0) {
            tables.rows.forEach((table, index) => {
                console.log(`   ${index + 1}. ${table.table_name} (${table.table_type})`);
            });
        } else {
            console.log('   No tables found in public schema');
        }
        console.log('');

        // Test 3: Database size
        console.log('💾 Test 3: Database Size');
        const sizeQuery = await db.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `);
        console.log('✅ Database size:', sizeQuery.rows[0].size);
        console.log('');

        // Test 4: Active connections
        console.log('🔌 Test 4: Active Connections');
        const connections = await db.query(`
            SELECT count(*) as connection_count
            FROM pg_stat_activity
            WHERE datname = current_database()
        `);
        console.log('✅ Active connections:', connections.rows[0].connection_count);
        console.log('');

        // Test 5: Server time
        console.log('⏰ Test 5: Server Time');
        const timeQuery = await db.query('SELECT NOW() as current_time, current_timestamp as timestamp');
        console.log('✅ Server time:', timeQuery.rows[0].current_time);
        console.log('');

        console.log('✅ All tests completed successfully!');
        console.log('🎉 PostgreSQL connection is working properly!');

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

// Execute main function
main();
