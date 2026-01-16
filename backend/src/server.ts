/**
 * Server Entry Point
 *
 * Handles server startup, database connection (MikroORM),
 * background tasks, and graceful shutdown.
 */

import 'reflect-metadata'; // Required for MikroORM
import http from 'http';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import config from './config';
import app from './app';
import logger from './utils/logger';
import { initORM, closeORM, getORM, syncSchema } from './db';
import * as databaseSyncService from './services/databaseSyncService';
import { cleanupExpiredTokens } from './middleware/auth';
import { pool } from './config/database'; // Legacy pool to close if still used

let server: http.Server;
let tokenCleanupInterval: NodeJS.Timeout | null = null;

// =============================================================================
// Background Tasks
// =============================================================================

/**
 * Start background tasks
 */
const startBackgroundTasks = (): void => {
    // Start database sync scheduler
    databaseSyncService.startPeriodicSync();
    logger.info('Database sync scheduler started');

    // Schedule refresh token cleanup every hour
    tokenCleanupInterval = setInterval(async () => {
        try {
            const deletedCount = await cleanupExpiredTokens();
            if (deletedCount > 0) {
                logger.info(`Cleaned up ${deletedCount} expired refresh tokens`);
            }
        } catch (error) {
            logger.warn('Token cleanup failed:', (error as Error).message);
        }
    }, 60 * 60 * 1000); // Every hour

    logger.info('Background tasks started');
};

/**
 * Stop background tasks
 */
const stopBackgroundTasks = (): void => {
    databaseSyncService.stopPeriodicSync();
    logger.info('Database sync scheduler stopped');

    if (tokenCleanupInterval) {
        clearInterval(tokenCleanupInterval);
        tokenCleanupInterval = null;
        logger.info('Token cleanup scheduler stopped');
    }
};

// =============================================================================
// Shutdown Logic
// =============================================================================

/**
 * Guard to prevent multiple shutdown attempts
 * WHY: Ctrl+C can trigger multiple signals, and errors during shutdown
 * could trigger unhandledRejection which would call shutdown again
 */
let isShuttingDown = false;

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string) => {
    // Prevent multiple shutdown attempts (guard pattern)
    if (isShuttingDown) {
        logger.debug(`Shutdown already in progress, ignoring ${signal}`);
        return;
    }
    isShuttingDown = true;

    logger.info(`${signal} received. Starting graceful shutdown...`);

    // 1. Stop background tasks
    stopBackgroundTasks();

    // 2. Stop HTTP server (stop accepting new connections)
    if (server && server.listening) {
        try {
            await new Promise<void>((resolve) => {
                server.close((err) => {
                    if (err) {
                        // Don't reject - just log and continue
                        logger.warn('Error closing HTTP server (may already be closed):', err.message);
                    } else {
                        logger.info('HTTP server closed.');
                    }
                    resolve();
                });
            });
        } catch (err) {
            logger.warn('HTTP server close error:', (err as Error).message);
        }
    }

    // 3. Close Database Connections
    try {
        await closeORM();

        // Close Legacy Pool (if it exists/is open)
        await new Promise<void>((resolve) => {
            pool.end(() => {
                logger.info('Legacy database pool closed.');
                resolve();
            });
        });

    } catch (err) {
        logger.warn('Error closing database connections:', (err as Error).message);
    }

    logger.info('Graceful shutdown completed. Exiting.');
    process.exit(0);
};

// =============================================================================
// Server Startup
// =============================================================================

const startServer = async () => {
    try {
        // 1. Initialize MikroORM
        logger.info('Initializing MikroORM...');
        await initORM();

        // 2. Development-only: Sync schema from entities
        // NOTE: In production, use migrations instead: `npx mikro-orm migration:up`
        if (config.env === 'development') {
            try {
                logger.info('Development mode: Syncing database schema from entities...');
                await syncSchema();
                logger.info('Database schema synchronized successfully');
            } catch (schemaError) {
                logger.error('Schema sync failed:', schemaError);
                logger.warn('Run `npx mikro-orm schema:create --run` manually if needed');
                // Don't exit - the server can still start, just some features may not work
            }
        }

        // 3. Start HTTP Server
        const PORT = config.server.port;
        server = app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV}`);
            logger.info(`Manager Filter Fix Applied: ${new Date().toISOString()}`);
            console.log(`Server started at ${new Date().toISOString()} [RESTARTED]`); // Force restart
            logger.info(`Server running in ${config.env} mode on port ${PORT}`);
            logger.info(`Health check available at http://localhost:${PORT}/health`);
            logger.info(`API available at http://localhost:${PORT}/api/v1`);

            // 4. Start Background Tasks
            startBackgroundTasks();
        });

        // Error handling for server
        server.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use`);
            } else {
                logger.error('Server error:', error);
            }
            process.exit(1);
        });

        // Signal handlers
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Uncaught exceptions/rejections
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise);
            logger.error('Reason:', reason);
            // Don't call gracefulShutdown here - it can cause infinite loop
            // The shutdown guard will prevent re-entry anyway, but better to just log
            if (!isShuttingDown) {
                gracefulShutdown('unhandledRejection');
            }
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start execution
startServer();
