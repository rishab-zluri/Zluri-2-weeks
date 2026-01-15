/**
 * Script Service Interfaces
 */

export interface ExecutionConfig {
    timeout: number;
    memoryLimit: number;
}

export interface SyntaxErrorDetails {
    type: 'SyntaxError';
    message: string;
    line: number | null;
    details: string;
}

export interface SyntaxValidationResult {
    valid: boolean;
    error?: SyntaxErrorDetails;
}

export interface ScriptQueryRequest {
    scriptContent: string;
    databaseType: 'postgresql' | 'mongodb';
    instanceId: string;
    databaseName: string;
}

export interface OutputItem {
    type: 'info' | 'error' | 'warn' | 'query' | 'operation' | 'log' | 'data' | 'result';
    message?: string;
    timestamp: string;
    [key: string]: unknown;
}

export interface ExecutionSummary {
    totalQueries: number;
    totalOperations: number;
    rowsReturned: number;
    rowsAffected: number;
    documentsProcessed: number;
    errors: number;
    warnings: number;
}

export interface ScriptError {
    type: string;
    message: string;
    line?: number | null;
}

export interface ExecutionMetadata {
    databaseType: string;
    databaseName: string;
    instanceId: string;
    executedAt: string;
}

export interface ScriptExecutionResult {
    success: boolean;
    result?: unknown;
    error?: ScriptError;
    output: OutputItem[];
    summary?: ExecutionSummary;
    duration: number;
    metadata: ExecutionMetadata;
}

export interface ScriptValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
}

/**
 * Worker specific config
 */
export interface WorkerConfig {
    scriptContent: string;
    databaseType: 'postgresql' | 'mongodb';
    instance: any; // We use strict types inside worker, but here generic is fine as it comes from config
    databaseName: string;
    timeout: number;
}

export interface ChildProcessResult {
    success: boolean;
    result?: unknown;
    error?: ScriptError;
    output?: OutputItem[];
}

/**
 * Command Pattern Interface
 */
export interface ScriptCommand {
    execute(): Promise<ScriptExecutionResult>;
}
