/**
 * Authentication Routes
 * Handles user authentication, registration, and profile management
 *
 * ARCHITECTURE:
 * - Routes layer: definitions only
 * - Delegates validation to Zod schemas (src/validation/)
 * - Delegates logic to controllers/authController
 * - Protected routes use middleware/auth
 *
 * VALIDATION STRATEGY:
 * - Using Zod for runtime validation with TypeScript type inference
 * - Schemas defined in src/validation/authSchemas.ts
 * - Middleware in src/validation/middleware.ts
 *
 * MIGRATION NOTE:
 * - Migrated from express-validator to Zod for better type safety
 * - Zod provides compile-time + runtime validation
 */

import express from 'express';
import * as authController from '../controllers/authController';
import * as auth from '../middleware/auth';
import { UserRole } from '../entities/User';

// Zod validation imports
import {
    validate,
    LoginSchema,
    RegisterSchema,
    RefreshTokenSchema,
    UpdateProfileSchema,
    ChangePasswordSchema,
    LogoutSchema,
} from '../validation';

const router = express.Router();

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     description: Authenticate user and return access/refresh tokens. Sets HttpOnly cookies.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *       401:
 *         $ref: '#/components/schemas/Error'
 */
router.post(
    '/login',
    validate(LoginSchema),
    authController.login
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     description: Get a new access token using a valid refresh token (from cookie or body).
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *             application/json:
 *               schema:
 *                 $ref: '#/components/schemas/Error'
 */
router.post(
    '/refresh',
    validate(RefreshTokenSchema),
    authController.refreshToken
);

// =============================================================================
// PROTECTED ROUTES
// =============================================================================

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user's profile
 * @access  Private
 *
 * NOTE: No body validation needed, user from JWT
 */
router.get(
    '/profile',
    auth.authenticate,
    authController.getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user's profile
 * @access  Private
 *
 * VALIDATION:
 * - name: Optional, 1-100 chars
 * - slackUserId: Optional, Slack user ID format (U followed by alphanumeric)
 */
router.put(
    '/profile',
    auth.authenticate,
    validate(UpdateProfileSchema),
    authController.updateProfile
);

/**
 * @route   PUT /api/auth/password
 * @desc    Change current user's password
 * @access  Private
 *
 * VALIDATION:
 * - currentPassword: Required
 * - newPassword: Min 8 chars, uppercase, lowercase, number
 * - Ensures new password differs from current
 */
router.put(
    '/password',
    auth.authenticate,
    validate(ChangePasswordSchema),
    authController.changePassword
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token on client side)
 * @access  Public (uses refresh token for identity)
 *
 * WHY PUBLIC: Users should be able to logout even when their access token
 * is expired. The refresh token in the body/cookie identifies the session.
 *
 * VALIDATION:
 * - refreshToken: Optional (from cookie or body)
 */
router.post(
    '/logout',
    validate(LogoutSchema),
    authController.logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 *
 * NOTE: No body validation needed
 */
router.post(
    '/logout-all',
    auth.authenticate,
    authController.logoutAll
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sessions
 * @access  Private
 *
 * NOTE: No body validation needed
 */
router.get(
    '/sessions',
    auth.authenticate,
    authController.getSessions
);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 *
 * TODO: Add sessionId param validation
 */
router.delete(
    '/sessions/:sessionId',
    auth.authenticate,
    authController.revokeSession
);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (Admin only)
 * @access  Private/Admin
 *
 * VALIDATION:
 * - email: Valid email format, normalized to lowercase
 * - password: Min 8 chars, uppercase, lowercase, number
 * - name: Required, 1-100 chars
 * - podId: Required
 *
 * SECURITY: Admin-only endpoint
 */
router.post(
    '/register',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validate(RegisterSchema),
    authController.register
);

export default router;
