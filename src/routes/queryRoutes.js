/**
 * Query Routes
 * Handles query/script submissions, approvals, and request management
 */
const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');
const { authenticate, requireRole, requireManagerOfPod } = require('../middleware/auth');
const { validate, queryRequestValidations } = require('../middleware/validation');
const { handleScriptUpload } = require('../middleware/upload');

// ==================== Metadata Routes ====================
/**
 * @route   GET /api/queries/instances
 * @desc    Get all database instances (optionally filtered by type)
 * @access  Private
 */
router.get('/instances', authenticate, queryController.getInstances);

/**
 * @route   GET /api/queries/instances/:instanceId/databases
 * @desc    Get databases for a specific instance
 * @access  Private
 */
router.get('/instances/:instanceId/databases', authenticate, queryController.getDatabases);

/**
 * @route   GET /api/queries/pods
 * @desc    Get all PODs
 * @access  Private
 */
router.get('/pods', authenticate, queryController.getPods);

// ==================== Submission Routes ====================
/**
 * @route   POST /api/queries/submit
 * @desc    Submit a new query request
 * @access  Private
 */
router.post(
  '/submit',
  authenticate,
  queryRequestValidations.create,
  validate,
  queryController.submitRequest
);

/**
 * @route   POST /api/queries/submit-script
 * @desc    Submit a new script execution request
 * @access  Private
 */
router.post(
  '/submit-script',
  authenticate,
  handleScriptUpload,
  queryRequestValidations.create,
  validate,
  queryController.submitRequest
);

// ==================== User Request Routes ====================
/**
 * @route   GET /api/queries/my-requests
 * @desc    Get current user's query requests
 * @access  Private
 */
router.get('/my-requests', authenticate, queryController.getMyRequests);

/**
 * @route   GET /api/queries/my-status-counts
 * @desc    Get count of requests by status for current user
 * @access  Private
 */
router.get('/my-status-counts', authenticate, queryController.getMyStatusCounts);

/**
 * @route   GET /api/queries/requests/:uuid
 * @desc    Get a specific query request by UUID
 * @access  Private
 */
router.get('/requests/:uuid', authenticate, queryController.getRequest);

/**
 * @route   POST /api/queries/requests/:uuid/clone
 * @desc    Clone and resubmit a previous request
 * @access  Private
 */
router.post('/requests/:uuid/clone', authenticate, queryController.cloneRequest);

// ==================== Approval Routes (Manager/Admin) ====================
/**
 * @route   GET /api/queries/pending
 * @desc    Get pending requests for approval (managers see their PODs)
 * @access  Private/Manager,Admin
 */
router.get(
  '/pending',
  authenticate,
  requireRole('manager', 'admin'),
  queryController.getPendingRequests
);

/**
 * @route   POST /api/queries/requests/:uuid/approve
 * @desc    Approve a query request
 * @access  Private/Manager,Admin
 */
router.post(
  '/requests/:uuid/approve',
  authenticate,
  requireRole('manager', 'admin'),
  queryRequestValidations.approve,
  validate,
  queryController.approveRequest
);

/**
 * @route   POST /api/queries/requests/:uuid/reject
 * @desc    Reject a query request
 * @access  Private/Manager,Admin
 */
router.post(
  '/requests/:uuid/reject',
  authenticate,
  requireRole('manager', 'admin'),
  queryRequestValidations.reject,
  validate,
  queryController.rejectRequest
);

// ==================== Admin Routes ====================
/**
 * @route   GET /api/queries/stats
 * @desc    Get query statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  '/stats',
  authenticate,
  requireRole('admin'),
  queryController.getStats
);

/**
 * @route   GET /api/queries/all
 * @desc    Get all query requests (admin only)
 * @access  Private/Admin
 */
router.get(
  '/all',
  authenticate,
  requireRole('admin'),
  queryController.getAllRequests
);

module.exports = router;