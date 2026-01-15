/**
 * Query Execution Service
 *
 * Executes queries against different database types (PostgreSQL, MongoDB).
 * 
 * REFACTORING NOTE:
 * This service now uses the Strategy Pattern to delegate execution to specific drivers.
 * Logic has been moved to:
 * - services/queryExecution/strategies/PostgresDriver.ts
 * - services/queryExecution/strategies/MongoDriver.ts
 * - services/queryExecution/ConnectionPool.ts
 * 
 * This file acts as the Context/Facade.
 */

import { ConnectionPool } from './ConnectionPool';
import { PostgresDriver } from './strategies/PostgresDriver';
import { MongoDriver } from './strategies/MongoDriver';
import {
    QueryRequest,
    ExecutionResult,
    ValidationResult,
    ConnectionTestResult,
    QueryConfig
} from './interfaces';
import { ValidationError } from '../../utils/errors';

// Re-export types and constants
export * from './interfaces';

// Configuration
export const QUERY_CONFIG: QueryConfig = {
    statementTimeout: parseInt(process.env.QUERY_TIMEOUT_MS || '30000', 10) || 30000,
    maxRows: parseInt(process.env.QUERY_MAX_ROWS || '10000', 10) || 10000,
    maxQueryLength: parseInt(process.env.QUERY_MAX_LENGTH || '100000', 10) || 100000,
    warnOnDangerousQueries: process.env.WARN_DANGEROUS_QUERIES !== 'false',
    defaultReadOnly: process.env.QUERY_DEFAULT_READONLY === 'true',
};

/**
 * Execute a query based on database type
 */
export async function executeQuery(request: QueryRequest): Promise<ExecutionResult> {
    const { databaseType } = request;

    // Choose strategy
    const driver = getDriver(databaseType);

    // Delegate execution
    return driver.execute(request);
}

/**
 * Execute a PostgreSQL query
 * Wrapper for backward compatibility
 */
export async function executePostgresQuery(request: QueryRequest): Promise<ExecutionResult> {
    // Ensure it's treated as postgres
    return executeQuery({ ...request, databaseType: 'postgresql' });
}

/**
 * Execute a MongoDB query
 * Wrapper for backward compatibility
 */
export async function executeMongoQuery(request: QueryRequest): Promise<ExecutionResult> {
    // Ensure it's treated as mongo
    return executeQuery({ ...request, databaseType: 'mongodb' });
}

/**
 * Validate a query without executing it
 */
export function validateQuery(query: string, databaseType: string): ValidationResult {
    const driver = getDriver(databaseType);
    return driver.validate(query);
}

/**
 * Test a database connection
 */
export async function testConnection(instance: any, databaseName: string): Promise<ConnectionTestResult> {
    const driver = getDriver(instance.type);
    return driver.testConnection(instance, databaseName);
}

/**
 * Get connection pool statistics
 */
export function getPoolStats() {
    return ConnectionPool.getInstance().getStats();
}

/**
 * Close all database connections
 * Useful for graceful shutdown
 */
export async function closeAllConnections(): Promise<void> {
    await ConnectionPool.getInstance().disconnect();
}

// Helper to get strategy
function getDriver(databaseType: string) {
    if (databaseType === 'postgresql' || databaseType === 'postgres') {
        return new PostgresDriver();
    }

    if (databaseType === 'mongodb' || databaseType === 'mongo') {
        return new MongoDriver();
    }

    throw new ValidationError(`Unsupported database type: ${databaseType}`);
}

// Default export for backward compatibility
export default {
    executeQuery,
    executePostgresQuery,
    executeMongoQuery,
    validateQuery,
    testConnection,
    getPoolStats,
    closeAllConnections,
    QUERY_CONFIG
};
