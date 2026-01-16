import { EntityManager, ref } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { User, UserRole } from '../entities/User';
import { Pod } from '../entities/Pod';
import { DatabaseInstance } from '../entities/DatabaseInstance';
import { Database } from '../entities/Database';
import { DatabaseBlacklist, PatternType } from '../entities/DatabaseBlacklist';
import { DatabaseType } from '../entities/QueryRequest';
import bcrypt from 'bcrypt';

/**
 * DatabaseSeeder - Populates database with initial data
 * 
 * Creates default users, PODs, database instances, and blacklist patterns.
 * 
 * Run with: npx ts-node src/seeders/runSeeder.ts
 */
export class DatabaseSeeder extends Seeder {

    /**
     * Pre-computed bcrypt hash for Test@123
     */
    private static readonly DEFAULT_PASSWORD_HASH = '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i';

    async run(em: EntityManager): Promise<void> {
        console.log('🌱 Starting database seeding...');

        // Create in order of dependencies
        await this.createPods(em);
        await this.createUsers(em);
        await this.createDatabaseInstances(em);
        await this.createDatabaseBlacklist(em);

        console.log('✅ Database seeding completed!');
    }

    private async createPods(em: EntityManager): Promise<void> {
        const pods = [
            { id: 'pod-1', name: 'Pod 1', managerEmail: 'manager1@zluri.com', description: 'Product Development Pod 1' },
            { id: 'pod-2', name: 'Pod 2', managerEmail: 'manager2@zluri.com', description: 'Product Development Pod 2' },
            { id: 'de', name: 'DE', managerEmail: 'de-lead@zluri.com', description: 'Data Engineering Team' },
            { id: 'sre', name: 'SRE', managerEmail: 'sre-lead@zluri.com', description: 'Site Reliability Engineering' },
        ];

        for (const podData of pods) {
            const existing = await em.findOne(Pod, { id: podData.id });
            if (!existing) {
                const pod = new Pod();
                pod.id = podData.id;
                pod.name = podData.name;
                pod.managerEmail = podData.managerEmail;
                pod.description = podData.description;
                em.persist(pod);
                console.log(`  ✓ Created POD: ${podData.name}`);
            } else {
                console.log(`  - POD already exists: ${podData.name}`);
            }
        }
        await em.flush();
    }

    private async createUsers(em: EntityManager): Promise<void> {
        const rishabPasswordHash = await bcrypt.hash('123@Acharjee', 10);

        const users = [
            { email: 'admin@zluri.com', passwordHash: DatabaseSeeder.DEFAULT_PASSWORD_HASH, name: 'Admin User', role: UserRole.ADMIN, podId: undefined },
            { email: 'rishab.a@zluri.com', passwordHash: rishabPasswordHash, name: 'Rishab Acharjee', role: UserRole.ADMIN, podId: undefined },
            { email: 'manager1@zluri.com', passwordHash: DatabaseSeeder.DEFAULT_PASSWORD_HASH, name: 'Pod 1 Manager', role: UserRole.MANAGER, podId: 'pod-1' },
            { email: 'manager2@zluri.com', passwordHash: DatabaseSeeder.DEFAULT_PASSWORD_HASH, name: 'DE Manager', role: UserRole.MANAGER, podId: 'de' },
            { email: 'developer1@zluri.com', passwordHash: DatabaseSeeder.DEFAULT_PASSWORD_HASH, name: 'Developer One', role: UserRole.DEVELOPER, podId: 'pod-1' },
            { email: 'developer2@zluri.com', passwordHash: DatabaseSeeder.DEFAULT_PASSWORD_HASH, name: 'Developer Two', role: UserRole.DEVELOPER, podId: 'de' },
        ];

        for (const userData of users) {
            const existing = await em.findOne(User, { email: userData.email });
            if (!existing) {
                const user = new User();
                user.email = userData.email;
                user.passwordHash = userData.passwordHash;
                user.name = userData.name;
                user.role = userData.role;
                user.podId = userData.podId;
                user.isActive = true;
                em.persist(user);
                console.log(`  ✓ Created user: ${userData.email} (${userData.role})`);
            } else {
                console.log(`  - User already exists: ${userData.email}`);
            }
        }
        await em.flush();
    }

    private async createDatabaseInstances(em: EntityManager): Promise<void> {
        const instances = [
            {
                id: 'database-1',
                name: 'Database-1',
                type: DatabaseType.POSTGRESQL,
                host: 'localhost',
                port: 5432,
                credentialsEnvPrefix: 'PG_INSTANCE_1',
                description: 'Primary PostgreSQL Instance'
            },
            {
                id: 'mongo-zluri-1',
                name: 'mongo-zluri-1',
                type: DatabaseType.MONGODB,
                host: 'localhost',
                port: 27017,
                credentialsEnvPrefix: 'MONGO_INSTANCE_1',
                description: 'Primary MongoDB Instance'
            },
        ];

        for (const instData of instances) {
            const existing = await em.findOne(DatabaseInstance, { id: instData.id });
            if (!existing) {
                const instance = new DatabaseInstance();
                instance.id = instData.id;
                instance.name = instData.name;
                instance.type = instData.type;
                instance.host = instData.host;
                instance.port = instData.port;
                instance.credentialsEnvPrefix = instData.credentialsEnvPrefix;
                instance.description = instData.description;
                instance.isActive = true;
                em.persist(instance);
                console.log(`  ✓ Created instance: ${instData.name} (${instData.type})`);

                // Create databases for this instance
                await em.flush(); // Flush to persist instance before creating databases
                await this.createDatabasesForInstance(em, instance);
            } else {
                console.log(`  - Instance already exists: ${instData.name}`);
            }
        }
        await em.flush();
    }

    private async createDatabasesForInstance(em: EntityManager, instance: DatabaseInstance): Promise<void> {
        // Databases based on .env LOCAL_PG_DATABASES and LOCAL_MONGO_DATABASES
        const databasesMap: Record<string, string[]> = {
            'database-1': ['db_query_portal', 'postgres'],
            'mongo-zluri-1': ['test', 'local'],
        };

        const databases = databasesMap[instance.id] || [];
        for (const dbName of databases) {
            const existing = await em.findOne(Database, { instance: { id: instance.id }, name: dbName });
            if (!existing) {
                const db = new Database();
                db.instance = ref(em.getReference(DatabaseInstance, instance.id));
                db.name = dbName;
                db.source = 'seeded';
                db.isActive = true;
                db.lastSeenAt = new Date();
                em.persist(db);
                console.log(`    ✓ Created database: ${dbName}`);
            }
        }
        await em.flush();
    }

    private async createDatabaseBlacklist(em: EntityManager): Promise<void> {
        const blacklist = [
            { pattern: 'template0', patternType: PatternType.EXACT, reason: 'PostgreSQL template database - read only' },
            { pattern: 'template1', patternType: PatternType.EXACT, reason: 'PostgreSQL template database' },
            { pattern: 'postgres', patternType: PatternType.EXACT, reason: 'PostgreSQL system database' },
            { pattern: 'rdsadmin', patternType: PatternType.EXACT, reason: 'AWS RDS admin database' },
            { pattern: 'admin', patternType: PatternType.EXACT, reason: 'MongoDB admin database' },
            { pattern: 'local', patternType: PatternType.EXACT, reason: 'MongoDB local database' },
            { pattern: 'config', patternType: PatternType.EXACT, reason: 'MongoDB config database' },
        ];

        for (const item of blacklist) {
            const existing = await em.findOne(DatabaseBlacklist, { pattern: item.pattern });
            if (!existing) {
                const bl = new DatabaseBlacklist();
                bl.pattern = item.pattern;
                bl.patternType = item.patternType;
                bl.reason = item.reason;
                em.persist(bl);
                console.log(`  ✓ Created blacklist: ${item.pattern}`);
            } else {
                console.log(`  - Blacklist already exists: ${item.pattern}`);
            }
        }
        await em.flush();
    }
}
