import { MongoClient, Collection, Document } from 'mongodb';
import {
    IDatabaseDriver,
    QueryRequest,
    ExecutionOptions,
    ExecutionResult,
    ValidationResult,
    ValidationWarning,
    ConnectionTestResult,
    ParsedMongoQuery,
    QueryConfig
} from '../interfaces';
import { ConnectionPool } from '../ConnectionPool';
import { getInstanceById } from '../../../config/staticData';
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

const DANGEROUS_MONGO_OPERATIONS: string[] = [
    'drop', 'dropDatabase', 'dropIndexes', 'dropIndex',
    'renameCollection', 'convertToCapped',
];

export class MongoDriver implements IDatabaseDriver {
    private poolManager: ConnectionPool;

    constructor() {
        this.poolManager = ConnectionPool.getInstance();
    }

    public async execute(request: QueryRequest, options?: ExecutionOptions): Promise<ExecutionResult> {
        const { instanceId, databaseName, queryContent } = request;

        // 1. Get connection config
        const instance = getInstanceById(instanceId);
        if (!instance) throw new ValidationError(`Instance ${instanceId} not found`);
        if (instance.type !== 'mongodb') throw new ValidationError(`Instance ${instanceId} is not a MongoDB instance`);

        // 2. Validate query / content
        const validation = this.validate(queryContent);
        // Warnings are collected, errors thrown in validate

        const startTime = Date.now();
        let client: MongoClient | null = null;

        try {
            // 3. Get client - pass uri for MongoDB instances
            client = await this.poolManager.getMongoClient(instanceId, {
                ...instance,
                uri: (instance as any).uri,
                host: (instance as any).host,
                port: (instance as any).port
            });

            const db = client.db(databaseName);

            // 4. Parse query
            const parsedQuery = this.parseMongoQuery(queryContent);

            let executionResult: unknown;
            let documentCount = 0;
            let truncated = false;

            if (parsedQuery.type === 'command') {
                // Execute raw command
                executionResult = await db.command(parsedQuery.command!);
                documentCount = 1;
            } else {
                // Execute collection operation
                if (!parsedQuery.collection) {
                    throw new ValidationError('Collection name required for operations');
                }

                // Check for dangerous operations again after parsing
                if (DANGEROUS_MONGO_OPERATIONS.includes(parsedQuery.method || '')) {
                    // If we are strict we might throw, but per req we warn
                    // already handled in validate()
                }

                const collection = db.collection(parsedQuery.collection);
                executionResult = await this.executeMongoOperation(collection, parsedQuery);

                if (Array.isArray(executionResult)) {
                    documentCount = executionResult.length;

                    // Check truncation
                    if (documentCount >= QUERY_CONFIG.maxRows) {
                        // We limited in executeMongoOperation, so if we hit maxRows, likely truncated
                        // or exactly maxRows.
                        // Actually the logic in executeMongoOperation handles the limit
                        // We can flag it if it equals maxRows to be safe
                        if (documentCount === QUERY_CONFIG.maxRows) {
                            truncated = true;
                        }
                    }
                } else if (executionResult && typeof executionResult === 'object' && 'acknowledged' in executionResult) {
                    // Write result, count depends on operation
                    if ('modifiedCount' in executionResult) documentCount = (executionResult as any).modifiedCount;
                    else if ('insertedCount' in executionResult) documentCount = (executionResult as any).insertedCount;
                    else if ('deletedCount' in executionResult) documentCount = (executionResult as any).deletedCount;
                    else documentCount = 1;
                } else {
                    documentCount = executionResult ? 1 : 0;
                }
            }

            const duration = Date.now() - startTime;

            return {
                success: true,
                result: executionResult,
                duration,
                documentCount,
                truncated,
                warnings: validation.warnings,
            };

        } catch (error) {
            // Re-throw custom errors
            if (error instanceof ValidationError || error instanceof QueryExecutionError) {
                throw error;
            }

            const err = error as Error & { code?: string; codeName?: string };
            const duration = Date.now() - startTime;

            logger.error('MongoDB query execution failed', {
                instanceId,
                databaseName,
                error: err.message,
                code: err.code,
            });

            throw new QueryExecutionError(`Query execution failed: ${err.message}`, {
                code: err.code,
                codeName: err.codeName,
            });
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

        // Pre-parse check for dangerous operations (simple regex/string match)
        // Since Mongo queries are often `db.collection.method`, check method name
        if (QUERY_CONFIG.warnOnDangerousQueries) {
            for (const op of DANGEROUS_MONGO_OPERATIONS) {
                if (query.includes(`.${op}(`)) {
                    warnings.push({
                        type: 'dangerous_operation',
                        description: `Dangerous MongoDB operation: ${op}`,
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
            const client = await this.poolManager.getMongoClient(instance.id, {
                ...instance,
                host: instance.host!,
                port: instance.port!
            });

            // Ping database
            await client.db(databaseName).command({ ping: 1 });

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

    // =========================================================================
    // Helpers
    // =========================================================================

    private async executeMongoOperation(collection: Collection<Document>, parsedQuery: ParsedMongoQuery): Promise<unknown> {
        const maxRows = QUERY_CONFIG.maxRows;

        switch (parsedQuery.method) {
            case 'find':
                return collection
                    .find(parsedQuery.query || {})
                    .limit(Math.min(parsedQuery.limit || maxRows, maxRows))
                    .toArray();

            case 'findOne':
                return collection.findOne(parsedQuery.query || {});

            case 'aggregate': {
                const pipeline = [...(parsedQuery.pipeline || [])];
                const hasOutputStage = pipeline.some(stage => stage.$out || stage.$merge);
                const hasLimitStage = pipeline.some(stage => stage.$limit);

                if (!hasOutputStage && !hasLimitStage) {
                    pipeline.push({ $limit: maxRows });
                }

                return collection.aggregate(pipeline).toArray();
            }

            case 'count':
            case 'countDocuments':
                return collection.countDocuments(parsedQuery.query || {});

            case 'estimatedDocumentCount':
                return collection.estimatedDocumentCount();

            case 'distinct':
                return collection.distinct(parsedQuery.field!, parsedQuery.query || {});

            case 'insertOne':
                return collection.insertOne(parsedQuery.document!);

            case 'insertMany':
                return collection.insertMany(parsedQuery.documents!);

            case 'updateOne':
                return collection.updateOne(parsedQuery.filter!, parsedQuery.update!, parsedQuery.options);

            case 'updateMany':
                return collection.updateMany(parsedQuery.filter!, parsedQuery.update!, parsedQuery.options);

            case 'deleteOne':
                return collection.deleteOne(parsedQuery.filter!);

            case 'deleteMany':
                return collection.deleteMany(parsedQuery.filter!);

            case 'findOneAndUpdate':
                return collection.findOneAndUpdate(
                    parsedQuery.filter!,
                    parsedQuery.update!,
                    parsedQuery.options || { returnDocument: 'after' }
                );

            case 'findOneAndDelete':
                return collection.findOneAndDelete(parsedQuery.filter!); // removed options as per original fallback

            default:
                throw new ValidationError(`Unsupported MongoDB method: ${parsedQuery.method}`);
        }
    }

    private parseMongoQuery(queryContent: string): ParsedMongoQuery {
        const trimmed = queryContent.trim();

        // Try to parse as JSON command first
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null) {
                return { type: 'command', command: parsed };
            }
        } catch (e) {
            // Not JSON, continue
        }

        // Match pattern: db.collection.method(...)
        const dotMatch = trimmed.match(/^db\.(\w+)\.(\w+)\(([\s\S]*)\)$/);
        if (dotMatch) {
            return this.parseMatchedQuery(dotMatch[1], dotMatch[2], dotMatch[3]);
        }

        // Match pattern: db["collection"].method(...)
        const bracketMatch = trimmed.match(/^db\["([^"]+)"\]\.(\w+)\(([\s\S]*)\)$/);
        if (bracketMatch) {
            return this.parseMatchedQuery(bracketMatch[1], bracketMatch[2], bracketMatch[3]);
        }

        // Match pattern: db['collection'].method(...)
        const singleQuoteMatch = trimmed.match(/^db\['([^']+)'\]\.(\w+)\(([\s\S]*)\)$/);
        if (singleQuoteMatch) {
            return this.parseMatchedQuery(singleQuoteMatch[1], singleQuoteMatch[2], singleQuoteMatch[3]);
        }

        throw new Error(
            'Query must be in format: db.collection.method(...) or valid JSON command'
        );
    }

    private parseMatchedQuery(collection: string, method: string, argsStr: string): ParsedMongoQuery {
        const result: ParsedMongoQuery = {
            type: 'operation',
            collection,
            method,
        };

        const args = argsStr.trim();

        if (!args) {
            return result;
        }

        try {
            const parsedArgs = this.parseArguments(args);

            switch (method) {
                case 'find':
                case 'findOne':
                    result.query = parsedArgs[0] as Record<string, unknown> || {};
                    if (parsedArgs[1]) {
                        result.projection = parsedArgs[1] as Record<string, unknown>;
                    }
                    break;

                case 'count':
                case 'countDocuments':
                case 'deleteOne':
                case 'deleteMany':
                    result.query = parsedArgs[0] as Record<string, unknown> || {};
                    result.filter = parsedArgs[0] as Record<string, unknown> || {};
                    break;

                case 'aggregate':
                    result.pipeline = parsedArgs[0] as Record<string, unknown>[] || [];
                    if (parsedArgs[1]) {
                        result.options = parsedArgs[1] as Record<string, unknown>;
                    }
                    break;

                case 'distinct':
                    result.field = parsedArgs[0] as string;
                    result.query = parsedArgs[1] as Record<string, unknown> || {};
                    break;

                case 'insertOne':
                    result.document = parsedArgs[0] as Record<string, unknown>;
                    break;

                case 'insertMany':
                    result.documents = parsedArgs[0] as Record<string, unknown>[];
                    break;

                case 'updateOne':
                case 'updateMany':
                    result.filter = parsedArgs[0] as Record<string, unknown> || {};
                    result.update = parsedArgs[1] as Record<string, unknown> || {};
                    if (parsedArgs[2]) {
                        result.options = parsedArgs[2] as Record<string, unknown>;
                    }
                    break;

                case 'findOneAndUpdate':
                case 'findOneAndDelete':
                    result.filter = parsedArgs[0] as Record<string, unknown> || {};
                    result.update = parsedArgs[1] as Record<string, unknown>;
                    if (parsedArgs[2]) {
                        result.options = parsedArgs[2] as Record<string, unknown>;
                    }
                    break;

                default:
                    result.args = parsedArgs;
            }
        } catch (e) {
            const err = e as Error;
            throw new Error(`Failed to parse query arguments: ${err.message}`);
        }

        return result;
    }

    private parseArguments(argsStr: string): unknown[] {
        try {
            return JSON.parse(`[${argsStr}]`);
        } catch (e) {
            try {
                return [JSON.parse(argsStr)];
            } catch (e2) {
                throw new Error('Arguments must be valid JSON');
            }
        }
    }
}
