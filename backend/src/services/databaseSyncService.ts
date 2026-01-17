/**
 * Database Sync Service
 *
 * HYBRID APPROACH:
 * - Store databases in static table (fast lookups)
 * - Periodically sync from actual instances (stay up-to-date)
 * - Manual refresh endpoint for admins
 *
 * Benefits:
 * ✅ Fast dropdown loading (from local table)
 * ✅ Always up-to-date (periodic sync)
 * ✅ Security control (blacklist)
 * ✅ Works even if instance is temporarily down
 *
 * ARCHITECTURE:
 * - Singleton connection pools per instance (reused across syncs)
 * - Transaction-based database writes (atomic operations)
 * - Blacklist filtering (excludes system databases)
 * - Periodic scheduler with configurable interval
 *
 * CRITICAL FIXES:
 * - Connection Pooling: Uses singleton pools for PostgreSQL/MongoDB connections
 * - Transaction Support: Database writes in syncInstanceDatabases are atomic
 */

import { Pool, PoolClient } from 'pg';
import { MongoClient, Db } from 'mongodb';
import { portalQuery, getPortalPool, transaction } from '../config/database';
import logger from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sync configuration
 */
export interface SyncConfig {
    intervalMinutes: number;
    connectionTimeoutMs: number;
    syncOnStartup: boolean;
    startupDelaySeconds: number;
}

/**
 * Database instance from database_instances table
 */
export interface DatabaseInstance {
    id: string;
    name: string;
    type: 'postgresql' | 'mongodb';
    host?: string;
    port?: number;
    credentials_env_prefix?: string;
    connection_string_env?: string;
    description?: string;
    last_sync_at?: Date;
    last_sync_status?: string;
    is_active?: boolean;
}

/**
 * Instance credentials
 */
export interface InstanceCredentials {
    user: string;
    password: string;
    connectionString: string | null;
}

/**
 * Blacklist entry
 */
export interface BlacklistEntry {
    id?: number;
    pattern: string;
    pattern_type: 'exact' | 'prefix' | 'regex';
    reason?: string;
    created_at?: Date;
    created_by?: string;
}

/**
 * Sync result for a single instance
 */
export interface InstanceSyncResult {
    instanceId: string;
    success: boolean;
    databasesFound: number;
    databasesAdded: number;
    databasesDeactivated: number;
    error: string | null;
    duration: number;
}

/**
 * Full sync result for all instances
 */
export interface FullSyncResult {
    total: number;
    successful: number;
    failed: number;
    details: InstanceSyncResult[];
}

/**
 * Sync status for health check
 */
export interface SyncStatus {
    isRunning: boolean;
    lastSyncAt: string | null;
    nextSyncAt: string | null;
    instancesCached: number;
    intervalMinutes: number;
}

/**
 * Database entry from databases table
 */
export interface DatabaseEntry {
    name: string;
    description?: string;
    source?: string;
    last_seen_at?: Date;
}

/**
 * Sync history entry
 */
export interface SyncHistoryEntry {
    id: number;
    sync_type: string;
    status: string;
    databases_found: number;
    databases_added: number;
    databases_removed: number;
    error_message: string | null;
    duration_ms: number;
    created_at: Date;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const SYNC_CONFIG: SyncConfig = {
    intervalMinutes: parseInt(process.env.DB_SYNC_INTERVAL_MINUTES || '60', 10) || 60,
    connectionTimeoutMs: parseInt(process.env.DB_SYNC_TIMEOUT_MS || '15000', 10) || 15000,
    syncOnStartup: process.env.DB_SYNC_ON_STARTUP !== 'false',
    startupDelaySeconds: parseInt(process.env.DB_SYNC_STARTUP_DELAY || '5', 10) || 5,
};

// Interval reference for cleanup
let syncInterval: NodeJS.Timeout | null = null;

// Sync status tracking (for health check)
let lastSyncAt: string | null = null;
let nextSyncAt: string | null = null;
let instancesCached = 0;

// =============================================================================
// CONNECTION POOL SINGLETONS
// =============================================================================

/**
 * Singleton pools for PostgreSQL instances
 * Key: instanceId, Value: Pool
 */
const pgSyncPools = new Map<string, Pool>();

/**
 * Singleton clients for MongoDB instances
 * Key: instanceId, Value: MongoClient
 */
const mongoSyncClients = new Map<string, MongoClient>();

/**
 * Get or create PostgreSQL pool for sync operations
 * Reuses pools instead of creating new ones each sync
 */
/* istanbul ignore next - pool creation requires real DB connection */
function getOrCreatePgPool(instance: DatabaseInstance, credentials: InstanceCredentials): Pool {
    const poolKey = instance.id;

    if (!pgSyncPools.has(poolKey)) {
        logger.debug('Creating new PostgreSQL sync pool', { instanceId: instance.id });

        const pool = new Pool({
            host: instance.host,
            port: instance.port,
            database: 'postgres',
            user: credentials.user,
            password: credentials.password,
            connectionTimeoutMillis: SYNC_CONFIG.connectionTimeoutMs,
            max: 2, // Small pool for sync operations
            idleTimeoutMillis: 60000,
        });

        pool.on('error', (err: Error) => {
            logger.error('PostgreSQL sync pool error', { instanceId: instance.id, error: err.message });
        });

        pgSyncPools.set(poolKey, pool);
    }

    return pgSyncPools.get(poolKey)!;
}

/**
 * Get or create MongoDB client for sync operations
 * Reuses clients instead of creating new ones each sync
 */
/* istanbul ignore next - client creation requires real DB connection */
async function getOrCreateMongoClient(instance: DatabaseInstance, credentials: InstanceCredentials): Promise<MongoClient> {
    const clientKey = instance.id;

    if (!mongoSyncClients.has(clientKey)) {
        logger.debug('Creating new MongoDB sync client', { instanceId: instance.id });

        let connectionString = credentials.connectionString;

        if (!connectionString) {
            const isAtlas = instance.host && instance.host.endsWith('.mongodb.net');
            const protocol = isAtlas ? 'mongodb+srv' : 'mongodb';

            // For SRV (Atlas), we typically don't specify port as it's handled by DNS lookup
            // But if we must, it's usually part of the SRV record. 
            // Standard construction: mongodb+srv://user:pass@host/
            const portPart = (!isAtlas && instance.port) ? `:${instance.port}` : '';

            const auth = credentials.user && credentials.password
                ? `${encodeURIComponent(credentials.user)}:${encodeURIComponent(credentials.password)}@`
                : '';

            connectionString = `${protocol}://${auth}${instance.host}${portPart}`;

            // For Atlas, we might need to ensure retryWrites is true, but that's usually default
        }

        const client = new MongoClient(connectionString, {
            serverSelectionTimeoutMS: SYNC_CONFIG.connectionTimeoutMs,
            connectTimeoutMS: SYNC_CONFIG.connectionTimeoutMs,
            maxPoolSize: 2,
        });

        await client.connect();
        mongoSyncClients.set(clientKey, client);
    }

    return mongoSyncClients.get(clientKey)!;
}

/**
 * Close all sync connection pools (for graceful shutdown)
 */
/* istanbul ignore next - pool cleanup requires real DB connections */
export async function closeSyncPools(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // Close PostgreSQL pools
    for (const [key, pool] of pgSyncPools) {
        closePromises.push(
            pool.end()
                .then(() => { logger.info('PostgreSQL sync pool closed', { instanceId: key }); })
                .catch((err: Error) => { logger.error('Error closing PostgreSQL sync pool', { instanceId: key, error: err.message }); })
        );
    }
    pgSyncPools.clear();

    // Close MongoDB clients
    for (const [key, client] of mongoSyncClients) {
        closePromises.push(
            client.close()
                .then(() => { logger.info('MongoDB sync client closed', { instanceId: key }); })
                .catch((err: Error) => { logger.error('Error closing MongoDB sync client', { instanceId: key, error: err.message }); })
        );
    }
    mongoSyncClients.clear();

    await Promise.allSettled(closePromises);
    logger.info('All sync connection pools closed');
}

/**
 * Get current sync status (used by server.js health check)
 */
export function getSyncStatus(): SyncStatus {
    return {
        isRunning: syncInterval !== null,
        lastSyncAt,
        nextSyncAt,
        instancesCached,
        intervalMinutes: SYNC_CONFIG.intervalMinutes,
    };
}

// =============================================================================
// BLACKLIST MANAGEMENT
// =============================================================================

/**
 * Get blacklist patterns from database
 */
export async function getBlacklist(): Promise<BlacklistEntry[]> {
    const result = await portalQuery<BlacklistEntry>(`
    SELECT pattern, pattern_type FROM database_blacklist
  `);
    return result.rows;
}

/**
 * Check if database name is blacklisted
 */
export function isBlacklisted(dbName: string, blacklist: BlacklistEntry[]): boolean {
    const lowerName = dbName.toLowerCase();

    for (const { pattern, pattern_type } of blacklist) {
        const lowerPattern = pattern.toLowerCase();

        switch (pattern_type) {
            case 'exact':
                if (lowerName === lowerPattern) return true;
                break;
            case 'prefix':
                if (lowerName.startsWith(lowerPattern)) return true;
                break;
            case 'regex':
                try {
                    if (new RegExp(pattern, 'i').test(dbName)) return true;
                } catch (e) {
                    logger.warn('Invalid regex pattern in blacklist', { pattern });
                }
                break;
        }
    }

    return false;
}

// =============================================================================
// CREDENTIAL MANAGEMENT
// =============================================================================

/**
 * Get credentials for an instance from environment variables
 */
export function getInstanceCredentials(instance: DatabaseInstance): InstanceCredentials {
    /* istanbul ignore next - environment variable fallback chain */
    const prefix = instance.credentials_env_prefix ||
        instance.id.toUpperCase().replace(/-/g, '_');

    return {
        /* istanbul ignore next - environment variable fallback chain */
        user: process.env[`${prefix}_USER`] || process.env.DB_DEFAULT_USER || 'postgres',
        /* istanbul ignore next - environment variable fallback chain */
        password: process.env[`${prefix}_PASSWORD`] || process.env.DB_DEFAULT_PASSWORD || '',
        /* istanbul ignore next - environment variable fallback chain */
        connectionString: process.env[`${prefix}_CONNECTION_STRING`] ||
            (instance.connection_string_env ? process.env[instance.connection_string_env] : null) ||
            null,
    };
}

// =============================================================================
// DATABASE SYNC OPERATIONS
// =============================================================================

/**
 * Fetch databases from a PostgreSQL instance
 */
/* istanbul ignore next - requires real DB connection */
async function fetchPostgresDatabases(instance: DatabaseInstance, credentials: InstanceCredentials): Promise<string[]> {
    const pool = getOrCreatePgPool(instance, credentials);

    try {
        const result = await pool.query<{ name: string }>(`
      SELECT datname AS name
      FROM pg_database
      WHERE datistemplate = false
        AND datallowconn = true
      ORDER BY datname
    `);
        return result.rows.map(row => row.name);
    } catch (error) {
        // If connection fails, remove the pool so it can be recreated
        pgSyncPools.delete(instance.id);
        throw error;
    }
}

/**
 * Fetch databases from a MongoDB instance
 */
/* istanbul ignore next - requires real DB connection */
async function fetchMongoDatabases(instance: DatabaseInstance, credentials: InstanceCredentials): Promise<string[]> {
    try {
        const client = await getOrCreateMongoClient(instance, credentials);
        const adminDb = client.db('admin');
        const result = await adminDb.command({ listDatabases: 1, nameOnly: true });
        return result.databases.map((db: { name: string }) => db.name);
    } catch (error) {
        // If connection fails, remove the client so it can be recreated
        mongoSyncClients.delete(instance.id);
        throw error;
    }
}

/**
 * Perform database sync operations within a transaction
 * All database writes are atomic - either all succeed or all rollback
 */
async function performSyncInTransaction(
    client: PoolClient,
    instanceId: string,
    filteredDatabases: string[]
): Promise<{ databasesAdded: number; databasesDeactivated: number }> {
    let databasesAdded = 0;
    let databasesDeactivated = 0;

    // Upsert databases
    for (const dbName of filteredDatabases) {
        const upsertResult = await client.query<{ is_insert: boolean }>(`
      INSERT INTO databases (instance_id, name, source, is_active, last_seen_at, created_at, updated_at)
      VALUES ($1, $2, 'synced', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (instance_id, name) 
      DO UPDATE SET 
        is_active = true, 
        last_seen_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP,
        source = CASE WHEN databases.source = 'manual' THEN 'manual' ELSE 'synced' END
      RETURNING (xmax = 0) AS is_insert
    `, [instanceId, dbName]);

        if (upsertResult.rows[0]?.is_insert) {
            databasesAdded++;
        }
    }

    // Mark databases not seen in this sync as inactive (soft delete)
    if (filteredDatabases.length > 0) {
        const deactivateResult = await client.query(`
      UPDATE databases
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE instance_id = $1
        AND name != ALL($2::text[])
        AND is_active = true
        AND source = 'synced'
      RETURNING id
    `, [instanceId, filteredDatabases]);

        databasesDeactivated = deactivateResult.rowCount || 0;
    }

    // Update instance sync status
    await client.query(`
    UPDATE database_instances
    SET last_sync_at = CURRENT_TIMESTAMP,
        last_sync_status = 'success',
        last_sync_error = NULL
    WHERE id = $1
  `, [instanceId]);

    return { databasesAdded, databasesDeactivated };
}

/**
 * Sync databases for a single instance
 * Uses transaction for atomic database writes
 */
export async function syncInstanceDatabases(
    instance: DatabaseInstance,
    options: { triggeredBy?: string | null; syncType?: string } = {}
): Promise<InstanceSyncResult> {
    const { triggeredBy = null, syncType = 'manual' } = options;
    const startTime = Date.now();

    logger.info('Starting database sync for instance', {
        instanceId: instance.id,
        instanceType: instance.type,
        syncType,
    });

    const syncResult: InstanceSyncResult = {
        instanceId: instance.id,
        success: false,
        databasesFound: 0,
        databasesAdded: 0,
        databasesDeactivated: 0,
        error: null,
        duration: 0,
    };

    try {
        // Get credentials
        const credentials = getInstanceCredentials(instance);

        // Get blacklist
        const blacklist = await getBlacklist();

        // Fetch databases from instance
        let databases: string[] = [];
        if (instance.type === 'postgresql') {
            databases = await fetchPostgresDatabases(instance, credentials);
        } else if (instance.type === 'mongodb') {
            databases = await fetchMongoDatabases(instance, credentials);
        } else {
            throw new Error(`Unknown instance type: ${instance.type}`);
        }

        // Filter out blacklisted databases
        const filteredDatabases = databases.filter(db => !isBlacklisted(db, blacklist));
        syncResult.databasesFound = filteredDatabases.length;

        logger.info('Fetched databases from instance', {
            instanceId: instance.id,
            total: databases.length,
            afterBlacklist: filteredDatabases.length,
            blacklisted: databases.length - filteredDatabases.length,
        });

        // Perform all database writes in a transaction
        const txResult = await transaction(async (client) => {
            return performSyncInTransaction(client, instance.id, filteredDatabases);
        });

        syncResult.databasesAdded = txResult.databasesAdded;
        syncResult.databasesDeactivated = txResult.databasesDeactivated;
        syncResult.success = true;
        syncResult.duration = Date.now() - startTime;

        logger.info('Database sync completed for instance', syncResult);

    } catch (error) {
        const err = error as Error;
        syncResult.error = err.message;
        syncResult.duration = Date.now() - startTime;

        // Update instance sync status (outside transaction - this should always run)
        await portalQuery(`
      UPDATE database_instances
      SET last_sync_at = CURRENT_TIMESTAMP,
          last_sync_status = 'failed',
          last_sync_error = $2
      WHERE id = $1
    `, [instance.id, err.message]);

        logger.error('Database sync failed for instance', {
            instanceId: instance.id,
            error: err.message,
            duration: syncResult.duration,
        });
    }

    // Record sync history (outside transaction - audit log should always be recorded)
    await portalQuery(`
    INSERT INTO database_sync_history 
    (instance_id, sync_type, status, databases_found, databases_added, databases_removed, error_message, duration_ms, triggered_by_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
        instance.id,
        syncType,
        syncResult.success ? 'success' : 'failed',
        syncResult.databasesFound,
        syncResult.databasesAdded,
        syncResult.databasesDeactivated,
        syncResult.error,
        syncResult.duration,
        triggeredBy,
    ]);

    return syncResult;
}

/**
 * Sync all active instances
 */
export async function syncAllDatabases(
    options: { triggeredBy?: string | null; syncType?: string } = {}
): Promise<FullSyncResult> {
    const { triggeredBy = null, syncType = 'scheduled' } = options;

    logger.info('Starting full database sync', { syncType });

    // Get all active instances
    const instancesResult = await portalQuery<DatabaseInstance>(`
    SELECT id, name, type, host, port, credentials_env_prefix, connection_string_env
    FROM database_instances
    WHERE is_active = true
  `);

    const results: FullSyncResult = {
        total: instancesResult.rows.length,
        successful: 0,
        failed: 0,
        details: [],
    };

    for (const instance of instancesResult.rows) {
        const result = await syncInstanceDatabases(instance, { triggeredBy, syncType });
        results.details.push(result);

        if (result.success) {
            results.successful++;
        } else {
            results.failed++;
        }
    }

    logger.info('Full database sync completed', {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
    });

    // Update sync status tracking
    lastSyncAt = new Date().toISOString();
    instancesCached = results.successful;

    return results;
}

// =============================================================================
// DATABASE QUERIES (Fast - from local table)
// =============================================================================

/**
 * Get all active database instances
 */
export async function getInstances(type: string | null = null): Promise<DatabaseInstance[]> {
    let query = `
    SELECT id, name, type, description, last_sync_at, last_sync_status
    FROM database_instances
    WHERE is_active = true
  `;
    const params: unknown[] = [];

    if (type) {
        query += ` AND type = $1`;
        params.push(type);
    }

    query += ` ORDER BY name`;

    const result = await portalQuery<DatabaseInstance>(query, params);
    return result.rows;
}

/**
 * Get databases for an instance (from local table - FAST)
 */
export async function getDatabasesForInstance(instanceId: string): Promise<DatabaseEntry[]> {
    const result = await portalQuery<DatabaseEntry>(`
    SELECT name, description, source, last_seen_at
    FROM databases
    WHERE instance_id = $1 AND is_active = true
    ORDER BY name
  `, [instanceId]);

    return result.rows;
}

/**
 * Get instance by ID
 */
export async function getInstanceById(instanceId: string): Promise<DatabaseInstance | null> {
    const result = await portalQuery<DatabaseInstance>(`
    SELECT id, name, type, host, port, credentials_env_prefix, connection_string_env,
           description, last_sync_at, last_sync_status
    FROM database_instances
    WHERE id = $1 AND is_active = true
  `, [instanceId]);

    return result.rows[0] || null;
}

/**
 * Get sync history for an instance
 */
export async function getSyncHistory(instanceId: string, limit: number = 10): Promise<SyncHistoryEntry[]> {
    const result = await portalQuery<SyncHistoryEntry>(`
    SELECT id, sync_type, status, databases_found, databases_added, 
           databases_removed, error_message, duration_ms, created_at
    FROM database_sync_history
    WHERE instance_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [instanceId, limit]);

    return result.rows;
}

// =============================================================================
// BLACKLIST MANAGEMENT
// =============================================================================

/**
 * Add pattern to blacklist
 */
export async function addToBlacklist(
    pattern: string,
    patternType: 'exact' | 'prefix' | 'regex',
    reason: string,
    userId: string
): Promise<{ id: number }> {
    const result = await portalQuery<{ id: number }>(`
    INSERT INTO database_blacklist (pattern, pattern_type, reason, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [pattern, patternType, reason, userId]);

    return result.rows[0];
}

/**
 * Remove pattern from blacklist
 */
export async function removeFromBlacklist(id: number): Promise<boolean> {
    const result = await portalQuery(`
    DELETE FROM database_blacklist WHERE id = $1 RETURNING id
  `, [id]);

    return (result.rowCount || 0) > 0;
}

/**
 * Get all blacklist entries
 */
export async function getBlacklistEntries(): Promise<BlacklistEntry[]> {
    const result = await portalQuery<BlacklistEntry>(`
    SELECT id, pattern, pattern_type, reason, created_at
    FROM database_blacklist
    ORDER BY pattern
  `);

    return result.rows;
}

// =============================================================================
// PERIODIC SYNC SCHEDULER
// =============================================================================

/**
 * Start periodic sync scheduler
 */
export function startPeriodicSync(): void {
    if (syncInterval) {
        logger.warn('Periodic sync already running');
        return;
    }

    const intervalMs = SYNC_CONFIG.intervalMinutes * 60 * 1000;

    logger.info('Starting periodic database sync', {
        intervalMinutes: SYNC_CONFIG.intervalMinutes,
        syncOnStartup: SYNC_CONFIG.syncOnStartup,
        startupDelaySeconds: SYNC_CONFIG.startupDelaySeconds,
    });

    // Helper to update next sync time
    const updateNextSync = (): void => {
        nextSyncAt = new Date(Date.now() + intervalMs).toISOString();
    };

    // Sync on startup after delay
    if (SYNC_CONFIG.syncOnStartup) {
        setTimeout(() => {
            syncAllDatabases({ syncType: 'startup' }).catch((err: Error) => {
                logger.error('Startup sync failed', { error: err.message });
            });
            updateNextSync();
        }, SYNC_CONFIG.startupDelaySeconds * 1000);
    }

    // Schedule periodic sync
    syncInterval = setInterval(() => {
        syncAllDatabases({ syncType: 'scheduled' }).catch((err: Error) => {
            logger.error('Scheduled sync failed', { error: err.message });
        });
        updateNextSync();
    }, intervalMs);

    updateNextSync();
    logger.info('Periodic sync scheduler started');
}

/**
 * Stop periodic sync scheduler
 */
export function stopPeriodicSync(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        logger.info('Periodic sync scheduler stopped');
    }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
    // Sync operations
    syncInstanceDatabases,
    syncAllDatabases,
    startPeriodicSync,
    stopPeriodicSync,
    getSyncStatus,
    closeSyncPools,

    // Database queries (fast, from local table)
    getInstances,
    getDatabasesForInstance,
    getInstanceById,
    getSyncHistory,

    // Blacklist management
    addToBlacklist,
    removeFromBlacklist,
    getBlacklistEntries,
    getBlacklist,
    isBlacklisted,

    // Config (for testing)
    SYNC_CONFIG,
};
