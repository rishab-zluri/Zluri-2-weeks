/**
 * Database Initialization Module
 * MikroORM setup and connection management
 */
import { MikroORM } from '@mikro-orm/postgresql';
import type { EntityManager } from '@mikro-orm/postgresql';
import config from '../mikro-orm.config';

// Global ORM instance
let orm: MikroORM | null = null;

/**
 * Initialize MikroORM connection
 * @returns MikroORM instance
 */
export async function initORM(): Promise<MikroORM> {
    if (orm) {
        return orm;
    }

    orm = await MikroORM.init(config);
    console.log('MikroORM initialized successfully');
    return orm;
}

/**
 * Get the ORM instance
 * @throws Error if ORM is not initialized
 */
export function getORM(): MikroORM {
    if (!orm) {
        throw new Error('ORM not initialized. Call initORM() first.');
    }
    return orm;
}

/**
 * Get a new EntityManager instance (fork)
 * Always use forked EntityManager for request scopes
 */
export function getEntityManager(): EntityManager {
    return getORM().em.fork();
}

/**
 * Close ORM connection
 */
export async function closeORM(): Promise<void> {
    if (orm) {
        await orm.close();
        orm = null;
        console.log('MikroORM connection closed');
    }
}

/**
 * Run pending migrations
 */
export async function runMigrations(): Promise<void> {
    const migrator = getORM().getMigrator();
    const pending = await migrator.getPendingMigrations();

    if (pending.length > 0) {
        console.log(`Running ${pending.length} pending migration(s)...`);
        await migrator.up();
        console.log('Migrations completed');
    } else {
        console.log('No pending migrations');
    }
}

/**
 * Sync schema (development only)
 * Creates/updates tables based on entity definitions
 */
export async function syncSchema(): Promise<void> {
    const generator = getORM().getSchemaGenerator();
    await generator.updateSchema();
    console.log('Schema synchronized');
}

// Export for convenience
export { orm };
