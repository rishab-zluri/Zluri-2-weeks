/**
 * Database Routes
 *
 * API routes for database instances, databases, sync, and blacklist
 *
 * ARCHITECTURE:
 * - Uses real authentication middleware
 * - Delegates logic to databaseController
 * - Secured by role-based access control (Admin only for sync/blacklist mutations)
 *
 * VALIDATION STRATEGY:
 * - Using Zod for runtime validation with TypeScript type inference
 * - Schemas defined in src/validation/databaseSchemas.ts
 * - Blacklist regex patterns are validated for syntax
 *
 * SECURITY:
 * - Sync operations limited to Admin
 * - Blacklist mutations limited to Admin
 * - Read operations available to all authenticated users
 */

import express from 'express';
import * as databaseController from '../controllers/databaseController';
import * as auth from '../middleware/auth';
import { UserRole } from '../entities/User';

// Zod validation imports
import {
    validateQuery,
    validateParams,
    validate,
    InstanceIdParamSchema,
    IdParamSchema,
    PaginationSchema,
} from '../validation';
import {
    InstancesQuerySchema,
    BlacklistSchema,
    DatabasesQuerySchema,
} from '../validation/databaseSchemas';

const router = express.Router();

// ============================================================================
// INSTANCE ROUTES
// ============================================================================

// ============================================================================
// INSTANCE ROUTES
// ============================================================================

/**
 * @swagger
 * /databases/instances:
 *   get:
 *     summary: List database instances
 *     description: |
 *       Retrieve all configured database instances (PostgreSQL and MongoDB).
 *       Results can be filtered by database type.
 *       
 *       **Security**: Returns only instances the authenticated user has access to.
 *     tags: [Database Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         description: Filter instances by database type
 *         schema:
 *           type: string
 *           enum: [postgresql, mongodb]
 *         example: 'postgresql'
 *     responses:
 *       200:
 *         description: List of database instances
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DatabaseInstance'
 *             example:
 *               success: true
 *               data:
 *                 - id: 'postgres-prod-1'
 *                   name: 'Production PostgreSQL'
 *                   type: 'postgresql'
 *                   host: 'db.internal.company.com'
 *                   port: 5432
 *                   isHealthy: true
 *                 - id: 'mongo-analytics'
 *                   name: 'Analytics MongoDB'
 *                   type: 'mongodb'
 *                   isHealthy: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
    '/instances',
    auth.authenticate,
    validateQuery(InstancesQuerySchema),
    databaseController.getInstances
);

/**
 * @swagger
 * /databases/instances/{instanceId}:
 *   get:
 *     summary: Get instance by ID
 *     tags: [Databases]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema: { type: 'string' }
 *     responses:
 *       200:
 *         description: Instance details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data: { $ref: '#/components/schemas/DatabaseInstance' }
 *       404:
 *         $ref: '#/components/schemas/Error'
 */
router.get(
    '/instances/:instanceId',
    auth.authenticate,
    validateParams(InstanceIdParamSchema),
    databaseController.getInstanceById
);

/**
 * @swagger
 * /databases/instances/{instanceId}/databases:
 *   get:
 *     summary: Get databases in an instance
 *     tags: [Databases]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema: { type: 'string' }
 *       - in: query
 *         name: search
 *         schema: { type: 'string' }
 *       - in: query
 *         name: page
 *         schema: { type: 'integer', default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: 'integer', default: 10 }
 *     responses:
 *       200:
 *         description: List of databases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     databases:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: 'string' }
 *                           sizeOnDisk: { type: 'number' }
 *                           empty: { type: 'boolean' }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer' }
 */
router.get(
    '/instances/:instanceId/databases',
    auth.authenticate,
    validateParams(InstanceIdParamSchema),
    validateQuery(DatabasesQuerySchema),
    databaseController.getDatabases
);

// ============================================================================
// SYNC ROUTES (Admin only)
// ============================================================================

/**
 * @swagger
 * /databases/instances/{instanceId}/sync:
 *   post:
 *     summary: Synchronize database instance metadata
 *     description: |
 *       Trigger metadata synchronization for a specific database instance.
 *       Updates the list of available databases and their schemas.
 *       
 *       **RBAC**: Admin role required
 *       **Idempotency**: Safe to retry - sync operations are idempotent
 *       **Duration**: May take 30-60 seconds for large databases
 *     tags: [Database Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/InstanceIdParam'
 *       - $ref: '#/components/parameters/IdempotencyKeyHeader'
 *     responses:
 *       200:
 *         description: Sync initiated successfully
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
 *                   example: 'Sync completed successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     databasesFound:
 *                       type: integer
 *                       example: 15
 *                     syncedAt:
 *                       type: string
 *                       format: date-time
 *                       example: '2024-01-15T11:45:00Z'
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
    '/instances/:instanceId/sync',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateParams(InstanceIdParamSchema),
    databaseController.syncInstance
);

/**
 * @swagger
 * /databases/instances/{instanceId}/sync-history:
 *   get:
 *     summary: Get sync history
 *     tags: [Databases]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema: { type: 'string' }
 *     responses:
 *       200:
 *         description: Sync history
 */
router.get(
    '/instances/:instanceId/sync-history',
    auth.authenticate,
    validateParams(InstanceIdParamSchema),
    validateQuery(PaginationSchema),
    databaseController.getSyncHistory
);

/**
 * @swagger
 * /databases/sync-all:
 *   post:
 *     summary: Trigger sync for all instances
 *     tags: [Databases]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Sync started for all instances
 */
router.post(
    '/sync-all',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    databaseController.syncAll
);

// ============================================================================
// BLACKLIST ROUTES (Admin only for mutations)
// ============================================================================

// ============================================================================
// BLACKLIST ROUTES (Admin only for mutations)
// ============================================================================

/**
 * @swagger
 * /databases/blacklist:
 *   get:
 *     summary: Get blacklist entries
 *     tags: [Databases]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of blacklisted patterns
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'integer' }
 *                       pattern: { type: 'string' }
 *                       patternType: { type: 'string' }
 *                       reason: { type: 'string' }
 */
router.get(
    '/blacklist',
    auth.authenticate,
    databaseController.getBlacklist
);

/**
 * @swagger
 * /databases/blacklist:
 *   post:
 *     summary: Add database to blacklist
 *     description: |
 *       Blacklist a database to prevent query submissions.
 *       Used for maintenance windows or deprecated databases.
 *       
 *       **RBAC**: Admin role required
 *       **Impact**: Users cannot submit queries to blacklisted databases
 *     tags: [Database Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instanceId, databaseName, reason]
 *             properties:
 *               instanceId:
 *                 type: string
 *                 pattern: '^[a-zA-Z0-9-_]+$'
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Database instance identifier
 *                 example: 'postgres-prod-1'
 *               databaseName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Database name to blacklist
 *                 example: 'legacy_system_db'
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for blacklisting (audit trail)
 *                 example: 'Database scheduled for decommission on 2024-02-01'
 *           example:
 *             instanceId: 'postgres-prod-1'
 *             databaseName: 'old_reporting_db'
 *             reason: 'Migrated to new analytics platform'
 *     responses:
 *       201:
 *         description: Database blacklisted successfully
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
 *                   example: 'Database blacklisted successfully'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
    '/blacklist',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validate(BlacklistSchema),
    databaseController.addToBlacklist
);

/**
 * @swagger
 * /databases/blacklist/{id}:
 *   delete:
 *     summary: Remove from blacklist
 *     tags: [Databases]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Removed from blacklist
 */
router.delete(
    '/blacklist/:id',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateParams(IdParamSchema),
    databaseController.removeFromBlacklist
);

export default router;
