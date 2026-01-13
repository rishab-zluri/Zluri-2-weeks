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
 * CRITICAL FIXES:
 * - Connection Pooling: Uses singleton pools for PostgreSQL/MongoDB connections
 * - Transaction Support: Database writes in syncInstanceDatabases are atomic
 */

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { portalQuery, getPortalPool, transaction } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SYNC_CONFIG = {
  // Sync interval in minutes
  intervalMinutes: parseInt(process.env.DB_SYNC_INTERVAL_MINUTES, 10) || 60,
  // Connection timeout for target instances
  connectionTimeoutMs: parseInt(process.env.DB_SYNC_TIMEOUT_MS, 10) || 15000,
  // Enable sync on startup
  syncOnStartup: process.env.DB_SYNC_ON_STARTUP !== 'false',
  // Initial delay before first sync (seconds)
  startupDelaySeconds: parseInt(process.env.DB_SYNC_STARTUP_DELAY, 10) || 30,
};

// Interval reference for cleanup
let syncInterval = null;

// Sync status tracking (for health check)
let lastSyncAt = null;
let nextSyncAt = null;
let instancesCached = 0;

// ============================================================================
// CONNECTION POOL SINGLETONS (CRITICAL FIX)
// ============================================================================

// Singleton pools for PostgreSQL instances
const pgSyncPools = new Map();

// Singleton clients for MongoDB instances
const mongoSyncClients = new Map();

/**
 * Get or create PostgreSQL pool for sync operations
 * CRITICAL FIX: Reuses pools instead of creating new ones each sync
 * @param {Object} instance - Instance configuration
 * @param {Object} credentials - Connection credentials
 * @returns {Pool} PostgreSQL pool
 */
/* istanbul ignore next - pool creation requires real DB connection */
const getOrCreatePgPool = (instance, credentials) => {
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
      idleTimeoutMillis: 60000, // Close idle connections after 1 minute
    });

    pool.on('error', (err) => {
      logger.error('PostgreSQL sync pool error', { instanceId: instance.id, error: err.message });
    });

    pgSyncPools.set(poolKey, pool);
  }

  return pgSyncPools.get(poolKey);
};

/**
 * Get or create MongoDB client for sync operations
 * CRITICAL FIX: Reuses clients instead of creating new ones each sync
 * @param {Object} instance - Instance configuration
 * @param {Object} credentials - Connection credentials
 * @returns {Promise<MongoClient>} MongoDB client
 */
/* istanbul ignore next - client creation requires real DB connection */
const getOrCreateMongoClient = async (instance, credentials) => {
  const clientKey = instance.id;
  
  if (!mongoSyncClients.has(clientKey)) {
    logger.debug('Creating new MongoDB sync client', { instanceId: instance.id });
    
    let connectionString = credentials.connectionString;
    
    if (!connectionString) {
      const auth = credentials.user && credentials.password 
        ? `${encodeURIComponent(credentials.user)}:${encodeURIComponent(credentials.password)}@`
        : '';
      connectionString = `mongodb://${auth}${instance.host}:${instance.port}`;
    }

    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: SYNC_CONFIG.connectionTimeoutMs,
      connectTimeoutMS: SYNC_CONFIG.connectionTimeoutMs,
      maxPoolSize: 2, // Small pool for sync operations
    });

    await client.connect();
    mongoSyncClients.set(clientKey, client);
  }

  return mongoSyncClients.get(clientKey);
};

/**
 * Close all sync connection pools (for graceful shutdown)
 */
/* istanbul ignore next - pool cleanup requires real DB connections */
const closeSyncPools = async () => {
  const closePromises = [];

  // Close PostgreSQL pools
  for (const [key, pool] of pgSyncPools) {
    closePromises.push(
      pool.end()
        .then(() => logger.info('PostgreSQL sync pool closed', { instanceId: key }))
        .catch((err) => logger.error('Error closing PostgreSQL sync pool', { instanceId: key, error: err.message }))
    );
  }
  pgSyncPools.clear();

  // Close MongoDB clients
  for (const [key, client] of mongoSyncClients) {
    closePromises.push(
      client.close()
        .then(() => logger.info('MongoDB sync client closed', { instanceId: key }))
        .catch((err) => logger.error('Error closing MongoDB sync client', { instanceId: key, error: err.message }))
    );
  }
  mongoSyncClients.clear();

  await Promise.allSettled(closePromises);
  logger.info('All sync connection pools closed');
};

/**
 * Get current sync status (used by server.js health check)
 */
const getSyncStatus = () => {
  return {
    isRunning: syncInterval !== null,
    lastSyncAt,
    nextSyncAt,
    instancesCached,
    intervalMinutes: SYNC_CONFIG.intervalMinutes,
  };
};

// ============================================================================
// BLACKLIST MANAGEMENT
// ============================================================================

/**
 * Get blacklist patterns from database
 */
const getBlacklist = async () => {
  const result = await portalQuery(`
    SELECT pattern, pattern_type FROM database_blacklist
  `);
  return result.rows;
};

/**
 * Check if database name is blacklisted
 */
const isBlacklisted = (dbName, blacklist) => {
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
};

// ============================================================================
// CREDENTIAL MANAGEMENT
// ============================================================================

/**
 * Get credentials for an instance from environment variables
 */
const getInstanceCredentials = (instance) => {
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
                      process.env[instance.connection_string_env] || null,
  };
};

// ============================================================================
// POSTGRESQL SYNC
// ============================================================================

/**
 * Fetch databases from a PostgreSQL instance
 * CRITICAL FIX: Uses singleton pool instead of creating new pool each time
 */
/* istanbul ignore next - requires real DB connection */
const fetchPostgresDatabases = async (instance, credentials) => {
  const pool = getOrCreatePgPool(instance, credentials);

  try {
    const result = await pool.query(`
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
};

// ============================================================================
// MONGODB SYNC
// ============================================================================

/**
 * Fetch databases from a MongoDB instance
 * CRITICAL FIX: Uses singleton client instead of creating new client each time
 */
/* istanbul ignore next - requires real DB connection */
const fetchMongoDatabases = async (instance, credentials) => {
  try {
    const client = await getOrCreateMongoClient(instance, credentials);
    const adminDb = client.db('admin');
    const result = await adminDb.command({ listDatabases: 1, nameOnly: true });
    return result.databases.map(db => db.name);
  } catch (error) {
    // If connection fails, remove the client so it can be recreated
    mongoSyncClients.delete(instance.id);
    throw error;
  }
};

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Perform database sync operations within a transaction
 * CRITICAL FIX: All database writes are atomic - either all succeed or all rollback
 * 
 * @param {Object} client - Database client from transaction
 * @param {string} instanceId - Instance ID
 * @param {Array} filteredDatabases - Databases to sync
 * @returns {Object} { databasesAdded, databasesDeactivated }
 */
const performSyncInTransaction = async (client, instanceId, filteredDatabases) => {
  let databasesAdded = 0;
  let databasesDeactivated = 0;

  // Upsert databases
  for (const dbName of filteredDatabases) {
    const upsertResult = await client.query(`
      INSERT INTO databases (instance_id, name, source, is_active, last_seen_at)
      VALUES ($1, $2, 'synced', true, CURRENT_TIMESTAMP)
      ON CONFLICT (instance_id, name) 
      DO UPDATE SET 
        is_active = true, 
        last_seen_at = CURRENT_TIMESTAMP,
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

    databasesDeactivated = deactivateResult.rowCount;
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
};

/**
 * Sync databases for a single instance
 * CRITICAL FIX: Uses transaction for atomic database writes
 * - All upserts, deactivations, and status updates happen atomically
 * - If any operation fails, all changes are rolled back
 */
const syncInstanceDatabases = async (instance, options = {}) => {
  const { triggeredBy = null, syncType = 'manual' } = options;
  const startTime = Date.now();
  
  logger.info('Starting database sync for instance', { 
    instanceId: instance.id,
    instanceType: instance.type,
    syncType,
  });

  const syncResult = {
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
    let databases = [];
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

    // CRITICAL FIX: Perform all database writes in a transaction
    const txResult = await transaction(async (client) => {
      return performSyncInTransaction(client, instance.id, filteredDatabases);
    });

    syncResult.databasesAdded = txResult.databasesAdded;
    syncResult.databasesDeactivated = txResult.databasesDeactivated;
    syncResult.success = true;
    syncResult.duration = Date.now() - startTime;

    logger.info('Database sync completed for instance', {
      instanceId: instance.id,
      ...syncResult,
    });

  } catch (error) {
    syncResult.error = error.message;
    syncResult.duration = Date.now() - startTime;

    // Update instance sync status (outside transaction - this should always run)
    await portalQuery(`
      UPDATE database_instances
      SET last_sync_at = CURRENT_TIMESTAMP,
          last_sync_status = 'failed',
          last_sync_error = $2
      WHERE id = $1
    `, [instance.id, error.message]);

    logger.error('Database sync failed for instance', {
      instanceId: instance.id,
      error: error.message,
      duration: syncResult.duration,
    });
  }

  // Record sync history (outside transaction - audit log should always be recorded)
  await portalQuery(`
    INSERT INTO database_sync_history 
    (instance_id, sync_type, status, databases_found, databases_added, databases_removed, error_message, duration_ms, triggered_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
};

/**
 * Sync all active instances
 */
const syncAllDatabases = async (options = {}) => {
  const { triggeredBy = null, syncType = 'scheduled' } = options;
  
  logger.info('Starting full database sync', { syncType });

  // Get all active instances
  const instancesResult = await portalQuery(`
    SELECT id, name, type, host, port, credentials_env_prefix, connection_string_env
    FROM database_instances
    WHERE is_active = true
  `);

  const results = {
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
};

// ============================================================================
// DATABASE QUERIES (Fast - from local table)
// ============================================================================

/**
 * Get all active database instances
 */
const getInstances = async (type = null) => {
  let query = `
    SELECT id, name, type, description, last_sync_at, last_sync_status
    FROM database_instances
    WHERE is_active = true
  `;
  const params = [];

  if (type) {
    query += ` AND type = $1`;
    params.push(type);
  }

  query += ` ORDER BY name`;

  const result = await portalQuery(query, params);
  return result.rows;
};

/**
 * Get databases for an instance (from local table - FAST)
 */
const getDatabasesForInstance = async (instanceId) => {
  const result = await portalQuery(`
    SELECT name, description, source, last_seen_at
    FROM databases
    WHERE instance_id = $1 AND is_active = true
    ORDER BY name
  `, [instanceId]);

  return result.rows;
};

/**
 * Get instance by ID
 */
const getInstanceById = async (instanceId) => {
  const result = await portalQuery(`
    SELECT id, name, type, host, port, credentials_env_prefix, connection_string_env,
           description, last_sync_at, last_sync_status
    FROM database_instances
    WHERE id = $1 AND is_active = true
  `, [instanceId]);

  return result.rows[0] || null;
};

/**
 * Get sync history for an instance
 */
const getSyncHistory = async (instanceId, limit = 10) => {
  const result = await portalQuery(`
    SELECT id, sync_type, status, databases_found, databases_added, 
           databases_removed, error_message, duration_ms, created_at
    FROM database_sync_history
    WHERE instance_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [instanceId, limit]);

  return result.rows;
};

// ============================================================================
// BLACKLIST MANAGEMENT
// ============================================================================

/**
 * Add pattern to blacklist
 */
const addToBlacklist = async (pattern, patternType, reason, userId) => {
  const result = await portalQuery(`
    INSERT INTO database_blacklist (pattern, pattern_type, reason, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [pattern, patternType, reason, userId]);

  return result.rows[0];
};

/**
 * Remove pattern from blacklist
 */
const removeFromBlacklist = async (id) => {
  const result = await portalQuery(`
    DELETE FROM database_blacklist WHERE id = $1 RETURNING id
  `, [id]);

  return result.rowCount > 0;
};

/**
 * Get all blacklist entries
 */
const getBlacklistEntries = async () => {
  const result = await portalQuery(`
    SELECT id, pattern, pattern_type, reason, created_at
    FROM database_blacklist
    ORDER BY pattern
  `);

  return result.rows;
};

// ============================================================================
// PERIODIC SYNC SCHEDULER
// ============================================================================

/**
 * Start periodic sync scheduler
 */
const startPeriodicSync = () => {
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
  const updateNextSync = () => {
    nextSyncAt = new Date(Date.now() + intervalMs).toISOString();
  };

  // Sync on startup after delay
  if (SYNC_CONFIG.syncOnStartup) {
    setTimeout(() => {
      syncAllDatabases({ syncType: 'startup' }).catch(err => {
        logger.error('Startup sync failed', { error: err.message });
      });
      updateNextSync();
    }, SYNC_CONFIG.startupDelaySeconds * 1000);
  }

  // Schedule periodic sync
  syncInterval = setInterval(() => {
    syncAllDatabases({ syncType: 'scheduled' }).catch(err => {
      logger.error('Scheduled sync failed', { error: err.message });
    });
    updateNextSync();
  }, intervalMs);

  updateNextSync();
  logger.info('Periodic sync scheduler started');
};

/**
 * Stop periodic sync scheduler
 */
const stopPeriodicSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.info('Periodic sync scheduler stopped');
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Sync operations
  syncInstanceDatabases,
  syncAllDatabases,
  startPeriodicSync,
  stopPeriodicSync,
  getSyncStatus,
  closeSyncPools,  // NEW: For graceful shutdown
  
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