/**
 * Authentication Routes
 * 
 * POST /api/auth/register        - Register new user
 * POST /api/auth/login           - Login, get tokens
 * POST /api/auth/logout          - Logout, revoke refresh token
 * POST /api/auth/logout-all      - Logout from all devices
 * POST /api/auth/refresh         - Refresh access token
 * GET  /api/auth/me              - Get current user
 * PUT  /api/auth/me              - Update profile
 * GET  /api/auth/sessions        - Get active sessions
 * DELETE /api/auth/sessions/:id  - Revoke a session
 * POST /api/auth/change-password - Change password
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @body    { email, password, name, podId }
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login and get tokens
 * @body    { email, password }
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and revoke refresh token
 * @body    { refreshToken }
 * @access  Public (needs refresh token in body)
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @body    { refreshToken }
 * @access  Public (needs valid refresh token)
 */
router.post('/refresh', authController.refreshToken);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Authenticated
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/me
 * @desc    Update current user profile
 * @body    { name, slackUserId }
 * @access  Authenticated
 */
router.put('/me', authenticate, authController.updateProfile);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices
 * @access  Authenticated
 */
router.post('/logout-all', authenticate, authController.logoutAll);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sessions for current user
 * @access  Authenticated
 */
router.get('/sessions', authenticate, authController.getSessions);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Authenticated
 */
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @body    { currentPassword, newPassword }
 * @access  Authenticated
 */
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;