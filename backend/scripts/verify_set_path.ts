
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

// Standard Connection String
const REMOTE_CONN = 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require';

async function verify() {
    console.log('Connecting...');
    const client = new Client({ connectionString: REMOTE_CONN });

    try {
        await client.connect();

        console.log('Checking current search_path...');
        const res1 = await client.query('SHOW search_path');
        console.log('Current search_path:', res1.rows[0].search_path);

        console.log('Executing: SET search_path TO public');
        await client.query('SET search_path TO public');

        console.log('Checking users count (users)...');
        const res2 = await client.query('SELECT COUNT(*) FROM users');
        console.log('Users count:', res2.rows[0].count);

    } catch (e: any) {
        console.error('❌ Error:', e.message);
    } finally {
        await client.end();
    }
}

verify();
