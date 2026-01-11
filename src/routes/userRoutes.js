/**
 * User Management Routes
 * Admin-only routes for user management
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { success: successResponse, paginated: paginatedResponse } = require('../utils/response');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const { body, param, query, validationResult } = require('express-validator');
const { parsePagination } = require('../utils/validators');

// Validation rules
const validateUserUpdate = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('role').optional().isIn(['developer', 'manager', 'admin']).withMessage('Invalid role'),
  body('podId').optional().trim(),
  body('slackUserId').optional().trim(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filters
 * @access  Private/Admin
 */
router.get(
  '/',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { role, podId, search, isActive } = req.query;
    
    const filters = {};
    if (role) filters.role = role;
    if (podId) filters.podId = podId;
    if (search) filters.search = search;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const users = await User.findAll({ ...filters, limit, offset });
    const total = await User.count(filters);
    
    return paginatedResponse(res, users, { page, limit, total });
  })
);

/**
 * @route   GET /api/users/:id
 * @desc    Get a specific user by ID
 * @access  Private/Admin
 */
router.get(
  '/:id',
  authenticate,
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid user ID format'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return successResponse(res, user);
  })
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user
 * @access  Private/Admin
 */
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid user ID format'),
  validateUserUpdate,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { name, role, podId, slackUserId, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Prevent admin from deactivating themselves
    if (req.user.id === req.params.id && isActive === false) {
      throw new ValidationError('Cannot deactivate your own account');
    }
    
    const updateData = {};
    /* istanbul ignore next */
    if (name !== undefined) updateData.name = name;
    /* istanbul ignore next */
    if (role !== undefined) updateData.role = role;
    /* istanbul ignore next */
    if (podId !== undefined) updateData.podId = podId;
    /* istanbul ignore next */
    if (slackUserId !== undefined) updateData.slackUserId = slackUserId;
    /* istanbul ignore next */
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const updatedUser = await User.update(req.params.id, updateData);
    return successResponse(res, updatedUser, 'User updated successfully');
  })
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Soft delete a user (deactivate)
 * @access  Private/Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid user ID format'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      throw new ValidationError('Cannot delete your own account');
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    await User.softDelete(req.params.id);
    return successResponse(res, null, 'User deactivated successfully');
  })
);

/**
 * @route   POST /api/users/:id/activate
 * @desc    Reactivate a deactivated user
 * @access  Private/Admin
 */
router.post(
  '/:id/activate',
  authenticate,
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid user ID format'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    const updatedUser = await User.update(req.params.id, { isActive: true });
    return successResponse(res, updatedUser, 'User activated successfully');
  })
);

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset a user's password (generates temporary password)
 * @access  Private/Admin
 */
router.post(
  '/:id/reset-password',
  authenticate,
  requireRole('admin'),
  param('id').isUUID().withMessage('Invalid user ID format'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    await User.updatePassword(req.params.id, req.body.newPassword);
    return successResponse(res, null, 'Password reset successfully');
  })
);

module.exports = router;