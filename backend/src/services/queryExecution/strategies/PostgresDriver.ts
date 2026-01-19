import { PoolClient, QueryResult } from 'pg';
import {
    IDatabaseDriver,
    QueryRequest,
    ExecutionOptions,
    ExecutionResult,
    ValidationResult,
    ValidationWarning,
    ConnectionTestResult,
    DangerousPattern,
    QueryConfig
} from '../interfaces';
import { ConnectionPool } from '../ConnectionPool';
import { getInstanceById, getInstanceCredentials } from '../../databaseSyncService';
import logger from '../../../utils/logger';
import { QueryExecutionError, ValidationError } from '../../../utils/errors';

// Configuration (could be injected or imported)
const QUERY_CONFIG: QueryConfig = {
    statementTimeout: parseInt(process.env.QUERY_TIMEOUT_MS || '30000', 10) || 30000,
    maxRows: parseInt(process.env.QUERY_MAX_ROWS || '10000', 10) || 10000,
    maxQueryLength: parseInt(process.env.QUERY_MAX_LENGTH || '100000', 10) || 100000,
    warnOnDangerousQueries: process.env.WARN_DANGEROUS_QUERIES !== 'false',
    defaultReadOnly: process.env.QUERY_DEFAULT_READONLY === 'true',
};

const DANGEROUS_SQL_PATTERNS: DangerousPattern[] = [
    { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)/i, description: 'DROP statement' },
    { pattern: /\bTRUNCATE\s+/i, description: 'TRUNCATE statement' },
    { pattern: /\bDELETE\s+FROM\s+\w+\s*(?:;|$)/i, description: 'DELETE without WHERE clause' },
    { pattern: /\bUPDATE\s+\w+\s+SET\s+[^;]*(?:;|$)(?!.*WHERE)/is, description: 'UPDATE without WHERE clause' },
    { pattern: /\bALTER\s+(TABLE|DATABASE)/i, description: 'ALTER statement' },
    { pattern: /\bGRANT\s+/i, description: 'GRANT statement' },
    { pattern: /\bREVOKE\s+/i, description: 'REVOKE statement' },
    { pattern: /\bCREATE\s+(USER|ROLE)/i, description: 'CREATE USER/ROLE statement' },
];

export class PostgresDriver implements IDatabaseDriver {
    private poolManager: ConnectionPool;

    constructor() {
        this.poolManager = ConnectionPool.getInstance();
    }

    public async execute(request: QueryRequest, options?: ExecutionOptions): Promise<ExecutionResult> {
        const { instanceId, databaseName, queryContent } = request;
        const readOnly = options?.readOnly ?? QUERY_CONFIG.defaultReadOnly;

        // 1. Validate query
        const validation = this.validate(queryContent);
        // Note: We only log warnings, specific validation errors are thrown in validate()

        // 2. Get connection config from database
        const dbInstance = await getInstanceById(instanceId);
        if (!dbInstance) throw new ValidationError(`Instance ${instanceId} not found`);
        if (dbInstance.type !== 'postgresql') throw new ValidationError(`Instance ${instanceId} is not a PostgreSQL instance`);

        // Get credentials
        const credentials = getInstanceCredentials(dbInstance);
        
        // Build connection config
        let connectionConfig: any = {
            id: dbInstance.id,
            name: dbInstance.name,
            type: 'postgresql',
            databases: []
        };

        if (credentials.connectionString) {
            // Parse connection string to get host/port
            const url = new URL(credentials.connectionString.replace('postgresql://', 'http://'));
            connectionConfig.host = url.hostname;
            connectionConfig.port = parseInt(url.port || '5432', 10);
            connectionConfig.user = url.username || credentials.user;
            connectionConfig.password = url.password || credentials.password;
        } else {
            connectionConfig.host = dbInstance.host;
            connectionConfig.port = dbInstance.port;
            connectionConfig.user = credentials.user;
            connectionConfig.password = credentials.password;
        }

        // 3. Get pool
        const pool = this.poolManager.getPgPool(instanceId, connectionConfig, databaseName);

        let client: PoolClient | null = null;
        const startTime = Date.now();

        try {
            client = await pool.connect();

            // 4. Set statement timeout
            await client.query(`SET statement_timeout = ${QUERY_CONFIG.statementTimeout}`);

            // 5. Start transaction (needed for read-only enforcement)
            await client.query('BEGIN');

            if (readOnly) {
                await client.query('SET TRANSACTION READ ONLY');
            }

            // 6. Execute query
            const result: QueryResult = await client.query(queryContent);

            // 7. Commit/Rollback
            // If read-only, we can rollback to be safe, but commit is fine too as it was SET READ ONLY
            // However, rolling back ensures no side effects if something slipped through
            // But if user meant to do a temp table, rollback kills it. 
            // Standard approach: Commit if success.
            await client.query('COMMIT');

            const duration = Date.now() - startTime;

            // 8. Process results
            // rowCount can be number or null/undefined
            const rowCount = result.rowCount === null || result.rowCount === undefined ? (Array.isArray(result.rows) ? result.rows.length : 0) : result.rowCount;

            // Truncate rows if needed
            let rows = result.rows;
            let truncated = false;

            if (rows.length > QUERY_CONFIG.maxRows) {
                rows = rows.slice(0, QUERY_CONFIG.maxRows);
                truncated = true;
            }

            return {
                success: true,
                rowCount,
                rows,
                fields: result.fields?.map(f => ({ name: f.name, dataType: f.dataTypeID })),
                duration,
                command: result.command,
                truncated,
                warnings: validation.warnings,
            };

        } catch (error) {
            if (client) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackError) {
                    logger.error('Failed to rollback transaction', { error: (rollbackError as Error).message });
                }
            }

            const err = error as Error & { code?: string; position?: string };
            const duration = Date.now() - startTime;

            logger.error('Postgres execution error', {
                error: err.message,
                code: err.code,
                instanceId,
                databaseName
            });

            throw new QueryExecutionError(err.message, {
                duration,
                code: err.code,
                position: err.position
            });
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    public validate(query: string): ValidationResult {
        const warnings: ValidationWarning[] = [];

        // Check query length
        if (query.length > QUERY_CONFIG.maxQueryLength) {
            throw new ValidationError(
                `Query exceeds maximum length of ${QUERY_CONFIG.maxQueryLength} characters`
            );
        }

        // Check for empty query
        if (!query || !query.trim()) {
            throw new ValidationError('Query cannot be empty');
        }

        // Check for dangerous patterns
        if (QUERY_CONFIG.warnOnDangerousQueries) {
            for (const { pattern, description } of DANGEROUS_SQL_PATTERNS) {
                if (pattern.test(query)) {
                    warnings.push({
                        type: 'dangerous_pattern',
                        description,
                        severity: 'warning',
                    });
                }
            }
        }

        return { valid: true, warnings };
    }

    public async testConnection(instance: any, databaseName: string): Promise<ConnectionTestResult> {
        try {
            const startTime = Date.now();
            const pool = this.poolManager.getPgPool(instance.id, {
                ...instance,
                host: instance.host!,
                port: instance.port!
            }, databaseName);

            // Execute simple query
            await pool.query('SELECT 1');

            const duration = Date.now() - startTime;
            return {
                success: true,
                latency: duration,
                message: 'Connection successful'
            };
        } catch (error) {
            const err = error as Error;
            return {
                success: false,
                latency: 0,
                message: 'Connection failed',
                error: err.message
            };
        }
    }

    public async disconnect(key?: string): Promise<void> {
        return this.poolManager.disconnect(key);
    }

    public getStats() {
        return this.poolManager.getStats();
    }
}
