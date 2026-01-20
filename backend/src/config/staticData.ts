/**
 * POD and Database Instance Configuration
 * Static configuration for PODs and database instances
 */

// ============================================================================
// Types
// ============================================================================

/**
 * POD (team/department) definition
 */
export interface Pod {
    readonly id: string;
    readonly name: string;
    readonly manager_email: string;
}

/**
 * Database types supported
 */
export type DatabaseInstanceType = 'postgresql' | 'mongodb';

/**
 * Base database instance (common fields)
 */
interface BaseInstance {
    readonly id: string;
    readonly name: string;
    readonly type: DatabaseInstanceType;
    readonly databases: readonly string[];
    readonly connection_string_env?: string;
}

/**
 * PostgreSQL instance with connection details
 */
export interface PostgresInstance extends BaseInstance {
    readonly type: 'postgresql';
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
}

/**
 * MongoDB instance with connection URI
 */
export interface MongoInstance extends BaseInstance {
    readonly type: 'mongodb';
    readonly uri: string;
}

/**
 * Union type for all database instances
 */
export type DatabaseInstance = PostgresInstance | MongoInstance;

/**
 * Public instance info (no sensitive connection details)
 */
export interface PublicInstanceInfo {
    id: string;
    name: string;
    type: DatabaseInstanceType;
}

// ============================================================================
// Static Data
// ============================================================================

/**
 * POD definitions
 */
const pods: readonly Pod[] = [
    { id: 'pod-1', name: 'Pod 1', manager_email: 'manager1@zluri.com' },
    { id: 'pod-2', name: 'Pod 2', manager_email: 'manager2@zluri.com' },
    { id: 'pod-3', name: 'Pod 3', manager_email: 'manager3@zluri.com' },
    { id: 'pod-4', name: 'Pod 4', manager_email: 'manager4@zluri.com' },
    { id: 'pod-5', name: 'Pod 5', manager_email: 'manager5@zluri.com' },
    { id: 'pod-6', name: 'Pod 6', manager_email: 'manager6@zluri.com' },
    { id: 'sre', name: 'SRE', manager_email: 'sre-lead@zluri.com' },
    { id: 'de', name: 'DE', manager_email: 'de-lead@zluri.com' },
] as const;

/**
 * Get database instances array - built at RUNTIME to ensure env vars are loaded
 * FIX: Changed from const to function to avoid timing issues with dotenv
 */
function getDatabaseInstancesArray(): DatabaseInstance[] {
    const instances: DatabaseInstance[] = [];

    // Development Instances (only include in dev or if explicitly configured)
    if (process.env.NODE_ENV !== 'production' || process.env.INCLUDE_DEV_INSTANCES === 'true') {
        instances.push({
            id: 'database-1',
            name: 'Database-1',
            type: 'postgresql',
            host: process.env.PG_INSTANCE_1_HOST || 'localhost',
            port: parseInt(process.env.PG_INSTANCE_1_PORT || '', 10) || 5432,
            user: process.env.PG_INSTANCE_1_USER || process.env.DB_DEFAULT_USER || 'postgres',
            password: process.env.PG_INSTANCE_1_PASSWORD || process.env.DB_DEFAULT_PASSWORD || '',
            databases: [
                'dev_sre_internal_portal', 'dev_pft_db', 'dev_prefect_gcp_db', 'dev_n8n_db_rds',
                'backend_triggers', 'dev_n8n_db', 'n8n', 'dev_prefect_db', 'postgres',
                'dev_n8n_trigger_db', 'agents_db', 'dev_mongodb_monitoring', 'dev_cs_n8n_db',
                'arush_db', 'test_backup', 'dev_retool_db', 'postgres_exporter', 'dev_n8n_database',
                'dbsonarqube', 'dev_de_schema', 'stag_n8n_triggers_db', 'dev_n8n_test_db_rds', 'stag_n8n_db',
            ],
        } as PostgresInstance);

        instances.push({
            id: 'mongo-zluri-1',
            name: 'mongo-zluri-1',
            type: 'mongodb',
            uri: process.env.MONGO_INSTANCE_1_URI || 'mongodb://localhost:27017',
            connection_string_env: 'MONGO_INSTANCE_1_URI', // Explicitly set for seeding
            databases: [
                '69401559e576ef4085e50133_test', '69401559e576ef4085e50133_truth',
                '694047d693600ea800754f3c_test', '694047d693600ea800754f3c_truth',
                '69412bf1f70d11f5688c5151_test', '69412bf1f70d11f5688c5151_truth',
                '69424cc632becd3ed2d68aeb_test', '69424cc632becd3ed2d68aeb_truth',
                '6942600ed521dfa444f4ea04_test', '6942600ed521dfa444f4ea04_truth',
                '6942609ec8128b37a0c68863_test', '6942609ec8128b37a0c68863_truth',
                '6942775cfae8702167efe369_test',
            ],
        } as MongoInstance);
    }

    // Add Production Instances if env vars are present (example pattern)
    // Supports explicit connection string via PROD_TARGET_URL
    if (process.env.PROD_TARGET_URL || process.env.PROD_TARGET_HOST) {
        // Parse URL if available to get host/port defaults, or fallback to individual vars
        // Note: Actual connection logic handles the string if connection_string_env is set.

        instances.push({
            id: 'prod-target-aws',
            name: 'Zluri Query Portal', // Renamed per user request
            type: 'postgresql',
            host: process.env.PROD_TARGET_HOST || 'localhost', // Placeholder if URL is used
            port: parseInt(process.env.PROD_TARGET_PORT || '5432', 10),
            user: process.env.PROD_TARGET_USER || 'postgres',
            password: process.env.PROD_TARGET_PASSWORD || '',
            connection_string_env: 'PROD_TARGET_URL', // Use this env var for full connection string
            databases: [], // Will be populated by sync
        } as PostgresInstance);
    }

    if (process.env.PROD_MONGO_URI) {
        instances.push({
            id: 'prod-mongo-atlas',
            name: 'Production-Atlas',
            type: 'mongodb',
            uri: process.env.PROD_MONGO_URI,
            connection_string_env: 'PROD_MONGO_URI',
            databases: [], // Will be populated by sync
        } as MongoInstance);
    }

    return instances;
}

// ============================================================================
// POD Functions
// ============================================================================

/**
 * Get all PODs
 */
export function getAllPods(): Pod[] {
    return [...pods];
}

/**
 * Get POD by ID
 */
export function getPodById(podId: string): Pod | null {
    return pods.find((pod) => pod.id === podId) || null;
}

/**
 * Get PODs by manager email
 */
export function getPodsByManager(email: string): Pod[] {
    const normalizedEmail = email.toLowerCase().trim();
    return pods.filter((pod) => pod.manager_email.toLowerCase().trim() === normalizedEmail);
}

// ============================================================================
// Instance Functions
// ============================================================================

/**
 * Get all database instances (public info only - NO connection details)
 * Databases should be fetched separately via /instances/:id/databases
 */
export function getAllInstances(): PublicInstanceInfo[] {
    return getDatabaseInstancesArray().map((instance) => ({
        id: instance.id,
        name: instance.name,
        type: instance.type,
    }));
}

/**
 * Get database instances by type (NO connection details)
 */
export function getInstancesByType(type: DatabaseInstanceType): PublicInstanceInfo[] {
    return getDatabaseInstancesArray()
        .filter((instance) => instance.type === type.toLowerCase())
        .map((instance) => ({
            id: instance.id,
            name: instance.name,
            type: instance.type,
        }));
}

/**
 * Get instance by ID (includes connection details for internal use)
 * FIX: Returns flat structure with host, port, user, password directly
 */
export function getInstanceById(instanceId: string): DatabaseInstance | null {
    const instances = getDatabaseInstancesArray();
    return instances.find((inst) => inst.id === instanceId) || null;
}

/**
 * Get databases for an instance
 */
export function getDatabasesForInstance(instanceId: string): string[] {
    const instances = getDatabaseInstancesArray();
    const instance = instances.find((inst) => inst.id === instanceId);
    return instance ? [...instance.databases] : [];
}

/**
 * Validate if instance and database combination exists
 */
export function validateInstanceDatabase(instanceId: string, databaseName: string): boolean {
    const instances = getDatabaseInstancesArray();
    const instance = instances.find((inst) => inst.id === instanceId);
    if (!instance) return false;
    return instance.databases.includes(databaseName);
}

// ============================================================================
// Exports
// ============================================================================

export { pods, getDatabaseInstancesArray };

// Backward compatibility getter
export const databaseInstances = getDatabaseInstancesArray();

export default {
    pods,
    get databaseInstances() {
        return getDatabaseInstancesArray();
    },
    getAllPods,
    getPodById,
    getPodsByManager,
    getAllInstances,
    getInstancesByType,
    getInstanceById,
    getDatabasesForInstance,
    validateInstanceDatabase,
    getDatabaseInstancesArray,
};
