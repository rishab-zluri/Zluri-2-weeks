/**
 * Seeder Runner Script
 * 
 * Executes the DatabaseSeeder to populate the database with initial data.
 * 
 * Usage: npx ts-node src/seeders/runSeeder.ts
 */
import 'dotenv/config';  // Load env vars first!
import { MikroORM } from '@mikro-orm/postgresql';
import config from '../mikro-orm.config';
import { DatabaseSeeder } from './DatabaseSeeder';

async function run() {
    console.log('🚀 Initializing MikroORM...');
    const orm = await MikroORM.init(config);

    try {
        const seeder = orm.getSeeder();

        // Sync schema first (ensure tables exist)
        console.log('📦 Syncing database schema...');
        const generator = orm.getSchemaGenerator();
        await generator.updateSchema();

        // Run seeder
        console.log('🌱 Running DatabaseSeeder...');
        await seeder.seed(DatabaseSeeder);

        console.log('✅ Seeding complete!');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await orm.close();
    }
}

run();
