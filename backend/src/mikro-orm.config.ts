import { Options, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';

const config: Options = {
    // Driver
    driver: PostgreSqlDriver,

    // Connection settings from environment
    host: process.env.PORTAL_DB_HOST || 'localhost',
    port: parseInt(process.env.PORTAL_DB_PORT || '5432', 10),
    user: process.env.PORTAL_DB_USER || 'postgres',
    password: process.env.PORTAL_DB_PASSWORD || '',
    dbName: process.env.PORTAL_DB_NAME || 'db_portal',

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
