/**
 * Query Routes
 * Handles query/script submissions, approvals, and request management
 *
 * ARCHITECTURE:
 * - Uses handleScriptUpload for file handling
 * - Enforces role-based access for approvals (Manager/Admin)
 * - Uses UUIDs for request identification (security - prevents enumeration)
 *
 * VALIDATION STRATEGY:
 * - Using Zod for runtime validation with TypeScript type inference
 * - Schemas defined in src/validation/querySchemas.ts
 * - Common schemas (pagination, UUID) in src/validation/commonSchemas.ts
 *
 * MIGRATION NOTE:
 * - Migrated from express-validator to Zod for better type safety
 */

import express from 'express';
import * as queryController from '../controllers/queryController';
import * as auth from '../middleware/auth';
import { handleScriptUpload } from '../middleware/upload';
import { UserRole } from '../entities/User';

// Zod validation imports
import {
    validate,
    validateQuery,
    validateParams,
    SubmitRequestSchema,
    RejectRequestSchema,
    PaginationSchema,
    RequestUuidParamSchema,
    InstanceIdParamSchema,
} from '../validation';
import {
    InstancesQuerySchema,
} from '../validation/databaseSchemas';

const router = express.Router();

// =============================================================================
// METADATA ROUTES
// =============================================================================

// =============================================================================
// METADATA ROUTES
// =============================================================================

/**
 * @swagger
 * /queries/instances:
 *   get:
 *     summary: Get database instances
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [postgresql, mongodb]
 *         description: Filter by database type
 *     responses:
 *       200:
 *         description: List of database instances
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DatabaseInstance'
 */
router.get(
    '/instances',
    auth.authenticate,
    validateQuery(InstancesQuerySchema),
    queryController.getInstances
);

/**
 * @swagger
 * /queries/instances/{instanceId}/databases:
 *   get:
 *     summary: Get databases for an instance
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Instance ID
 *     responses:
 *       200:
 *         description: List of database names
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: 'string' }
 *                       sizeOnDisk: { type: 'number' }
 *                       empty: { type: 'boolean' }
 */
router.get(
    '/instances/:instanceId/databases',
    auth.authenticate,
    validateParams(InstanceIdParamSchema),
    queryController.getDatabases
);

/**
 * @swagger
 * /queries/pods:
 *   get:
 *     summary: Get all PODs
 *     tags: [Metadata]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of PODs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string' }
 *                       name: { type: 'string' }
 */
router.get(
    '/pods',
    auth.authenticate,
    queryController.getPods
);

// =============================================================================
// SUBMISSION ROUTES
// =============================================================================

// =============================================================================
// SUBMISSION ROUTES
// =============================================================================

/**
 * @swagger
 * /queries/submit:
 *   post:
 *     summary: Submit a new database query request
 *     description: |
 *       Submit a query for approval and execution. All queries are analyzed for risk level.
 *       HIGH and CRITICAL risk queries require manager approval before execution.
 *       
 *       **Security**: Queries are sanitized for XSS and analyzed for dangerous patterns (DROP, TRUNCATE, etc.)
 *       
 *       **Idempotency**: Include `Idempotency-Key` header to prevent duplicate submissions.
 *     tags: [Queries]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdempotencyKeyHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instanceId, databaseName, queryContent, podId]
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
 *                 description: Target database name
 *                 example: 'analytics_db'
 *               submissionType:
 *                 type: string
 *                 enum: [query, script]
 *                 default: query
 *                 description: Type of submission
 *               queryContent:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50000
 *                 description: SQL query content (max 50KB)
 *                 example: 'SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL 1 DAY'
 *               comments:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional context or justification
 *                 example: 'Daily active users report for product team'
 *               podId:
 *                 type: string
 *                 minLength: 1
 *                 description: POD identifier for approval routing
 *                 example: 'pod-data-engineering'
 *           examples:
 *             safeQuery:
 *               summary: Safe SELECT query (low risk)
 *               value:
 *                 instanceId: 'postgres-prod-1'
 *                 databaseName: 'analytics_db'
 *                 submissionType: 'query'
 *                 queryContent: 'SELECT id, name, email FROM users WHERE active = true LIMIT 100'
 *                 comments: 'Weekly active users export'
 *                 podId: 'pod-analytics'
 *             dangerousQuery:
 *               summary: Dangerous DELETE query (high risk)
 *               value:
 *                 instanceId: 'postgres-prod-1'
 *                 databaseName: 'users_db'
 *                 submissionType: 'query'
 *                 queryContent: 'DELETE FROM inactive_accounts WHERE last_login < NOW() - INTERVAL 90 DAY'
 *                 comments: 'Quarterly cleanup - approved by PM'
 *                 podId: 'pod-operations'
 *     responses:
 *       201:
 *         description: Query submitted successfully
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
 *                   $ref: '#/components/schemas/QueryRequest'
 *             example:
 *               success: true
 *               data:
 *                 id: 12345
 *                 uuid: '550e8400-e29b-41d4-a716-446655440000'
 *                 requestType: 'query'
 *                 databaseType: 'postgresql'
 *                 status: 'pending'
 *                 riskLevel: 'high'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
    '/submit',
    auth.authenticate,
    validate(SubmitRequestSchema),
    queryController.submitRequest
);

/**
 * @swagger
 * /queries/submit-script:
 *   post:
 *     summary: Submit a script execution request
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [instanceId, databaseName, podId, scriptFile]
 *             properties:
 *               instanceId: { type: 'string' }
 *               databaseName: { type: 'string' }
 *               podId: { type: 'string' }
 *               comments: { type: 'string' }
 *               scriptFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Script submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data: { $ref: '#/components/schemas/QueryRequest' }
 */
router.post(
    '/submit-script',
    auth.authenticate,
    handleScriptUpload,
    validate(SubmitRequestSchema),
    queryController.submitRequest
);

// =============================================================================
// USER REQUEST ROUTES
// =============================================================================

/**
 * @swagger
 * /queries/my-requests:
 *   get:
 *     summary: Get current user's query requests
 *     description: |
 *       Retrieve paginated list of query requests submitted by the authenticated user.
 *       Supports filtering by status and includes HATEOAS pagination links.
 *     tags: [Queries]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         description: Filter by request status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, executed, failed]
 *         example: 'pending'
 *     responses:
 *       200:
 *         description: Paginated list of requests with HATEOAS links
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedQueryRequests'
 *             example:
 *               success: true
 *               data:
 *                 - id: 12345
 *                   uuid: '550e8400-e29b-41d4-a716-446655440000'
 *                   requestType: 'query'
 *                   status: 'pending'
 *                   riskLevel: 'medium'
 *               pagination:
 *                 total: 95
 *                 page: 2
 *                 limit: 10
 *                 totalPages: 10
 *               links:
 *                 self: '/api/v1/queries/my-requests?page=2&limit=10'
 *                 next: '/api/v1/queries/my-requests?page=3&limit=10'
 *                 prev: '/api/v1/queries/my-requests?page=1&limit=10'
 *                 first: '/api/v1/queries/my-requests?page=1&limit=10'
 *                 last: '/api/v1/queries/my-requests?page=10&limit=10'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
    '/my-requests',
    auth.authenticate,
    validateQuery(PaginationSchema),
    queryController.getMyRequests
);

/**
 * @swagger
 * /queries/my-status-counts:
 *   get:
 *     summary: Get status counts for user requests
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Status counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data:
 *                   type: object
 *                   additionalProperties: { type: 'integer' }
 */
router.get(
    '/my-status-counts',
    auth.authenticate,
    queryController.getMyStatusCounts
);

/**
 * @swagger
 * /queries/requests/{uuid}:
 *   get:
 *     summary: Get details of a specific request
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: 'string', format: 'uuid' }
 *     responses:
 *       200:
 *         description: Request details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data: { $ref: '#/components/schemas/QueryRequest' }
 *       404:
 *         $ref: '#/components/schemas/Error'
 */
router.get(
    '/requests/:uuid',
    auth.authenticate,
    validateParams(RequestUuidParamSchema),
    queryController.getRequest
);

/**
 * @swagger
 * /queries/requests/{uuid}/clone:
 *   post:
 *     summary: Clone a request
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: 'string', format: 'uuid' }
 *     responses:
 *       201:
 *         description: Request cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data: { $ref: '#/components/schemas/QueryRequest' }
 */
router.post(
    '/requests/:uuid/clone',
    auth.authenticate,
    validateParams(RequestUuidParamSchema),
    queryController.cloneRequest
);

// =============================================================================
// APPROVAL ROUTES (Manager/Admin)
// =============================================================================

/**
 * @swagger
 * /queries/pending:
 *   get:
 *     summary: Get pending requests (Manager/Admin)
 *     tags: [Approval]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: 'integer', default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: 'integer', default: 10 }
 *     responses:
 *       200:
 *         description: List of pending requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/QueryRequest' }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer' }
 */
router.get(
    '/pending',
    auth.authenticate,
    auth.requireRole(UserRole.MANAGER, UserRole.ADMIN),
    validateQuery(PaginationSchema),
    queryController.getPendingRequests
);

/**
 * @swagger
 * /queries/requests/{uuid}/approve:
 *   post:
 *     summary: Approve a query request
 *     description: |
 *       Approve a pending query request. Requires MANAGER or ADMIN role.
 *       Approved queries are queued for execution.
 *       
 *       **RBAC**: Manager or Admin role required
 *       **Idempotency**: Safe to retry - approval is idempotent
 *     tags: [Queries - Approval]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/UuidPathParam'
 *       - $ref: '#/components/parameters/IdempotencyKeyHeader'
 *     responses:
 *       200:
 *         description: Request approved successfully
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
 *                   $ref: '#/components/schemas/QueryRequest'
 *             example:
 *               success: true
 *               data:
 *                 uuid: '550e8400-e29b-41d4-a716-446655440000'
 *                 status: 'approved'
 *                 approvedBy: 'manager@company.com'
 *                 approvedAt: '2024-01-15T11:30:00Z'
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
    '/requests/:uuid/approve',
    auth.authenticate,
    auth.requireRole(UserRole.MANAGER, UserRole.ADMIN),
    validateParams(RequestUuidParamSchema),
    queryController.approveRequest
);

/**
 * @swagger
 * /queries/requests/{uuid}/reject:
 *   post:
 *     summary: Reject a request
 *     tags: [Approval]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: 'string', format: 'uuid' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: 'string' }
 *     responses:
 *       200:
 *         description: Request rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data: { $ref: '#/components/schemas/QueryRequest' }
 */
router.post(
    '/requests/:uuid/reject',
    auth.authenticate,
    auth.requireRole(UserRole.MANAGER, UserRole.ADMIN),
    validateParams(RequestUuidParamSchema),
    validate(RejectRequestSchema),
    queryController.rejectRequest
);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

/**
 * @swagger
 * /queries/stats:
 *   get:
 *     summary: Get system stats
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 */
router.get(
    '/stats',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    queryController.getStats
);

/**
 * @swagger
 * /queries/all:
 *   get:
 *     summary: Get all requests (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: 'integer', default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: 'integer', default: 10 }
 *     responses:
 *       200:
 *         description: List of all requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/QueryRequest' }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer' }
 */
router.get(
    '/all',
    auth.authenticate,
    auth.requireRole(UserRole.ADMIN),
    validateQuery(PaginationSchema),
    queryController.getAllRequests
);

export default router;
