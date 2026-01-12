/**
 * Authentication Routes
 * Handles user authentication, registration, and profile management
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, authValidations, userValidations } = require('../middleware/validation');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Admin only)
 * @access  Private/Admin
 */
router.post(
  '/register',
  authenticate,
  requireRole('admin'),
  authValidations.register,
  validate,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT tokens
 * @access  Public
 */
router.post(
  '/login',
  authValidations.login,
  validate,
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * @route   PUT /api/auth/password
 * @desc    Change current user's password
 * @access  Private
 */
router.put(
  '/password',
  authenticate,
  userValidations.changePassword,
  validate,
  authController.changePassword
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token on client side)
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

module.exports = router;