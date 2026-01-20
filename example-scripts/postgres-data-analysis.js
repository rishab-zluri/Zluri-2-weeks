// PostgreSQL Data Analysis Script
// Analyzes table structure and data distribution
// Safe read-only operations for data exploration

async function main() {
    console.log('📊 PostgreSQL Data Analysis Report');
    console.log('=' .repeat(50));
    console.log('');

    try {
        // 1. Database Overview
        console.log('🗄️  DATABASE OVERVIEW');
        console.log('-'.repeat(50));
        
        const dbInfo = await db.query(`
            SELECT 
                current_database() as database_name,
                current_user as connected_user,
                pg_size_pretty(pg_database_size(current_database())) as database_size
        `);
        
        console.log('Database:', dbInfo.rows[0].database_name);
        console.log('User:', dbInfo.rows[0].connected_user);
        console.log('Size:', dbInfo.rows[0].database_size);
        console.log('');

        // 2. Table Analysis
        console.log('📋 TABLE ANALYSIS');
        console.log('-'.repeat(50));
        
        const tables = await db.query(`
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
                pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            LIMIT 10
        `);
        
        if (tables.rowCount > 0) {
            console.log(`Found ${tables.rowCount} tables:\n`);
            tables.rows.forEach((table, index) => {
                console.log(`${index + 1}. ${table.tablename}`);
                console.log(`   Total Size: ${table.total_size}`);
                console.log(`   Table Size: ${table.table_size}`);
                console.log(`   Index Size: ${table.index_size}`);
                console.log('');
            });
        } else {
            console.log('No tables found in public schema');
            console.log('');
        }

        // 3. Row Count Analysis (for first 5 tables)
        if (tables.rowCount > 0) {
            console.log('📊 ROW COUNT ANALYSIS');
            console.log('-'.repeat(50));
            
            for (let i = 0; i < Math.min(5, tables.rows.length); i++) {
                const tableName = tables.rows[i].tablename;
                try {
                    const countResult = await db.query(`
                        SELECT COUNT(*) as row_count 
                        FROM ${tableName}
                    `);
                    console.log(`${tableName}: ${countResult.rows[0].row_count} rows`);
                } catch (err) {
                    console.log(`${tableName}: Unable to count (${err.message})`);
                }
            }
            console.log('');
        }

        // 4. Index Analysis
        console.log('🔍 INDEX ANALYSIS');
        console.log('-'.repeat(50));
        
        const indexes = await db.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size
            FROM pg_indexes
            JOIN pg_class ON pg_class.relname = indexname
            WHERE schemaname = 'public'
            ORDER BY pg_relation_size(indexrelid) DESC
            LIMIT 10
        `);
        
        if (indexes.rowCount > 0) {
            console.log(`Found ${indexes.rowCount} indexes:\n`);
            indexes.rows.forEach((idx, index) => {
                console.log(`${index + 1}. ${idx.indexname} on ${idx.tablename}`);
                console.log(`   Size: ${idx.index_size}`);
            });
        } else {
            console.log('No indexes found');
        }
        console.log('');

        // 5. Connection Statistics
        console.log('🔌 CONNECTION STATISTICS');
        console.log('-'.repeat(50));
        
        const connStats = await db.query(`
            SELECT 
                state,
                COUNT(*) as connection_count
            FROM pg_stat_activity
            WHERE datname = current_database()
            GROUP BY state
            ORDER BY connection_count DESC
        `);
        
        if (connStats.rowCount > 0) {
            connStats.rows.forEach(stat => {
                console.log(`${stat.state || 'unknown'}: ${stat.connection_count} connections`);
            });
        }
        console.log('');

        // 6. Recent Activity
        console.log('⏰ RECENT ACTIVITY');
        console.log('-'.repeat(50));
        
        const activity = await db.query(`
            SELECT 
                usename,
                application_name,
                state,
                query_start,
                state_change
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND state IS NOT NULL
            ORDER BY query_start DESC
            LIMIT 5
        `);
        
        if (activity.rowCount > 0) {
            activity.rows.forEach((act, index) => {
                console.log(`${index + 1}. User: ${act.usename}`);
                console.log(`   App: ${act.application_name || 'N/A'}`);
                console.log(`   State: ${act.state}`);
                console.log(`   Started: ${act.query_start}`);
                console.log('');
            });
        } else {
            console.log('No recent activity found');
            console.log('');
        }

        // Summary
        console.log('=' .repeat(50));
        console.log('✅ Analysis completed successfully!');
        console.log('📊 Report generated at:', new Date().toISOString());

    } catch (error) {
        console.error('❌ Analysis failed:');
        console.error('Error:', error.message);
        throw error;
    }
}

main();
