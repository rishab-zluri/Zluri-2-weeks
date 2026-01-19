/**
 * Database Controller
 *
 * API endpoints for managing database instances and databases
 * Supports the hybrid approach with cached data + manual refresh
 *
 * ARCHITECTURE:
 * - Admin-focused endpoints for sync management
 * - Public/Dev endpoints for listing available databases
 * - Integrates with databaseSyncService for heavy lifting
 *
 * SECURITY:
 * - Sync operations limited to admins
 * - Blacklist management limited to admins
 * - Read operations available to authenticated users
 */

import { Request, Response, NextFunction } from 'express';
import * as databaseSyncService from '../services/databaseSyncService';
import logger from '../utils/logger';
import { UserRole } from '../entities/User';

// =============================================================================
// TYPES
// =============================================================================

interface InstancesQuery {
    type?: 'postgresql' | 'mongodb';
}

interface BlacklistBody {
    pattern: string;
    patternType?: 'exact' | 'prefix' | 'regex';
    reason?: string;
}

// =============================================================================
// INSTANCES ENDPOINTS
// =============================================================================

/**
 * Get all database instances
 * GET /api/databases/instances
 * Query params: ?type=postgresql|mongodb
 *
 * WHY: List available database servers (instances)
 */
export const getInstances = async (req: Request<unknown, unknown, unknown, InstancesQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { type } = req.query;

        // Validate type if provided
        if (type && !['postgresql', 'mongodb'].includes(type)) {
            res.status(400).json({
                success: false,
                error: 'Invalid type. Must be "postgresql" or "mongodb"',
            });
            return;
        }

        const instances = await databaseSyncService.getInstances(type);

        res.json({
            success: true,
            data: instances,
            count: instances.length,
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error fetching instances', { error: err.message });
        next(error);
    }
};

/**
 * Get a single instance by ID
 * GET /api/databases/instances/:instanceId
 *
 * WHY: Get details of a specific database server
 */
export const getInstanceById = async (req: Request<{ instanceId: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { instanceId } = req.params;

        const instance = await databaseSyncService.getInstanceById(instanceId);

        if (!instance) {
            res.status(404).json({
                success: false,
                error: 'Instance not found',
            });
            return;
        }

        res.json({
            success: true,
            data: instance,
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error fetching instance', { instanceId: req.params.instanceId, error: err.message });
        next(error);
    }
};

// =============================================================================
// DATABASES ENDPOINTS
// =============================================================================

/**
 * Get databases for an instance (from cached table - FAST)
 * GET /api/databases/instances/:instanceId/databases
 *
 * Response time: ~5-10ms (local query)
 *
 * WHY: Fast lookups for UI dropdowns without connecting to remote DBs every time
 */
export const getDatabases = async (req: Request<{ instanceId: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { instanceId } = req.params;

        // First try sync service (database-backed)
        const instance = await databaseSyncService.getInstanceById(instanceId);

        if (instance) {
            // Instance found in database - use sync service
            const databases = await databaseSyncService.getDatabasesForInstance(instanceId);

            res.json({
                success: true,
                data: databases,
                count: databases.length,
                source: 'cache',
                lastSync: instance.last_sync_at,
                syncStatus: instance.last_sync_status,
            });
            return;
        }

        // Fallback to static config for instances not yet synced to database
        const staticData = require('../config/staticData');
        const staticInstance = staticData.getInstanceById(instanceId);

        if (!staticInstance) {
            res.status(404).json({
                success: false,
                error: 'Instance not found',
            });
            return;
        }

        // Return databases from static config
        const databases = staticData.getDatabasesForInstance(instanceId).sort();
        res.json({
            success: true,
            data: databases.map((name: string) => ({ name, source: 'static' })),
            count: databases.length,
            source: 'static',
            lastSync: null,
            syncStatus: 'not_synced',
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error fetching databases', { instanceId: req.params.instanceId, error: err.message });
        next(error);
    }
};

// =============================================================================
// SYNC ENDPOINTS
// =============================================================================

/**
 * Manually refresh databases for an instance
 * POST /api/databases/instances/:instanceId/sync
 *
 * Admin only - triggers immediate sync from actual instance
 *
 * WHY: Force update when new databases are added but auto-sync hasn't run yet
 */
export const syncInstance = async (req: Request<{ instanceId: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { instanceId } = req.params;
        const userId = req.user?.id;

        // Check if user is admin
        if (req.user?.role !== UserRole.ADMIN) {
            res.status(403).json({
                success: false,
                error: 'Only admins can trigger database sync',
            });
            return;
        }

        // Get instance
        const instance = await databaseSyncService.getInstanceById(instanceId);
        if (!instance) {
            res.status(404).json({
                success: false,
                error: 'Instance not found',
            });
            return;
        }

        logger.info('Manual sync triggered', {
            instanceId,
            triggeredBy: req.user?.email
        });

        // Perform sync
        const result = await databaseSyncService.syncInstanceDatabases(instance, {
            triggeredBy: userId,
            syncType: 'manual',
        });

        if (result.success) {
            res.json({
                success: true,
                message: 'Database sync completed successfully',
                data: {
                    databasesFound: result.databasesFound,
                    databasesAdded: result.databasesAdded,
                    databasesDeactivated: result.databasesDeactivated,
                    duration: result.duration,
                },
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Sync failed',
                message: result.error,
                data: {
                    duration: result.duration,
                },
            });
        }
    } catch (error) {
        const err = error as Error;
        logger.error('Error syncing instance', { instanceId: req.params.instanceId, error: err.message });
        next(error);
    }
};

/**
 * Sync all instances
 * POST /api/databases/sync-all
 *
 * Admin only - triggers sync for all active instances
 *
 * WHY: Mass update of all database metadata
 */
export const syncAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id;

        // Check if user is admin
        if (req.user?.role !== UserRole.ADMIN) {
            res.status(403).json({
                success: false,
                error: 'Only admins can trigger database sync',
            });
            return;
        }

        logger.info('Full sync triggered', { triggeredBy: req.user?.email });

        // Perform sync
        const results = await databaseSyncService.syncAllDatabases({
            triggeredBy: userId,
            syncType: 'manual',
        });

        res.json({
            success: true,
            message: `Synced ${results.successful}/${results.total} instances`,
            data: {
                total: results.total,
                successful: results.successful,
                failed: results.failed,
                details: results.details.map(d => ({
                    instanceId: d.instanceId,
                    success: d.success,
                    databasesFound: d.databasesFound,
                    databasesAdded: d.databasesAdded,
                    error: d.error,
                })),
            },
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error syncing all instances', { error: err.message });
        next(error);
    }
};

/**
 * Get sync history for an instance
 * GET /api/databases/instances/:instanceId/sync-history
 *
 * WHY: Audit trail of sync operations
 */
export const getSyncHistory = async (req: Request<{ instanceId: string }, unknown, unknown, { limit?: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { instanceId } = req.params;
        const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);

        const history = await databaseSyncService.getSyncHistory(instanceId, limit);

        res.json({
            success: true,
            data: history,
            count: history.length,
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error fetching sync history', { instanceId: req.params.instanceId, error: err.message });
        next(error);
    }
};

// =============================================================================
// BLACKLIST ENDPOINTS
// =============================================================================

/**
 * Get blacklist entries
 * GET /api/databases/blacklist
 *
 * WHY: View excluded databases
 */
export const getBlacklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const entries = await databaseSyncService.getBlacklistEntries();

        res.json({
            success: true,
            data: entries,
            count: entries.length,
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error fetching blacklist', { error: err.message });
        next(error);
    }
};

/**
 * Add to blacklist
 * POST /api/databases/blacklist
 * Body: { pattern, patternType, reason }
 *
 * Admin only
 *
 * WHY: Prevent specific databases from being synced/accessed
 */
export const addToBlacklist = async (req: Request<unknown, unknown, BlacklistBody>, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Check if user is admin
        if (req.user?.role !== UserRole.ADMIN) {
            res.status(403).json({
                success: false,
                error: 'Only admins can manage blacklist',
            });
            return;
        }

        const { pattern, patternType = 'exact', reason } = req.body;

        if (!pattern) {
            res.status(400).json({
                success: false,
                error: 'Pattern is required',
            });
            return;
        }

        if (!['exact', 'prefix', 'regex'].includes(patternType)) {
            res.status(400).json({
                success: false,
                error: 'Invalid patternType. Must be "exact", "prefix", or "regex"',
            });
            return;
        }

        const entry = await databaseSyncService.addToBlacklist(
            pattern as string,
            patternType,
            reason || '',
            req.user?.id
        );

        logger.info('Blacklist entry added', {
            pattern,
            patternType,
            addedBy: req.user?.email
        });

        res.status(201).json({
            success: true,
            message: 'Pattern added to blacklist',
            data: entry,
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error adding to blacklist', { error: err.message });
        next(error);
    }
};

/**
 * Remove from blacklist
 * DELETE /api/databases/blacklist/:id
 *
 * Admin only
 *
 * WHY: Restore access to previously blacklisted databases
 */
export const removeFromBlacklist = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Check if user is admin
        if (req.user?.role !== UserRole.ADMIN) {
            res.status(403).json({
                success: false,
                error: 'Only admins can manage blacklist',
            });
            return;
        }

        const { id } = req.params;
        const removed = await databaseSyncService.removeFromBlacklist(parseInt(id, 10));

        if (!removed) {
            res.status(404).json({
                success: false,
                error: 'Blacklist entry not found',
            });
            return;
        }

        logger.info('Blacklist entry removed', { id, removedBy: req.user?.email });

        res.json({
            success: true,
            message: 'Pattern removed from blacklist',
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error removing from blacklist', { error: err.message });
        next(error);
    }
};

export default {
    getInstances,
    getInstanceById,
    getDatabases,
    syncInstance,
    syncAll,
    getSyncHistory,
    getBlacklist,
    addToBlacklist,
    removeFromBlacklist,
};
