/**
 * PostgreSQL Database Connection Pool
 * Manages connections to the portal database
 */

const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

// Create connection pool for portal database
const portalPool = new Pool({
  host: config.portalDb.host,
  port: config.portalDb.port,
  database: config.portalDb.database,
  user: config.portalDb.user,
  password: config.portalDb.password,
  max: config.portalDb.max,
  idleTimeoutMillis: config.portalDb.idleTimeoutMillis,
  connectionTimeoutMillis: config.portalDb.connectionTimeoutMillis,
});

// Pool event handlers
portalPool.on('connect', () => {
  logger.debug('New client connected to portal database');
});

portalPool.on('error', (err) => {
  logger.error('Unexpected error on portal database pool', { error: err.message });
});

/**
 * Execute a query on the portal database
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await portalPool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query execution error', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
};

/**
 * Get a client from the pool for transaction support
 * @returns {Promise<PoolClient>} Database client
 */
const getClient = async () => {
  const client = await portalPool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Track query timeout
  const timeout = setTimeout(() => {
    logger.error('Client has been checked out for more than 5 seconds');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    return originalRelease();
  };

  client.query = (...args) => {
    return originalQuery(...args);
  };

  return client;
};

/**
 * Execute a transaction
 * @param {Function} callback - Async function receiving client
 * @returns {Promise<any>} Transaction result
 */
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    logger.info('Portal database connection successful', { timestamp: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('Portal database connection failed', { error: error.message });
    return false;
  }
};

/**
 * Close all pool connections
 * @returns {Promise<void>}
 */
const closePool = async () => {
  await portalPool.end();
  logger.info('Portal database pool closed');
};

module.exports = {
  pool: portalPool,
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  // Aliases for databaseSyncService.js compatibility
  portalQuery: query,
  getPortalPool: () => portalPool,
};