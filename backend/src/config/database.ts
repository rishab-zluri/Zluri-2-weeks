/**
 * PostgreSQL Database Connection Pool
 * Manages connections to the portal database
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import config from './index';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended PoolClient with timeout tracking
 */
export interface TrackedPoolClient extends PoolClient {
    release: () => void;
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

// ============================================================================
// Connection Pool
// ============================================================================

/**
 * Connection pool for portal database
 */
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
/* istanbul ignore next - pool event handler */
portalPool.on('connect', () => {
    logger.debug('New client connected to portal database');
});

/* istanbul ignore next - pool error handler */
portalPool.on('error', (err: Error) => {
    logger.error('Unexpected error on portal database pool', { error: err.message });
});

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Execute a query on the portal database
 * @param text - SQL query text
 * @param params - Query parameters
 * @returns Query result
 */
/* istanbul ignore next - query execution requires real DB */
export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = []
): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
        const result = await portalPool.query<T>(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
        return result;
    } catch (error) {
        const err = error as Error;
        logger.error('Query execution error', { text: text.substring(0, 100), error: err.message });
        throw error;
    }
}

/**
 * Get a client from the pool for transaction support
 * @returns Database client with timeout tracking
 */
/* istanbul ignore next - client checkout tracking */
export async function getClient(): Promise<TrackedPoolClient> {
    const client = await portalPool.connect();
    const originalRelease = client.release.bind(client);

    // Track long-running checkouts
    const timeout = setTimeout(() => {
        logger.error('Client has been checked out for more than 5 seconds');
    }, 5000);

    const trackedClient = client as TrackedPoolClient;
    trackedClient.release = (): void => {
        clearTimeout(timeout);
        originalRelease();
    };

    return trackedClient;
}

/**
 * Execute a transaction
 * Automatically handles BEGIN, COMMIT, ROLLBACK
 * @param callback - Async function receiving client
 * @returns Transaction result
 */
/* istanbul ignore next - transaction requires real DB connection */
export async function transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const client = await portalPool.connect();
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
}

/**
 * Test database connection
 * @returns Connection status
 */
/* istanbul ignore next - connection test requires real DB */
export async function testConnection(): Promise<boolean> {
    try {
        const result = await query<{ now: Date }>('SELECT NOW()');
        logger.info('Portal database connection successful', { timestamp: result.rows[0].now });
        return true;
    } catch (error) {
        const err = error as Error;
        logger.error('Portal database connection failed', { error: err.message });
        return false;
    }
}

/**
 * Close all pool connections
 */
/* istanbul ignore next - pool close requires real DB */
export async function closePool(): Promise<void> {
    await portalPool.end();
    logger.info('Portal database pool closed');
}

/**
 * Get the pool instance
 */
export function getPortalPool(): Pool {
    return portalPool;
}

// ============================================================================
// Exports
// ============================================================================

export {
    portalPool as pool,
    query as portalQuery,  // Alias for backward compatibility
};

export default {
    pool: portalPool,
    query,
    getClient,
    transaction,
    testConnection,
    closePool,
    portalQuery: query,
    getPortalPool,
};
