/**
 * PostgreSQL Test Script
 * 
 * This script demonstrates how to execute queries using the sandbox `db` object.
 * The sandbox provides a pre-connected database wrapper - no need for require('pg').
 * 
 * Available globals:
 * - db.query(sql, params) - Execute PostgreSQL queries
 * - console.log/error/warn - Output capture
 * - JSON, Math, Date, Array, Object, String, Number - Built-in globals
 */

async function main() {
    console.log('=== PostgreSQL Test Script ===');
    console.log('Starting test queries...');

    // 1. Simple SELECT
    const timeResult = await db.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log('Current time and database:', JSON.stringify(timeResult.rows, null, 2));

    // 2. Check PostgreSQL version
    const versionResult = await db.query('SELECT version()');
    console.log('PostgreSQL version:', versionResult.rows[0].version);

    // 3. List all tables in public schema
    const tablesResult = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
    console.log('Tables in database:', tablesResult.rows.map(r => r.table_name));

    console.log('=== Test Complete ===');
}

main();
