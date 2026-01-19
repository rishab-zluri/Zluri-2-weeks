/**
 * PostgreSQL Data Cleanup Script
 * 
 * This script demonstrates safe data cleanup operations.
 * Use with caution - this modifies data!
 * 
 * USAGE:
 * - Upload this as a script submission
 * - Select a PostgreSQL instance
 * - Select target database
 * - Get manager approval before execution
 * 
 * WHAT IT DOES:
 * 1. Identifies old/stale records
 * 2. Archives them to a backup table
 * 3. Deletes from main table
 * 4. Provides detailed report
 * 
 * SAFETY:
 * - Uses transactions (rollback on error)
 * - Creates backup before deletion
 * - Dry-run mode available
 */

const { Pool } = require('pg');

// Configuration
const DRY_RUN = false; // Set to true to preview without making changes
const DAYS_OLD = 90; // Delete records older than this

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });

    const client = await pool.connect();

    try {
        console.log('🧹 Starting Data Cleanup...');
        console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify data)'}`);
        console.log(`   Threshold: ${DAYS_OLD} days\n`);

        // Start transaction
        await client.query('BEGIN');

        // 1. Find old records
        console.log('🔍 Step 1: Identifying old records...');
        const findOldResult = await client.query(`
            SELECT COUNT(*) as count
            FROM temp_data
            WHERE created_at < NOW() - INTERVAL '${DAYS_OLD} days'
        `);
        
        const oldCount = parseInt(findOldResult.rows[0].count);
        console.log(`   Found ${oldCount} records older than ${DAYS_OLD} days\n`);

        if (oldCount === 0) {
            console.log('✅ No old records to clean up!');
            await client.query('ROLLBACK');
            return;
        }

        // 2. Create archive table if it doesn't exist
        console.log('📦 Step 2: Preparing archive table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS temp_data_archive (
                LIKE temp_data INCLUDING ALL
            )
        `);
        console.log('   Archive table ready\n');

        // 3. Copy to archive
        console.log('💾 Step 3: Archiving old records...');
        const archiveResult = await client.query(`
            INSERT INTO temp_data_archive
            SELECT * FROM temp_data
            WHERE created_at < NOW() - INTERVAL '${DAYS_OLD} days'
            ON CONFLICT DO NOTHING
        `);
        console.log(`   Archived ${archiveResult.rowCount} records\n`);

        // 4. Delete from main table
        console.log('🗑️  Step 4: Deleting old records...');
        const deleteResult = await client.query(`
            DELETE FROM temp_data
            WHERE created_at < NOW() - INTERVAL '${DAYS_OLD} days'
        `);
        console.log(`   Deleted ${deleteResult.rowCount} records\n`);

        // 5. Get final counts
        const finalResult = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM temp_data) as remaining,
                (SELECT COUNT(*) FROM temp_data_archive) as archived
        `);
        
        const { remaining, archived } = finalResult.rows[0];

        // Summary
        console.log('📊 Summary:');
        console.log(`   Records archived: ${archiveResult.rowCount}`);
        console.log(`   Records deleted: ${deleteResult.rowCount}`);
        console.log(`   Remaining in main table: ${remaining}`);
        console.log(`   Total in archive: ${archived}\n`);

        if (DRY_RUN) {
            console.log('🔄 DRY RUN - Rolling back changes...');
            await client.query('ROLLBACK');
            console.log('✅ Preview complete - no changes made');
        } else {
            await client.query('COMMIT');
            console.log('✅ Cleanup complete - changes committed');
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error - rolled back all changes:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Execute
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
