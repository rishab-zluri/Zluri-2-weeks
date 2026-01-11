/**
 * Database Routes
 * 
 * API routes for database instances, databases, sync, and blacklist
 */

const express = require('express');
const router = express.Router();
const databaseController = require('../controllers/databaseController');

// ============================================================================
// MIDDLEWARE PLACEHOLDER
// ============================================================================
// Replace with your actual auth middleware
// const { authenticate, requireAdmin } = require('../middleware/auth');

// Temporary placeholder middleware (remove when you have real auth)
const authenticate = (req, res, next) => {
  // TODO: Replace with real authentication
  // For now, attach a mock user for development
  req.user = req.user || {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'developer@zluri.com',
    role: 'developer',
  };
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  next();
};

// ============================================================================
// INSTANCE ROUTES
// ============================================================================

/**
 * @route   GET /api/databases/instances
 * @desc    Get all database instances
 * @query   type - Filter by type (postgresql|mongodb)
 * @access  Authenticated
 */
router.get('/instances', authenticate, databaseController.getInstances);

/**
 * @route   GET /api/databases/instances/:instanceId
 * @desc    Get a single instance by ID
 * @access  Authenticated
 */
router.get('/instances/:instanceId', authenticate, databaseController.getInstanceById);

/**
 * @route   GET /api/databases/instances/:instanceId/databases
 * @desc    Get all databases for an instance (from cache - fast)
 * @access  Authenticated
 */
router.get('/instances/:instanceId/databases', authenticate, databaseController.getDatabases);

// ============================================================================
// SYNC ROUTES (Admin only)
// ============================================================================

/**
 * @route   POST /api/databases/instances/:instanceId/sync
 * @desc    Manually trigger sync for a specific instance
 * @access  Admin only
 */
router.post('/instances/:instanceId/sync', authenticate, requireAdmin, databaseController.syncInstance);

/**
 * @route   GET /api/databases/instances/:instanceId/sync-history
 * @desc    Get sync history for an instance
 * @query   limit - Number of records (default: 10, max: 100)
 * @access  Authenticated
 */
router.get('/instances/:instanceId/sync-history', authenticate, databaseController.getSyncHistory);

/**
 * @route   POST /api/databases/sync-all
 * @desc    Manually trigger sync for all instances
 * @access  Admin only
 */
router.post('/sync-all', authenticate, requireAdmin, databaseController.syncAll);

// ============================================================================
// BLACKLIST ROUTES (Admin only)
// ============================================================================

/**
 * @route   GET /api/databases/blacklist
 * @desc    Get all blacklist entries
 * @access  Authenticated
 */
router.get('/blacklist', authenticate, databaseController.getBlacklist);

/**
 * @route   POST /api/databases/blacklist
 * @desc    Add a pattern to blacklist
 * @body    { pattern, patternType, reason }
 * @access  Admin only
 */
router.post('/blacklist', authenticate, requireAdmin, databaseController.addToBlacklist);

/**
 * @route   DELETE /api/databases/blacklist/:id
 * @desc    Remove a pattern from blacklist
 * @access  Admin only
 */
router.delete('/blacklist/:id', authenticate, requireAdmin, databaseController.removeFromBlacklist);

module.exports = router;