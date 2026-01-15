/**
 * User Management Routes
 * Admin-only routes for user management
 *
 * ARCHITECTURE:
 * - Admin access strictly enforced via middleware
 * - Validation via Zod schemas (src/validation/userSchemas.ts)
 * - Logic delegated to userController
 *
 * VALIDATION STRATEGY:
 * - Using Zod for runtime validation with TypeScript type inference
 * - UUID params validated to prevent enumeration attacks
 * - All admin operations are audited
 *
 * SECURITY:
 * - All routes require Admin role
 * - UUID-based identification (not sequential IDs)
 * - Self-modification guards in controller
 */

import express from 'express';
import * as userController from '../controllers/userController';
import * as auth from '../middleware/auth';
import { UserRole } from '../entities/User';

// Zod validation imports
import {
    validate,
    validateQuery,
    validateParams,
    UpdateUserSchema,
    ResetPasswordSchema,
    UserQuerySchema,
    UuidParamSchema,
} from '../validation';

const router = express.Router();

// =============================================================================
// LIST ROUTES
// =============================================================================

// =============================================================================
// LIST ROUTES
// =============================================================================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     description: |
 *       Retrieve paginated list of all users in the system.
 *       
 *       **RBAC**: Admin role required
 *       **Filtering**: Supports role and status filters
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: role
 *         description: Filter by user role
 *         schema:
 *           type: string
 *           enum: [admin, manager, developer, readonly]
 *         example: 'developer'
 *       - in: query
 *         name: isActive
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data, pagination]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *             example:
 *               success: true
 *               data:
 *                 - id: '123e4567-e89b-12d3-a456-426614174000'
 *                   email: 'john.doe@company.com'
 *                   name: 'John Doe'
 *                   role: 'developer'
 *                   isActive: true
 *               pagination:
 *                 total: 45
 *                 page: 1
 *                 limit: 10
 *                 totalPages: 5
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
    '/',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateQuery(UserQuerySchema),
    userController.getUsers
);

// =============================================================================
// SINGLE USER ROUTES
// =============================================================================

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'string', format: 'uuid' }
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data: { $ref: '#/components/schemas/User' }
 *       404:
 *         $ref: '#/components/schemas/Error'
 */
router.get(
    '/:id',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateParams(UuidParamSchema),
    userController.getUserById
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'string', format: 'uuid' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: 'string' }
 *               role: { type: 'string', enum: [developer, manager, admin] }
 *               podId: { type: 'string' }
 *               isActive: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data: { $ref: '#/components/schemas/User' }
 */
router.put(
    '/:id',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateParams(UuidParamSchema),
    validate(UpdateUserSchema),
    userController.updateUser
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: |
 *       Permanently delete a user account and all associated data.
 *       
 *       **RBAC**: Admin role required
 *       **Warning**: This action is irreversible
 *       **Impact**: User loses access immediately, all pending requests are canceled
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User UUID
 *         schema:
 *           type: string
 *           format: uuid
 *           pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 *         example: '123e4567-e89b-12d3-a456-426614174000'
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'User deleted successfully'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete(
    '/:id',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateParams(UuidParamSchema),
    userController.deleteUser
);

// =============================================================================
// USER ACTION ROUTES
// =============================================================================

// =============================================================================
// USER ACTION ROUTES
// =============================================================================

/**
 * @swagger
 * /users/{id}/activate:
 *   post:
 *     summary: Activate a user account
 *     description: |
 *       Activate a previously deactivated user account.
 *       User regains access to the system upon activation.
 *       
 *       **RBAC**: Admin role required
 *       **Effect**: User can log in and submit queries
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User UUID
 *         schema:
 *           type: string
 *           format: uuid
 *           pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 *         example: '123e4567-e89b-12d3-a456-426614174000'
 *     responses:
 *       200:
 *         description: User activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               data:
 *                 id: '123e4567-e89b-12d3-a456-426614174000'
 *                 email: 'john.doe@company.com'
 *                 isActive: true
 *                 updatedAt: '2024-01-15T12:00:00Z'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
    '/:id/activate',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateParams(UuidParamSchema),
    userController.activateUser
);

/**
 * @swagger
 * /users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'string', format: 'uuid' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: 'string', minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post(
    '/:id/reset-password',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateParams(UuidParamSchema),
    validate(ResetPasswordSchema),
    userController.resetPassword
);

export default router;
