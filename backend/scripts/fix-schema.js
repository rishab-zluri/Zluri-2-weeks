#!/usr/bin/env node

/**
 * Fix Schema Issues
 * Adds missing columns and constraints to database_blacklist table
 */

const { Pool } = require('pg');

async function fixSchema() {
    console.log('🔧 Fixing database schema...\n');

    // Use Railway's DATABASE_URL or local config
    const connectionString = process.env.DATABASE_URL || process.env.PORTAL_DB_URL;
    
    if (!connectionString) {
        console.error('❌ No DATABASE_URL or PORTAL_DB_URL found');
        console.error('   Set DATABASE_URL environment variable or run with Railway CLI');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' || process.env.PORTAL_DB_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false
    });

    try {
        // 1. Add created_by column if missing
        console.log('1️⃣  Checking created_by column...');
        const checkColumn = await pool.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'database_blacklist' 
            AND column_name = 'created_by'
        `);

        if (checkColumn.rows.length === 0) {
            await pool.query(`
                ALTER TABLE database_blacklist 
                ADD COLUMN created_by UUID REFERENCES users(id)
            `);
            console.log('   ✅ Added created_by column');
        } else {
            console.log('   ✅ created_by column already exists');
        }

        // 2. Add unique constraint if missing
        console.log('\n2️⃣  Checking unique constraint...');
        const checkConstraint = await pool.query(`
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'database_blacklist_pattern_key'
        `);

        if (checkConstraint.rows.length === 0) {
            // First, remove any duplicates
            await pool.query(`
                DELETE FROM database_blacklist a
                USING database_blacklist b
                WHERE a.id > b.id
                AND a.pattern = b.pattern
            `);
            
            await pool.query(`
                ALTER TABLE database_blacklist 
                ADD CONSTRAINT database_blacklist_pattern_key UNIQUE (pattern)
            `);
            console.log('   ✅ Added unique constraint on pattern');
        } else {
            console.log('   ✅ Unique constraint already exists');
        }

        // 3. Verify the fixes
        console.log('\n3️⃣  Verifying schema...');
        const columns = await pool.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'database_blacklist'
            ORDER BY ordinal_position
        `);

        console.log('\n   Database Blacklist Columns:');
        columns.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });

        console.log('\n✅ Schema fix complete!');
        console.log('\n📝 Next steps:');
        console.log('   1. Restart your Railway service (or wait for auto-restart)');
        console.log('   2. Check logs - the "created_by" error should be gone');
        console.log('   3. Try logging in to your app');

    } catch (error) {
        console.error('\n❌ Error fixing schema:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the fix
fixSchema().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
