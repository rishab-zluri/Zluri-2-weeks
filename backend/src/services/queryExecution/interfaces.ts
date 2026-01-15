import { DatabaseInstance } from '../../config/staticData';

// Re-export specific types if needed by consumers who import from the index
export interface QueryConfig {
    statementTimeout: number;
    maxRows: number;
    maxQueryLength: number;
    warnOnDangerousQueries: boolean;
    defaultReadOnly: boolean;
}

export interface DangerousPattern {
    pattern: RegExp;
    description: string;
}

export interface ValidationResult {
    valid: boolean;
    warnings: ValidationWarning[];
}

export interface ValidationWarning {
    type: string;
    description: string;
    severity: 'warning' | 'error';
}

export interface QueryRequest {
    databaseType: 'postgresql' | 'mongodb';
    instanceId: string;
    databaseName: string;
    queryContent: string;
    userId?: string;
    requestId?: string | number;
}

export interface ExecutionOptions {
    readOnly?: boolean;
}

export interface PostgresExecutionResult {
    success: boolean;
    rowCount: number | null;
    rows: Record<string, unknown>[];
    fields?: Array<{ name: string; dataType: number }>;
    duration: number;
    command?: string;
    truncated: boolean;
    warnings: ValidationWarning[];
}

export interface MongoExecutionResult {
    success: boolean;
    result: unknown;
    duration: number;
    documentCount: number;
    truncated: boolean;
    warnings: ValidationWarning[];
}

export type ExecutionResult = PostgresExecutionResult | MongoExecutionResult;

export interface ConnectionTestResult {
    success: boolean;
    latency: number;
    message: string;
    error?: string;
}

export interface PoolStats {
    postgresql: Record<string, { totalCount: number; idleCount: number; waitingCount: number }>;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    mongodb: Record<string, { connected: boolean }>;
    connected: boolean;
}

export interface ParsedMongoQuery {
    type: 'command' | 'operation';
    command?: Record<string, unknown>;
    collection?: string;
    method?: string;
    query?: Record<string, unknown>;
    filter?: Record<string, unknown>;
    projection?: Record<string, unknown>;
    pipeline?: Record<string, unknown>[];
    options?: Record<string, unknown>;
    field?: string;
    document?: Record<string, unknown>;
    documents?: Record<string, unknown>[];
    update?: Record<string, unknown>;
    limit?: number;
    args?: unknown[];
}

/**
 * Strategy Interface for Database Drivers
 */
export interface IDatabaseDriver {
    /**
     * Execute a query against the database
     */
    execute(request: QueryRequest, options?: ExecutionOptions): Promise<ExecutionResult>;

    /**
     * Validate a query string for dangerous patterns or syntax
     */
    validate(query: string): ValidationResult;

    /**
     * Test connection to the database instance
     */
    testConnection(instance: DatabaseInstance, databaseName: string): Promise<ConnectionTestResult>;

    /**
     * Disconnect/cleanup resources for a specific key or all
     */
    disconnect(key?: string): Promise<void>;

    /**
     * Get pool statistics
     */
    getStats(): any;
}
