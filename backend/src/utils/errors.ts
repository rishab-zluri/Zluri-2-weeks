/**
 * Custom Error Classes
 * Standardized error handling across the application
 */

/**
 * Error status type based on HTTP status code
 */
export type ErrorStatus = 'fail' | 'error';

/**
 * Standard error codes used across the application
 */
export type ErrorCode =
    | 'INTERNAL_ERROR'
    | 'VALIDATION_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'AUTHORIZATION_ERROR'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'RATE_LIMIT_EXCEEDED'
    | 'DATABASE_ERROR'
    | 'EXTERNAL_SERVICE_ERROR'
    | 'QUERY_EXECUTION_ERROR'
    | 'SCRIPT_EXECUTION_ERROR';

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
    field?: string;
    message: string;
    value?: unknown;
}

/**
 * Base Application Error
 * All custom errors extend this class
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: ErrorCode;
    public readonly status: ErrorStatus;
    public readonly isOperational: boolean = true;

    constructor(
        message: string,
        statusCode: number = 500,
        code: ErrorCode = 'INTERNAL_ERROR'
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);

        // Set prototype explicitly for proper instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Validation Error - 400
 * Used for request validation failures
 */
export class ValidationError extends AppError {
    public readonly errors: ValidationErrorDetail[];

    constructor(
        message: string = 'Validation failed',
        errors: ValidationErrorDetail[] = []
    ) {
        super(message, 400, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

/**
 * Authentication Error - 401
 * Used when user is not authenticated
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

/**
 * Authorization Error - 403
 * Used when user lacks permission
 */
export class AuthorizationError extends AppError {
    constructor(message: string = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

/**
 * Not Found Error - 404
 * Used when resource doesn't exist
 */
export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

/**
 * Conflict Error - 409
 * Used for duplicate resources or state conflicts
 */
export class ConflictError extends AppError {
    constructor(message: string = 'Resource conflict') {
        super(message, 409, 'CONFLICT');
    }
}

/**
 * Rate Limit Error - 429
 * Used when rate limit is exceeded
 */
export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

/**
 * Database Error - 500
 * Used for database operation failures
 */
export class DatabaseError extends AppError {
    constructor(message: string = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR');
    }
}

/**
 * External Service Error - 502
 * Used when an external service fails
 */
export class ExternalServiceError extends AppError {
    public readonly service: string;

    constructor(
        message: string = 'External service error',
        service: string = 'unknown'
    ) {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
    }
}

/**
 * Query Execution Error - 500
 * Used when a database query fails to execute
 */
export class QueryExecutionError extends AppError {
    public readonly details: unknown;

    constructor(
        message: string = 'Query execution failed',
        details: unknown = null
    ) {
        super(message, 500, 'QUERY_EXECUTION_ERROR');
        this.details = details;
    }
}

/**
 * Script Execution Error - 500
 * Used when a script fails to execute
 */
export class ScriptExecutionError extends AppError {
    public readonly details: unknown;

    constructor(
        message: string = 'Script execution failed',
        details: unknown = null
    ) {
        super(message, 500, 'SCRIPT_EXECUTION_ERROR');
        this.details = details;
    }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Type guard to check if an error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
    return isAppError(error) && error.isOperational;
}
