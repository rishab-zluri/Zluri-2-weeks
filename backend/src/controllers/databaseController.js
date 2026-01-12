    /**
 * Database Controller
 * 
 * API endpoints for managing database instances and databases
 * Supports the hybrid approach with cached data + manual refresh
 */

const databaseSyncService = require('../services/databaseSyncService');
const logger = require('../utils/logger');

// ============================================================================
// INSTANCES ENDPOINTS
// ============================================================================

/**
 * Get all database instances
 * GET /api/databases/instances
 * Query params: ?type=postgresql|mongodb
 */
const getInstances = async (req, res, next) => {
  try {
    const { type } = req.query;

    // Validate type if provided
    if (type && !['postgresql', 'mongodb'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be "postgresql" or "mongodb"',
      });
    }

    const instances = await databaseSyncService.getInstances(type);

    res.json({
      success: true,
      data: instances,
      count: instances.length,
    });
  } catch (error) {
    logger.error('Error fetching instances', { error: error.message });
    next(error);
  }
};

/**
 * Get a single instance by ID
 * GET /api/databases/instances/:instanceId
 */
const getInstanceById = async (req, res, next) => {
  try {
    const { instanceId } = req.params;

    const instance = await databaseSyncService.getInstanceById(instanceId);

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
    }

    res.json({
      success: true,
      data: instance,
    });
  } catch (error) {
    logger.error('Error fetching instance', { instanceId: req.params.instanceId, error: error.message });
    next(error);
  }
};

// ============================================================================
// DATABASES ENDPOINTS
// ============================================================================

/**
 * Get databases for an instance (from cached table - FAST)
 * GET /api/databases/instances/:instanceId/databases
 * 
 * Response time: ~5-10ms (local query)
 */
const getDatabases = async (req, res, next) => {
  try {
    const { instanceId } = req.params;

    // Verify instance exists
    const instance = await databaseSyncService.getInstanceById(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
    }

    const databases = await databaseSyncService.getDatabasesForInstance(instanceId);

    res.json({
      success: true,
      data: databases,
      count: databases.length,
      source: 'cache',
      lastSync: instance.last_sync_at,
      syncStatus: instance.last_sync_status,
    });
  } catch (error) {
    logger.error('Error fetching databases', { instanceId: req.params.instanceId, error: error.message });
    next(error);
  }
};

// ============================================================================
// SYNC ENDPOINTS
// ============================================================================

/**
 * Manually refresh databases for an instance
 * POST /api/databases/instances/:instanceId/sync
 * 
 * Admin only - triggers immediate sync from actual instance
 */
const syncInstance = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const userId = req.user?.id;

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can trigger database sync',
      });
    }

    // Get instance
    const instance = await databaseSyncService.getInstanceById(instanceId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
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
    logger.error('Error syncing instance', { instanceId: req.params.instanceId, error: error.message });
    next(error);
  }
};

/**
 * Sync all instances
 * POST /api/databases/sync-all
 * 
 * Admin only - triggers sync for all active instances
 */
const syncAll = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can trigger database sync',
      });
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
    logger.error('Error syncing all instances', { error: error.message });
    next(error);
  }
};

/**
 * Get sync history for an instance
 * GET /api/databases/instances/:instanceId/sync-history
 */
const getSyncHistory = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);

    const history = await databaseSyncService.getSyncHistory(instanceId, limit);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    logger.error('Error fetching sync history', { instanceId: req.params.instanceId, error: error.message });
    next(error);
  }
};

// ============================================================================
// BLACKLIST ENDPOINTS
// ============================================================================

/**
 * Get blacklist entries
 * GET /api/databases/blacklist
 */
const getBlacklist = async (req, res, next) => {
  try {
    const entries = await databaseSyncService.getBlacklistEntries();

    res.json({
      success: true,
      data: entries,
      count: entries.length,
    });
  } catch (error) {
    logger.error('Error fetching blacklist', { error: error.message });
    next(error);
  }
};

/**
 * Add to blacklist
 * POST /api/databases/blacklist
 * Body: { pattern, patternType, reason }
 */
const addToBlacklist = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can manage blacklist',
      });
    }

    const { pattern, patternType = 'exact', reason } = req.body;

    if (!pattern) {
      return res.status(400).json({
        success: false,
        error: 'Pattern is required',
      });
    }

    if (!['exact', 'prefix', 'regex'].includes(patternType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid patternType. Must be "exact", "prefix", or "regex"',
      });
    }

    const entry = await databaseSyncService.addToBlacklist(
      pattern,
      patternType,
      reason,
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
    logger.error('Error adding to blacklist', { error: error.message });
    next(error);
  }
};

/**
 * Remove from blacklist
 * DELETE /api/databases/blacklist/:id
 */
const removeFromBlacklist = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can manage blacklist',
      });
    }

    const { id } = req.params;
    const removed = await databaseSyncService.removeFromBlacklist(id);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Blacklist entry not found',
      });
    }

    logger.info('Blacklist entry removed', { id, removedBy: req.user?.email });

    res.json({
      success: true,
      message: 'Pattern removed from blacklist',
    });
  } catch (error) {
    logger.error('Error removing from blacklist', { error: error.message });
    next(error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Instances
  getInstances,
  getInstanceById,
  
  // Databases
  getDatabases,
  
  // Sync
  syncInstance,
  syncAll,
  getSyncHistory,
  
  // Blacklist
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
};