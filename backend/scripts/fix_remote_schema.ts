
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

// Direct connection to zluri_portal_db on Neon (Unpooled or Pooled - ALTER works on DB session)
// Using standard connection string
const REMOTE_CONN = 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require';

async function fixSchema() {
    console.log('Connecting to Remote DB to fix search_path...');
    const client = new Client({ connectionString: REMOTE_CONN });

    try {
        await client.connect();

        // Fix: Set search_path for this user on this database permanently
        console.log('Executing: ALTER ROLE "neondb_owner" SET search_path = public;');
        await client.query('ALTER ROLE "neondb_owner" SET search_path = public');

        // Also simpler: ALTER DATABASE "zluri_portal_db" SET search_path = public;
        console.log('Executing: ALTER DATABASE "zluri_portal_db" SET search_path = public;');
        await client.query('ALTER DATABASE "zluri_portal_db" SET search_path = public');

        console.log('✅ Fix Applied. Testing visibility...');

        // Test visibility
        const res = await client.query('SELECT COUNT(*) FROM users');
        console.log(`Verifying 'SELECT COUNT(*) FROM users': ${res.rows[0].count}`);

    } catch (e: any) {
        console.error('❌ Error applying fix:', e.message);
    } finally {
        await client.end();
    }
}

fixSchema();
