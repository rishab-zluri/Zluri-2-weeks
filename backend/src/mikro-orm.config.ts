import { Options, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';

const config: Options = {
    // Driver
    driver: PostgreSqlDriver,

    // Connection settings from environment
    // Connection settings: Prefer URL if available (Production/Neon)
    clientUrl: process.env.PORTAL_DB_URL,

    // Fallback to individual params if URL not present
    host: !process.env.PORTAL_DB_URL ? (process.env.PORTAL_DB_HOST || 'localhost') : undefined,
    port: !process.env.PORTAL_DB_URL ? parseInt(process.env.PORTAL_DB_PORT || '5432', 10) : undefined,
    // Do not set user/password/dbName if clientUrl is present to avoid conflicts
    user: !process.env.PORTAL_DB_URL ? (process.env.PORTAL_DB_USER || 'postgres') : undefined,
    password: !process.env.PORTAL_DB_URL ? (process.env.PORTAL_DB_PASSWORD || '') : undefined,
    dbName: !process.env.PORTAL_DB_URL ? (process.env.PORTAL_DB_NAME || 'db_portal') : undefined,

    // SSL for Production (Supabase/Neon/Railway)
    driverOptions: {
        connection: {
            ssl: (process.env.NODE_ENV === 'production' || process.env.PORTAL_DB_SSL === 'true' || process.env.PORTAL_DB_SSL === '1' || (process.env.PORTAL_DB_URL && process.env.PORTAL_DB_URL.includes('sslmode=require')))
                ? { rejectUnauthorized: false }
                : false
        }
    },

    // Entity discovery
    entities: ['./dist/entities/**/*.js'],
    entitiesTs: ['./src/entities/**/*.ts'],

    // Metadata provider for reflection
    metadataProvider: TsMorphMetadataProvider,

    // Extensions
    extensions: [Migrator, SeedManager],

    // Migrations
    migrations: {
        path: './dist/migrations',
        pathTs: './src/migrations',
        tableName: 'mikro_orm_migrations',
        transactional: true,
        allOrNothing: true,
        glob: '!(*.d).{js,ts}',
    },

    // Seeder
    seeder: {
        path: './dist/seeders',
        pathTs: './src/seeders',
    },

    // Debug in development
    debug: process.env.NODE_ENV === 'development',

    // Allow queries across multiple schemas
    allowGlobalContext: true,

    // Pool settings
    pool: {
        min: 2,
        max: 10,
    },
};

export default config;
