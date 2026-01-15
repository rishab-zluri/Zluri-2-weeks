/**
 * Error Handling Middleware
 * Global error handler for all routes
 */

import { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import config from '../config';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';

// ============================================================================
// Types
// ============================================================================

/**
 * Error response for development environment
 */
interface DevErrorResponse {
    success: false;
    message: string;
    code: string;
    error: Error;
    stack?: string;
}

/**
 * Error response for production environment
 */
interface ProdErrorResponse {
    success: false;
    message: string;
    code: string;
    errors?: unknown[];
}

/**
 * Extended error with potential additional fields
 */
interface ExtendedError extends Error {
    statusCode?: number;
    code?: string;
    status?: string;
    isOperational?: boolean;
    errors?: unknown[];
    path?: string;
    value?: unknown;
}

// ============================================================================
// 404 Not Found Handler
// ============================================================================

/**
 * Handle 404 Not Found
 */
export const notFound: RequestHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        code: 'NOT_FOUND',
    });
};

// Alias for backward compatibility
export const notFoundHandler = notFound;

// ============================================================================
// Async Handler Wrapper
// ============================================================================

/**
 * Handle async errors in routes
 * Wraps async route handlers to catch errors and pass to error handler
 */
export function asyncHandler<T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req as T, res, next)).catch(next);
    };
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Development error response with full details
 */
/* istanbul ignore next */
function sendErrorDev(err: ExtendedError, res: Response): void {
    const response: DevErrorResponse = {
        success: false,
        message: err.message,
        code: err.code || 'INTERNAL_ERROR',
        error: err,
        stack: err.stack,
    };
    res.status(err.statusCode || 500).json(response);
}

/**
 * Production error response with minimal details
 */
function sendErrorProd(err: ExtendedError, res: Response): void {
    // Operational error: send message to client
    if (err.isOperational) {
        const response: ProdErrorResponse = {
            success: false,
            message: err.message,
            code: err.code || 'INTERNAL_ERROR',
            ...(err.errors && { errors: err.errors }),
        };
        res.status(err.statusCode || 500).json(response);
    } else {
        // Programming or unknown error: don't leak details
        logger.error('Unexpected error', { error: err });
        res.status(500).json({
            success: false,
            message: 'Something went wrong',
            code: 'INTERNAL_ERROR',
        });
    }
}

// ============================================================================
// Specific Error Handlers
// ============================================================================

/**
 * Handle MongoDB/PostgreSQL cast errors
 */
function handleCastError(err: ExtendedError): AppError {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400, 'VALIDATION_ERROR');
}

/**
 * Handle duplicate key errors (PostgreSQL code 23505)
 */
function handleDuplicateKeyError(err: ExtendedError): AppError {
    const value = err.message.match(/(["'])(\\?.)*?\1/)?.[0];
    const message = `Duplicate field value: ${value}. Please use another value.`;
    return new AppError(message, 409, 'CONFLICT');
}

/**
 * Handle validation errors
 */
function handleValidationError(err: ExtendedError): AppError {
    let errorMessages: string[] = [];
    if (err.errors && typeof err.errors === 'object' && !Array.isArray(err.errors)) {
        const errorsObj = err.errors as unknown as Record<string, { message?: string }>;
        errorMessages = Object.values(errorsObj)
            .map((el) => el?.message)
            .filter((msg): msg is string => typeof msg === 'string');
    }
    const message = errorMessages.length > 0
        ? `Invalid input data: ${errorMessages.join('. ')}`
        : 'Invalid input data';
    return new AppError(message, 400, 'VALIDATION_ERROR');
}

/**
 * Handle JWT errors
 */
function handleJWTError(): AppError {
    return new AppError('Invalid token. Please log in again.', 401, 'AUTHENTICATION_ERROR');
}

/**
 * Handle JWT expired errors
 */
function handleJWTExpiredError(): AppError {
    return new AppError('Your token has expired. Please log in again.', 401, 'AUTHENTICATION_ERROR');
}

// ============================================================================
// Global Error Handler
// ============================================================================

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
    err: ExtendedError,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    err.statusCode = err.statusCode || 500;
    err.code = err.code || 'INTERNAL_ERROR';

    // Log error
    if (err.statusCode >= 500) {
        logger.error('Server error', {
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            body: req.body,
            user: req.user?.id,
        });
    } else {
        logger.warn('Client error', {
            error: err.message,
            path: req.path,
            method: req.method,
            statusCode: err.statusCode,
        });
    }

    if (config.isDevelopment || config.isTest) {
        sendErrorDev(err, res);
    } else {
        let error: ExtendedError = { ...err, message: err.message };

        // Handle specific error types
        if (err.name === 'CastError') error = handleCastError(err);
        if (err.code === '23505') error = handleDuplicateKeyError(err);
        if (err.name === 'ValidationError') error = handleValidationError(err);
        if (err.name === 'JsonWebTokenError') error = handleJWTError();
        if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error, res);
    }
};

// Alias for backward compatibility
export const globalErrorHandler = errorHandler;

// ============================================================================
// Default Export
// ============================================================================

export default {
    notFound,
    notFoundHandler,
    asyncHandler,
    errorHandler,
    globalErrorHandler,
};
