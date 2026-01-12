/**
 * Migration Script: Fix Failed Status
 * 
 * This script updates all requests that are marked as "completed" but have
 * success: false in their executionResult to be marked as "failed" instead.
 * 
 * Run with: node scripts/fix-failed-status.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixFailedStatus() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration to fix failed status...\n');
    
    // Find all completed requests
    const { rows: completedRequests } = await client.query(`
      SELECT id, uuid, execution_result, status
      FROM query_requests
      WHERE status = 'completed'
      AND execution_result IS NOT NULL
    `);
    
    console.log(`Found ${completedRequests.length} completed requests to check.\n`);
    
    let fixedCount = 0;
    
    for (const request of completedRequests) {
      try {
        // Parse the execution result
        const result = JSON.parse(request.execution_result);
        
        // Check if success is false
        if (result.success === false) {
          const errorMessage = result.error?.message || 'Execution failed';
          
          // Update to failed status
          await client.query(`
            UPDATE query_requests
            SET status = 'failed',
                execution_error = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [errorMessage, request.id]);
          
          console.log(`✓ Fixed request #${request.id} (${request.uuid})`);
          console.log(`  Error: ${errorMessage}\n`);
          fixedCount++;
        }
      } catch (parseError) {
        console.log(`⚠ Could not parse execution_result for request #${request.id}`);
      }
    }
    
    console.log('-----------------------------------');
    console.log(`Migration complete!`);
    console.log(`Fixed ${fixedCount} requests from 'completed' to 'failed'`);
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixFailedStatus();
