/**
 * PostgreSQL Read-Only Script Example
 * 
 * This script demonstrates safe read operations on a PostgreSQL database.
 * Perfect for generating reports or analyzing data.
 * 
 * USAGE:
 * - Upload this as a script submission
 * - Select a PostgreSQL instance
 * - Select target database
 * 
 * WHAT IT DOES:
 * 1. Counts total users
 * 2. Gets user distribution by status
 * 3. Finds recent activity
 * 4. Generates summary report
 */

const { Pool } = require('pg');

async function main() {
    // Connection is automatically provided by the portal
    // You don't need to configure connection details
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });

    try {
        console.log('🔍 Starting PostgreSQL Analysis...\n');

        // 1. Count total records
        console.log('📊 Total Users:');
        const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
        console.log(`   Total: ${countResult.rows[0].total}`);
        console.log('');

        // 2. Get distribution by status
        console.log('📈 User Status Distribution:');
        const statusResult = await pool.query(`
            SELECT 
                COALESCE(status, 'unknown') as status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
            FROM users
            GROUP BY status
            ORDER BY count DESC
        `);
        
        statusResult.rows.forEach(row => {
            console.log(`   ${row.status}: ${row.count} (${row.percentage}%)`);
        });
        console.log('');

        // 3. Recent activity (last 7 days)
        console.log('🕐 Recent Activity (Last 7 Days):');
        const recentResult = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as new_users
            FROM users
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        
        if (recentResult.rows.length > 0) {
            recentResult.rows.forEach(row => {
                console.log(`   ${row.date}: ${row.new_users} new users`);
            });
        } else {
            console.log('   No recent activity');
        }
        console.log('');

        // 4. Top 5 most active users (if you have activity tracking)
        console.log('👥 Sample Users (First 5):');
        const sampleResult = await pool.query(`
            SELECT id, email, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        sampleResult.rows.forEach(row => {
            console.log(`   ${row.id}: ${row.email} (joined: ${row.created_at})`);
        });
        console.log('');

        // Summary
        console.log('✅ Analysis Complete!');
        console.log(`   Analyzed ${countResult.rows[0].total} total users`);
        console.log(`   Found ${statusResult.rows.length} different status types`);
        console.log(`   Recent activity: ${recentResult.rows.length} days with new users`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Execute
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
