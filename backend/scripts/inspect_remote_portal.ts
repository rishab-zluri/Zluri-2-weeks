
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

// Direct connection to zluri_portal_db on Neon
const REMOTE_CONN = 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require';

async function inspect() {
    console.log('Connecting to Remote zluri_portal_db...');
    const client = new Client({ connectionString: REMOTE_CONN });

    try {
        await client.connect();
        console.log('Connected.');

        // List tables
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);

        if (res.rows.length === 0) {
            console.log('❌ NO TABLES FOUND in public schema!');
        } else {
            console.log('✅ Tables found:');
            console.table(res.rows);

            // Check users count with implicit schema (should work now)
            try {
                const userCount = await client.query('SELECT COUNT(*) FROM users');
                console.log(`Users count (users): ${userCount.rows[0].count}`);
            } catch (e: any) {
                console.log('Could not count users:', e.message);
            }
        }

    } catch (e: any) {
        console.error('❌ Connection Error:', e.message);
    } finally {
        await client.end();
    }
}

inspect();
