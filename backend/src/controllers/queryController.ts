/**
 * Query Request Controller
 * Handle query/script submission and management endpoints
 *
 * ARCHITECTURE:
 * - Central hub for query lifecycle (Submit -> Approve/Reject -> Execute)
 * - Interacts with multiple services:
 *   - queryExecutionService: for running SQL/Mongo queries
 *   - scriptExecutionService: for running scripts
 *   - slackService: for notifications
 * - Enforces POD-based access control
 *
 * SECURITY:
 * - Uses UUID lookups for external access to prevent enumeration
 * - Validates instance/database access against static config
 * - Checks user roles and POD membership for approvals
 */

import { Request, Response } from 'express';
import { getEntityManager, getORM } from '../db';
import { QueryRequest, RequestStatus, SubmissionType, DatabaseType } from '../entities/QueryRequest';
import { User, UserRole } from '../entities/User';
import { Pod } from '../entities/Pod';
import * as staticData from '../config/staticData';
import { slackService, queryExecutionService, scriptExecutionService, analyzeQuery, databaseSyncService } from '../services';
import * as response from '../utils/response';
import logger from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import { parsePagination } from '../utils/validators';
import { ValidationError } from '../utils/errors';
import { ref } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

interface SubmitRequestBody {
    instanceId: string;
    databaseName: string;
    submissionType: SubmissionType;
    queryContent: string;
    comments: string;
    podId: string;
    scriptContent?: string;
    scriptFilename?: string;
}

interface RejectRequestBody {
    reason: string;
}

/**
 * Submit a new query request
 * POST /api/requests
 *
 * WHY: Entry point for proper query governance workflow
 */
export const submitRequest = async (req: Request<unknown, unknown, SubmitRequestBody>, res: Response): Promise<void> => {
    try {
        const {
            instanceId,
            databaseName,
            submissionType,
            queryContent,
            comments,
            podId,
        } = req.body;

        const user = req.user!;

        // Get instance details
        const instance = staticData.getInstanceById(instanceId);
        if (!instance) {
            throw new ValidationError('Invalid instance selected');
        }

        // Validate database exists (check Sync Service first, then Static)
        const syncedDbs = await databaseSyncService.getDatabasesForInstance(instanceId);
        const isSynced = syncedDbs.some(db => db.name === databaseName);
        const isStatic = staticData.validateInstanceDatabase(instanceId, databaseName);

        if (!isSynced && !isStatic) {
            throw new ValidationError('Invalid database for this instance');
        }

        // Get POD details
        const pod = staticData.getPodById(podId);
        if (!pod) {
            throw new ValidationError('Invalid POD selected');
        }

        const em = getEntityManager();
        const userEntity = await em.findOneOrFail(User, { id: user.id });

        // Create request
        const queryRequest = new QueryRequest();
        queryRequest.uuid = uuidv4();
        queryRequest.user = ref(userEntity);
        queryRequest.databaseType = instance.type as DatabaseType;
        queryRequest.instanceId = instance.id;
        queryRequest.instanceName = instance.name;
        queryRequest.databaseName = databaseName;
        queryRequest.submissionType = submissionType as SubmissionType;
        queryRequest.queryContent = submissionType === SubmissionType.QUERY ? queryContent : undefined;
        queryRequest.comments = comments;
        queryRequest.podId = pod.id;
        queryRequest.podName = pod.name;
        queryRequest.status = RequestStatus.PENDING;

        // Handle script uploads
        const reqWithScript = req as any;
        if (submissionType === SubmissionType.SCRIPT) {
            if (!reqWithScript.scriptInfo && !req.body.scriptContent) {
                throw new ValidationError('Script file is required');
            }

            if (reqWithScript.scriptInfo) {
                queryRequest.scriptFilename = reqWithScript.scriptInfo.filename;
                queryRequest.scriptContent = reqWithScript.scriptInfo.content;
            } else if (req.body.scriptContent) {
                queryRequest.scriptFilename = req.body.scriptFilename || 'script.js';
                queryRequest.scriptContent = req.body.scriptContent;
            }
        }

        await em.persistAndFlush(queryRequest);

        // Fetch full request (not needed if we trust the entity, but good for joins if any)
        // With MikroORM entity is already populated with what we set.

        // Send Slack notification
        await slackService.notifyNewSubmission({
            request: queryRequest, // Slack service needs update or mapping
            // For now mapping manually to match legacy structure if needed, or pass Entity if Slack service updated
            // Assuming we pass Request object properties
            id: queryRequest.id,
            uuid: queryRequest.uuid,
            status: queryRequest.status,
            userId: user.id,
            userEmail: user.email,
            instanceName: queryRequest.instanceName,
            databaseName: queryRequest.databaseName,
            submissionType: queryRequest.submissionType,
            podName: queryRequest.podName,
            managerEmail: pod.manager_email,
            createdAt: queryRequest.createdAt,
            slackUserId: user.slackUserId || undefined,
        } as any);

        logger.info('Query request submitted', { requestId: queryRequest.id, userId: user.id });

        response.created(res, {
            id: queryRequest.id,
            uuid: queryRequest.uuid,
            status: queryRequest.status,
            createdAt: queryRequest.createdAt,
        }, 'Request submitted successfully');
    } catch (error) {
        if (error instanceof ValidationError) {
            logger.warn('Submit request validation failed', { error: error.message, body: req.body });
            response.error(res, error.message, 400, 'VALIDATION_ERROR');
            return;
        }
        const err = error as Error;
        logger.error('Submit request error', { error: err.message });
        response.error(res, 'Failed to submit request', 500);
    }
};

// =============================================================================
// GET REQUESTS
// =============================================================================

/**
 * Get request by UUID
 * GET /api/requests/:uuid
 *
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
export const getRequest = async (req: Request<{ uuid: string }>, res: Response): Promise<void> => {
    try {
        const { uuid } = req.params;
        const user = req.user!;

        const em = getEntityManager();
        // SECURE: Use UUID lookup only
        const queryRequest = await em.findOne(QueryRequest, { uuid });

        if (!queryRequest) {
            response.error(res, 'Request not found', 404, 'NOT_FOUND');
            return;
        }

        // Check authorization - user can see their own requests, managers can see their POD requests
        if (user.role === UserRole.DEVELOPER && queryRequest.user.id !== user.id) {
            // Note: queryRequest.user is a Ref, .id access is sync
            response.error(res, 'Access denied', 403, 'AUTHORIZATION_ERROR');
            return;
        }

        if (user.role === UserRole.MANAGER) {
            // getPodsByManager returns { id: string, name: string }[]
            const managedPods = staticData.getPodsByManager(user.email);
            const podIds = managedPods.map((p: { id: string }) => p.id);

            if (!podIds.includes(queryRequest.podId) && queryRequest.user.id !== user.id) {
                response.error(res, 'Access denied', 403, 'AUTHORIZATION_ERROR');
                return;
            }
        }

        response.success(res, queryRequest);
    } catch (error) {
        const err = error as Error;
        logger.error('Get request error', { error: err.message });
        response.error(res, 'Failed to get request', 500);
    }
};

/**
 * Get user's own requests
 * GET /api/requests/my
 */
export const getMyRequests = async (req: Request, res: Response): Promise<void> => {
    // Inject userId into query params so getAllRequests logic filters by current user
    req.query.userId = req.user!.id;
    return getAllRequests(req, res);
};

/**
 * Get status counts for current user
 * GET /api/requests/my/counts
 */
export const getMyStatusCounts = async (req: Request, res: Response): Promise<void> => {
    try {
        const em = getEntityManager();

        // Use raw SQL query to avoid MikroORM query builder issues with aggregates
        const results = await em.getConnection().execute(
            `SELECT status, COUNT(*) as count 
             FROM query_requests 
             WHERE user_id = ? 
             GROUP BY status`,
            [req.user!.id]
        );

        // Convert to map { status: count } and calculate totals
        const counts: Record<string, number> = {
            pending: 0,
            approved: 0,
            rejected: 0,
            executing: 0,
            completed: 0,
            failed: 0,
            total: 0
        };

        results.forEach((r: any) => {
            const count = parseInt(r.count, 10);
            counts[r.status] = count;
            counts.total += count;
        });

        response.success(res, counts);
    } catch (error) {
        const err = error as Error;
        logger.error('Get my status counts error', { error: err.message });
        response.error(res, 'Failed to get status counts', 500);
    }
};

/**
 * Get pending requests for approval (Manager view)
 * GET /api/requests/pending
 */
export const getPendingRequests = async (req: Request, res: Response): Promise<void> => {
    // Default to pending status if not provided, but allow overriding
    if (!req.query.status) {
        req.query.status = RequestStatus.PENDING;
    }
    return getAllRequests(req, res);
};

// =============================================================================
// APPROVAL WORKFLOW
// =============================================================================

/**
 * Approve a request
 * POST /api/requests/:uuid/approve
 *
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
export const approveRequest = async (req: Request<{ uuid: string }>, res: Response): Promise<void> => {
    const { uuid } = req.params;
    const user = req.user!;
    const em = getEntityManager();

    try {
        // SECURE: Use UUID lookup only
        const queryRequest = await em.findOne(QueryRequest, { uuid }, { populate: ['user'] });

        if (!queryRequest) {
            response.error(res, 'Request not found', 404, 'NOT_FOUND');
            return;
        }

        // Check if request is pending
        if (queryRequest.status !== RequestStatus.PENDING) {
            response.error(res, 'Request is not pending approval', 400, 'VALIDATION_ERROR');
            return;
        }

        // Check authorization for managers
        /* istanbul ignore if */
        if (user.role === UserRole.MANAGER) {
            const managedPods = staticData.getPodsByManager(user.email);
            const podIds = managedPods.map((p: { id: string }) => p.id);

            if (!podIds.includes(queryRequest.podId)) {
                response.error(res, 'Not authorized to approve this request', 403, 'AUTHORIZATION_ERROR');
                return;
            }
        }

        // Approve the request
        const approverEntity = await em.findOneOrFail(User, { id: user.id });
        queryRequest.approve(approverEntity);
        await em.flush();

        logger.info('Request approved', { requestId: queryRequest.id, uuid, approverId: user.id });

        // Audit log with IP address for compliance
        const requesterEmail = queryRequest.user.getEntity()?.email || 'unknown';
        auditLogger.logApproval(req, String(queryRequest.id), uuid, requesterEmail);

        // Execute the query/script
        try {
            // Mark as executing
            queryRequest.markExecuting();
            await em.flush();

            let result;

            if (queryRequest.submissionType === SubmissionType.QUERY) {
                // Pass Entity, ensure Service handles it or map
                result = await queryExecutionService.executeQuery(queryRequest as any);
            } else {
                result = await scriptExecutionService.executeScript(queryRequest as any);
            }

            // Format result
            const resultStr = JSON.stringify(result, null, 2);

            // Get requester for Slack notification
            const requester = queryRequest.user.getEntity(); // Already populated

            // Check if execution actually succeeded (result.success could be false)
            if (result.success === false) {
                // Mark as failed when result indicates failure
                const errorMessage = (result as any).error?.message || (result as any).error || 'Execution failed';

                queryRequest.markFailed(errorMessage);
                await em.flush();

                // Send failure notification
                await slackService.notifyApprovalSuccess(
                    { ...queryRequest, slackUserId: requester?.slackUserId || undefined, userEmail: requester?.email } as any,
                    resultStr
                );

                logger.error('Query execution failed', { requestId: queryRequest.id, uuid, error: errorMessage });

                response.success(res, {
                    ...queryRequest,
                    executionResult: result,
                }, 'Request approved but execution failed');
                return;
            }

            // Mark as completed only when truly successful
            queryRequest.markCompleted(resultStr);
            await em.flush();

            // Send success notification
            await slackService.notifyApprovalSuccess(
                { ...queryRequest, slackUserId: requester?.slackUserId || undefined, userEmail: requester?.email } as any,
                resultStr
            );

            logger.info('Query executed successfully', { requestId: queryRequest.id, uuid });

            response.success(res, {
                ...queryRequest,
                executionResult: result,
            }, 'Request approved and executed successfully');

        } catch (error) {
            const err = error as Error;
            // Mark as failed
            const errorMessage = err.message || 'Execution failed';

            queryRequest.markFailed(errorMessage);
            await em.flush();

            // Get requester for Slack notification
            const requester = queryRequest.user.getEntity();

            // Send failure notification
            await slackService.notifyApprovalFailure(
                { ...queryRequest, slackUserId: requester?.slackUserId || undefined, userEmail: requester?.email } as any,
                errorMessage
            );

            logger.error('Query execution failed', { requestId: queryRequest.id, uuid, error: errorMessage });

            response.success(res, queryRequest, 'Request approved but execution failed');
        }
    } catch (error) {
        const err = error as Error;
        logger.error('Approve request error', { error: err.message, uuid });
        response.error(res, 'Failed to approve request', 500);
    }
};

/**
 * Reject a request
 * POST /api/requests/:uuid/reject
 *
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
export const rejectRequest = async (req: Request<{ uuid: string }, unknown, RejectRequestBody>, res: Response): Promise<void> => {
    try {
        const { uuid } = req.params;
        const { reason } = req.body;
        const user = req.user!;
        const em = getEntityManager();

        // SECURE: Use UUID lookup only
        const queryRequest = await em.findOne(QueryRequest, { uuid }, { populate: ['user'] });

        if (!queryRequest) {
            response.error(res, 'Request not found', 404, 'NOT_FOUND');
            return;
        }

        // Check if request is pending
        if (queryRequest.status !== RequestStatus.PENDING) {
            response.error(res, 'Request is not pending approval', 400, 'VALIDATION_ERROR');
            return;
        }

        // Check authorization for managers
        /* istanbul ignore if */
        if (user.role === UserRole.MANAGER) {
            const managedPods = staticData.getPodsByManager(user.email);
            const podIds = managedPods.map((p: { id: string }) => p.id);

            if (!podIds.includes(queryRequest.podId)) {
                response.error(res, 'Not authorized to reject this request', 403, 'AUTHORIZATION_ERROR');
                return;
            }
        }

        // Reject the request
        const rejectorEntity = await em.findOneOrFail(User, { id: user.id });
        queryRequest.reject(rejectorEntity, reason);
        await em.flush();

        // Get requester for Slack notification
        const requester = queryRequest.user.getEntity();

        // Send rejection notification
        await slackService.notifyRejection({
            ...queryRequest,
            slackUserId: requester?.slackUserId || undefined,
            userEmail: requester?.email,
        } as any);

        logger.info('Request rejected', { requestId: queryRequest.id, uuid, rejectorId: user.id, reason });

        // Audit log with IP address for compliance
        auditLogger.logRejection(req, String(queryRequest.id), uuid, requester?.email || 'unknown', reason);

        response.success(res, queryRequest, 'Request rejected');
    } catch (error) {
        const err = error as Error;
        logger.error('Reject request error', { error: err.message });
        response.error(res, 'Failed to reject request', 500);
    }
};

/**
 * Clone a request (re-submit)
 * POST /api/requests/:uuid/clone
 *
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
export const cloneRequest = async (req: Request<{ uuid: string }>, res: Response): Promise<void> => {
    try {
        const { uuid } = req.params;
        const user = req.user!;
        const em = getEntityManager();

        // SECURE: Use UUID lookup only
        const originalRequest = await em.findOne(QueryRequest, { uuid });

        if (!originalRequest) {
            response.error(res, 'Request not found', 404, 'NOT_FOUND');
            return;
        }

        // Only allow cloning own requests
        // originalRequest.user is Ref, verify sync access via .id
        if (originalRequest.user.id !== user.id) {
            response.error(res, 'Can only clone your own requests', 403, 'AUTHORIZATION_ERROR');
            return;
        }

        const userEntity = await em.findOneOrFail(User, { id: user.id });

        // Create new request
        const newRequest = new QueryRequest();
        newRequest.uuid = uuidv4();
        newRequest.user = ref(userEntity);
        newRequest.databaseType = originalRequest.databaseType;
        newRequest.instanceId = originalRequest.instanceId;
        newRequest.instanceName = originalRequest.instanceName;
        newRequest.databaseName = originalRequest.databaseName;
        newRequest.submissionType = originalRequest.submissionType;
        newRequest.queryContent = originalRequest.queryContent;
        newRequest.scriptFilename = originalRequest.scriptFilename;
        newRequest.scriptContent = originalRequest.scriptContent;
        newRequest.comments = `[Cloned from ${originalRequest.uuid}] ${originalRequest.comments}`;
        newRequest.podId = originalRequest.podId;
        newRequest.podName = originalRequest.podName;
        newRequest.status = RequestStatus.PENDING;

        await em.persistAndFlush(newRequest);

        // Send notification
        await slackService.notifyNewSubmission({
            request: newRequest,
            id: newRequest.id,
            uuid: newRequest.uuid,
            status: newRequest.status,
            userId: user.id,
            userEmail: user.email,
            instanceName: newRequest.instanceName,
            databaseName: newRequest.databaseName,
            submissionType: newRequest.submissionType,
            podName: newRequest.podName,
            createdAt: newRequest.createdAt,
            slackUserId: user.slackUserId || undefined,
        } as any);

        logger.info('Request cloned', { originalUuid: uuid, newId: newRequest.id, newUuid: newRequest.uuid, userId: user.id });

        response.created(res, {
            id: newRequest.id,
            uuid: newRequest.uuid,
            status: newRequest.status,
            createdAt: newRequest.createdAt,
        }, 'Request cloned successfully');
    } catch (error) {
        const err = error as Error;
        logger.error('Clone request error', { error: err.message });
        response.error(res, 'Failed to clone request', 500);
    }
};

// =============================================================================
// ADMIN & UTILS
// =============================================================================

/**
 * Get all requests (Admin view)
 * GET /api/requests
 */
export const getAllRequests = async (req: Request, res: Response): Promise<void> => {
    try {
        const { page, limit, offset } = parsePagination(req.query as any);
        const { status, podId, databaseType, submissionType, search, startDate, endDate, userId, excludeOwnRequests } = req.query;
        const user = req.user!;
        const em = getEntityManager();

        const where: any = {};

        // RBAC: Managers can only see requests for their managed PODs
        // EXCEPT when viewing their own requests (My Requests tab)
        const isViewingOwnRequests = userId && userId === user.id;

        if (user.role === UserRole.MANAGER && !isViewingOwnRequests) {
            const managedPods = staticData.getPodsByManager(user.email).map(p => p.id);
            if (managedPods.length === 0) {
                // Manager manages no pods, return empty list immediately
                response.paginated(res, [], { page, limit, total: 0 });
                return;
            }

            if (podId) {
                // If filtering by specific pod, verify access
                const requestedPodId = podId as string;
                if (!managedPods.includes(requestedPodId)) {
                    response.error(res, 'Access denied to this POD', 403, 'AUTHORIZATION_ERROR');
                    return;
                }
                where.podId = requestedPodId;
            } else {
                // Otherwise, return all requests from managed pods
                where.podId = { $in: managedPods };
            }
        } else if (podId) {
            // Admins (or anyone viewing own requests if logic permits) can filter by any pod
            where.podId = podId;
        }

        if (userId) where.user = userId;

        // Exclude current user's own requests (used in Processed Requests view for managers)
        if (excludeOwnRequests === 'true') {
            where.user = { $ne: user.id };
        }

        // Support comma-separated filters for status, databaseType, submissionType
        if (status) {
            const statusStr = status as string;
            if (statusStr.includes(',')) {
                where.status = { $in: statusStr.split(',').map(s => s.trim()) };
            } else {
                where.status = status;
            }
        }

        if (databaseType) {
            const typeStr = databaseType as string;
            if (typeStr.includes(',')) {
                where.databaseType = { $in: typeStr.split(',').map(s => s.trim()) };
            } else {
                where.databaseType = databaseType;
            }
        }

        if (submissionType) {
            const subTypeStr = submissionType as string;
            if (subTypeStr.includes(',')) {
                where.submissionType = { $in: subTypeStr.split(',').map(s => s.trim()) };
            } else {
                where.submissionType = submissionType;
            }
        }
        if (startDate) where.createdAt = { $gte: new Date(startDate as string) };
        if (endDate) {
            where.createdAt = { ...where.createdAt, $lte: new Date(endDate as string) };
        }
        if (search) {
            const searchTerm = `%${search}%`;
            where.$or = [
                { comments: { $ilike: searchTerm } },
                { instanceName: { $ilike: searchTerm } },
                { databaseName: { $ilike: searchTerm } }
            ];
        }

        const [requests, total] = await em.findAndCount(QueryRequest, where, {
            limit,
            offset,
            orderBy: { createdAt: 'DESC' },
            populate: ['user']
        });

        // Transform to include userEmail for frontend display
        const transformedRequests = requests.map(req => {
            const userEntity = req.user?.getEntity?.() || req.user;
            return {
                ...req,
                userEmail: (userEntity as any)?.email || undefined,
            };
        });

        response.paginated(res, transformedRequests, { page, limit, total });
    } catch (error) {
        const err = error as Error;
        logger.error('Get all requests error', { error: err.message });
        response.error(res, 'Failed to get requests', 500);
    }
};

/**
 * Get query statistics (Admin only)
 * GET /api/queries/stats
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const em = getEntityManager();
        const qb = em.createQueryBuilder(QueryRequest);

        // Overall stats by status
        const statusResults = await qb.clone()
            .select(['status', 'count(*) as count'])
            .groupBy('status')
            .execute();
        const overallStats: Record<string, number> = {};
        statusResults.forEach((r: any) => overallStats[r.status] = parseInt(r.count, 10));

        // Stats by POD
        const podResults = await qb.clone()
            .select(['pod_id', 'pod_name', 'count(*) as count'])
            .groupBy(['pod_id', 'pod_name'])
            .execute();
        const podStats = podResults.map((r: any) => ({
            podId: r.pod_id,
            podName: r.pod_name,
            count: parseInt(r.count, 10)
        }));

        // Stats by DB Type
        const typeResults = await qb.clone()
            .select(['database_type', 'count(*) as count'])
            .groupBy('database_type')
            .execute();
        const typeStats = typeResults.map((r: any) => ({
            type: r.database_type,
            count: parseInt(r.count, 10)
        }));

        // Recent activity check is more complex, maybe skip or implement simple recent requests list
        const recentActivity = await em.find(QueryRequest, {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }, { limit: 10, orderBy: { createdAt: 'DESC' } });

        response.success(res, {
            overall: overallStats,
            byPod: podStats,
            byType: typeStats,
            recentActivity,
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Error fetching stats', { error: err.message });
        response.error(res, 'Failed to fetch statistics', 500);
    }
};

/**
 * Get available instances
 * GET /api/instances
 *
 * Uses static config data
 */
export const getInstances = async (req: Request, res: Response): Promise<void> => {
    const { type } = req.query;

    try {
        const instances = await databaseSyncService.getInstances(type as string);
        response.success(res, instances);
    } catch (error) {
        const err = error as Error;
        logger.error('Get instances error', { error: err.message });
        response.error(res, 'Failed to fetch instances', 500);
    }
};

/**
 * Get databases for an instance
 * GET /api/instances/:instanceId/databases
 *
 * Uses synced database data (fallback to static if sync fails/not found? No, consistency first)
 */
export const getDatabases = async (req: Request, res: Response): Promise<void> => {
    const { instanceId } = req.params;
    const instanceIdStr = instanceId as string;

    try {
        // Try getting from DB first
        const instance = await databaseSyncService.getInstanceById(instanceIdStr);

        if (!instance) {
            // Fallback to static data if not found in DB (e.g. just added to config but not synced yet)
            const staticInstance = staticData.getInstanceById(instanceIdStr);
            if (!staticInstance) {
                response.error(res, 'Instance not found', 404, 'NOT_FOUND');
                return;
            }

            // Return static data result
            response.success(res, {
                instanceId,
                instanceName: staticInstance.name,
                type: staticInstance.type,
                databases: staticData.getDatabasesForInstance(instanceIdStr),
                source: 'static'
            });
            return;
        }

        const databases = await databaseSyncService.getDatabasesForInstance(instanceIdStr);

        response.success(res, {
            instanceId,
            instanceName: instance.name,
            type: instance.type,
            databases: databases.map(d => d.name), // returning strings to match expected API format
            source: 'synced'
        });
    } catch (error) {
        const err = error as Error;
        logger.error('Get databases error', { error: err.message });
        response.error(res, 'Failed to fetch databases', 500);
    }
};

/**
 * Get available PODs
 * GET /api/pods
 */
export const getPods = async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const em = getEntityManager();

    try {
        // Fetch only active pods from database
        const pods = await em.find(Pod, { isActive: true }, { orderBy: { name: 'ASC' } });

        // For approval dashboard, managers should only see their managed PODs
        if (req.query.forApproval === 'true' && user.role === UserRole.MANAGER) {
            const managedPods = pods.filter(pod => pod.managerEmail === user.email);
            response.success(res, managedPods.map(p => ({ id: p.id, name: p.name, manager_email: p.managerEmail })));
            return;
        }

        // For admins or general use, return all active PODs
        response.success(res, pods.map(p => ({ id: p.id, name: p.name, manager_email: p.managerEmail })));
    } catch (error) {
        const err = error as Error;
        logger.error('Get pods error', { error: err.message });
        response.error(res, 'Failed to get pods', 500);
    }
};

/**
 * Analyze query content for risk
 * POST /api/queries/analyze
 * 
 * WHY: Allows frontend to show risk analysis before submission
 */
interface AnalyzeQueryBody {
    query: string;
    databaseType: string;
}

export const analyzeQueryContent = async (req: Request<unknown, unknown, AnalyzeQueryBody>, res: Response): Promise<void> => {
    try {
        const { query, databaseType } = req.body;

        if (!query || !databaseType) {
            response.error(res, 'Query and database type are required', 400, 'VALIDATION_ERROR');
            return;
        }

        const analysis = analyzeQuery(query, databaseType);

        logger.debug('Query analyzed', {
            databaseType,
            overallRisk: analysis.overallRisk,
            operationsCount: analysis.operations.length
        });

        response.success(res, analysis, 'Query analyzed successfully');
    } catch (error) {
        const err = error as Error;
        logger.error('Analyze query error', { error: err.message });
        response.error(res, 'Failed to analyze query', 500);
    }
};

export default {
    submitRequest,
    getRequest,
    getMyRequests,
    getMyStatusCounts,
    getPendingRequests,
    approveRequest,
    rejectRequest,
    cloneRequest,
    getAllRequests,
    getStats,
    getInstances,
    getDatabases,
    getPods,
    analyzeQueryContent,
};
