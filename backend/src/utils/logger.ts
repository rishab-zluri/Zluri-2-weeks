/**
 * Logger Utility
 * Centralized logging with Winston
 */

import winston from 'winston';
// Config is still JavaScript, will be converted in Phase 3
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../config');

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 * Formats log messages with timestamp, level, message, and optional metadata
 */
/* istanbul ignore next */
const logFormat = printf((info) => {
    const { level, message, timestamp: ts, stack, ...meta } = info;
    let log = `${ts} [${level}]: ${message}`;

    // Append metadata if present (excluding known fields)
    const metaKeys = Object.keys(meta).filter(
        (key) => !['service'].includes(key)
    );
    if (metaKeys.length > 0) {
        const filteredMeta: Record<string, unknown> = {};
        metaKeys.forEach((key) => {
            filteredMeta[key] = meta[key];
        });
        log += ` ${JSON.stringify(filteredMeta)}`;
    }

    // Append stack trace if present
    if (stack) {
        log += `\n${stack}`;
    }

    return log;
});

/**
 * Create logger instance with production-ready configuration
 */
const logger = winston.createLogger({
    level: config.logging?.level || 'info',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    defaultMeta: { service: 'db-query-portal' },
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            ),
        }),
    ],
    // Don't exit on handled exceptions
    exitOnError: false,
});

/**
 * Add file transports in production
 * Logs are rotated at 5MB with 5 files kept
 */
if (config.isProduction) {
    logger.add(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
    logger.add(
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
}

/**
 * Morgan stream adapter
 * Used for HTTP request logging integration
 */
export const morganStream = {
    write: (message: string): void => {
        logger.http(message.trim());
    },
};

// Attach stream as property for legacy compatibility
// Using Object.defineProperty to avoid TypeScript interface conflicts
Object.defineProperty(logger, 'stream', {
    value: morganStream,
    writable: false,
    enumerable: true,
});

export default logger;
