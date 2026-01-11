/**
 * Query Request Controller
 * Handle query/script submission and management endpoints
 * 
 * SECURITY: Uses UUID lookups to prevent enumeration attacks
 */

const QueryRequest = require('../models/QueryRequest');
const User = require('../models/User');
const { getInstanceById, getPodById, getAllPods, getAllInstances, getInstancesByType, getDatabasesForInstance, validateInstanceDatabase, getPodsByManager } = require('../config/staticData');
const { slackService, queryExecutionService, scriptExecutionService } = require('../services');
const response = require('../utils/response');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const { parsePagination } = require('../utils/validators');

/**
 * Submit a new query request
 * POST /api/requests
 */
const submitRequest = async (req, res) => {
  const {
    instanceId,
    databaseName,
    submissionType,
    queryContent,
    comments,
    podId,
  } = req.body;

  const user = req.user;

  // Get instance details
  const instance = getInstanceById(instanceId);
  if (!instance) {
    return response.error(res, 'Invalid instance selected', 400, 'INVALID_INSTANCE');
  }

  // Validate database exists in instance
  if (!validateInstanceDatabase(instanceId, databaseName)) {
    return response.error(res, 'Invalid database for this instance', 400, 'INVALID_DATABASE');
  }

  // Get POD details
  const pod = getPodById(podId);
  if (!pod) {
    return response.error(res, 'Invalid POD selected', 400, 'INVALID_POD');
  }

  // Prepare request data
  const requestData = {
    userId: user.id,
    databaseType: instance.type,
    instanceId: instance.id,
    instanceName: instance.name,
    databaseName,
    submissionType,
    queryContent: submissionType === 'query' ? queryContent : null,
    scriptFilename: null,
    scriptContent: null,
    comments,
    podId: pod.id,
    podName: pod.name,
  };

  // Handle script uploads
  if (submissionType === 'script') {
    if (!req.scriptInfo && !req.body.scriptContent) {
      return response.error(res, 'Script file is required', 400, 'MISSING_SCRIPT');
    }

    /* istanbul ignore else */
    if (req.scriptInfo) {
      requestData.scriptFilename = req.scriptInfo.filename;
      requestData.scriptContent = req.scriptInfo.content;
    } else if (req.body.scriptContent) {
      requestData.scriptFilename = req.body.scriptFilename || 'script.js';
      requestData.scriptContent = req.body.scriptContent;
    }
  }

  // Create request
  const queryRequest = await QueryRequest.create(requestData);

  // Fetch full request with user info for notification
  const fullRequest = await QueryRequest.findById(queryRequest.id);

  // Send Slack notification
  await slackService.notifyNewSubmission({
    ...fullRequest,
    slackUserId: user.slackUserId,
  });

  logger.info('Query request submitted', { requestId: queryRequest.id, userId: user.id });

  return response.created(res, {
    id: queryRequest.id,
    uuid: queryRequest.uuid,
    status: queryRequest.status,
    createdAt: queryRequest.createdAt,
  }, 'Request submitted successfully');
};

/**
 * Get request by UUID
 * GET /api/requests/:uuid
 * 
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
const getRequest = async (req, res) => {
  const { uuid } = req.params;
  const user = req.user;

  // SECURE: Use UUID lookup only
  const queryRequest = await QueryRequest.findByUuid(uuid);
  
  if (!queryRequest) {
    return response.error(res, 'Request not found', 404, 'NOT_FOUND');
  }

  // Check authorization - user can see their own requests, managers can see their POD requests
  if (user.role === User.UserRoles.DEVELOPER && queryRequest.userId !== user.id) {
    return response.error(res, 'Access denied', 403, 'FORBIDDEN');
  }

  if (user.role === User.UserRoles.MANAGER) {
    const managedPods = getPodsByManager(user.email);
    const podIds = managedPods.map((p) => p.id);
    
    if (!podIds.includes(queryRequest.podId) && queryRequest.userId !== user.id) {
      return response.error(res, 'Access denied', 403, 'FORBIDDEN');
    }
  }

  return response.success(res, queryRequest);
};

/**
 * Get user's own requests
 * GET /api/requests/my
 */
const getMyRequests = async (req, res) => {
  const user = req.user;
  const { page, limit, offset } = parsePagination(req.query);
  const { status } = req.query;

  const [requests, total] = await Promise.all([
    QueryRequest.findByUserId(user.id, { status, limit, offset }),
    QueryRequest.count({ userId: user.id, status }),
  ]);

  return response.paginated(res, requests, { page, limit, total });
};

/**
 * Get status counts for current user
 * GET /api/requests/my/counts
 */
const getMyStatusCounts = async (req, res) => {
  const counts = await QueryRequest.getStatusCountsByUser(req.user.id);
  return response.success(res, counts);
};

/**
 * Get pending requests for approval (Manager view)
 * GET /api/requests/pending
 */
const getPendingRequests = async (req, res) => {
  const user = req.user;
  const { page, limit, offset } = parsePagination(req.query);
  const { podId, search, status } = req.query;

  // Get PODs managed by this user
  let podIds = [];
  
  if (user.role === User.UserRoles.ADMIN) {
    // Admin can see all PODs
    podIds = getAllPods().map((p) => p.id);
  } else {
    // Manager can only see their PODs
    const managedPods = getPodsByManager(user.email);
    podIds = managedPods.map((p) => p.id);
  }

  // Filter by specific POD if requested
  if (podId) {
    if (!podIds.includes(podId)) {
      return response.error(res, 'Access denied to this POD', 403, 'FORBIDDEN');
    }
    podIds = [podId];
  }

  if (podIds.length === 0) {
    return response.paginated(res, [], { page, limit, total: 0 });
  }

  const filterStatus = status || 'pending';

  const [requests, total] = await Promise.all([
    QueryRequest.findByPodIds(podIds, { status: filterStatus, limit, offset }),
    QueryRequest.count({ podIds, status: filterStatus }),
  ]);

  return response.paginated(res, requests, { page, limit, total });
};

/**
 * Approve a request
 * POST /api/requests/:uuid/approve
 * 
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
const approveRequest = async (req, res) => {
  const { uuid } = req.params;
  const user = req.user;

  // SECURE: Use UUID lookup only
  const queryRequest = await QueryRequest.findByUuid(uuid);
  
  if (!queryRequest) {
    return response.error(res, 'Request not found', 404, 'NOT_FOUND');
  }

  // Check if request is pending
  if (queryRequest.status !== QueryRequest.RequestStatus.PENDING) {
    return response.error(res, 'Request is not pending approval', 400, 'INVALID_STATUS');
  }

  // Check authorization for managers
  /* istanbul ignore if */
  if (user.role === User.UserRoles.MANAGER) {
    const managedPods = getPodsByManager(user.email);
    const podIds = managedPods.map((p) => p.id);
    
    if (!podIds.includes(queryRequest.podId)) {
      return response.error(res, 'Not authorized to approve this request', 403, 'FORBIDDEN');
    }
  }

  // Use the internal ID from the fetched request for database updates
  const internalId = queryRequest.id;

  // Approve the request
  let approvedRequest = await QueryRequest.approve(internalId, user.id, user.email);

  logger.info('Request approved', { requestId: internalId, uuid, approverId: user.id });

  // Execute the query/script
  try {
    // Mark as executing
    await QueryRequest.markExecuting(internalId);

    let result;
    
    if (queryRequest.submissionType === 'query') {
      result = await queryExecutionService.executeQuery(queryRequest);
    } else {
      result = await scriptExecutionService.executeScript(queryRequest);
    }

    // Format result
    const resultStr = JSON.stringify(result, null, 2);

    // Mark as completed
    approvedRequest = await QueryRequest.markCompleted(internalId, resultStr);

    // Get requester for Slack notification
    const requester = await User.findById(queryRequest.userId);

    // Send success notification
    await slackService.notifyApprovalSuccess(
      { ...approvedRequest, slackUserId: requester?.slackUserId },
      resultStr
    );

    logger.info('Query executed successfully', { requestId: internalId, uuid });

    return response.success(res, {
      ...approvedRequest,
      executionResult: result,
    }, 'Request approved and executed successfully');

  } catch (error) {
    // Mark as failed
    const errorMessage = error.message || 'Execution failed';
    approvedRequest = await QueryRequest.markFailed(internalId, errorMessage);

    // Get requester for Slack notification
    const requester = await User.findById(queryRequest.userId);

    // Send failure notification
    await slackService.notifyApprovalFailure(
      { ...approvedRequest, slackUserId: requester?.slackUserId },
      errorMessage
    );

    logger.error('Query execution failed', { requestId: internalId, uuid, error: errorMessage });

    return response.success(res, approvedRequest, 'Request approved but execution failed');
  }
};

/**
 * Reject a request
 * POST /api/requests/:uuid/reject
 * 
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
const rejectRequest = async (req, res) => {
  const { uuid } = req.params;
  const { reason } = req.body;
  const user = req.user;

  // SECURE: Use UUID lookup only
  const queryRequest = await QueryRequest.findByUuid(uuid);
  
  if (!queryRequest) {
    return response.error(res, 'Request not found', 404, 'NOT_FOUND');
  }

  // Check if request is pending
  if (queryRequest.status !== QueryRequest.RequestStatus.PENDING) {
    return response.error(res, 'Request is not pending approval', 400, 'INVALID_STATUS');
  }

  // Check authorization for managers
  /* istanbul ignore if */
  if (user.role === User.UserRoles.MANAGER) {
    const managedPods = getPodsByManager(user.email);
    const podIds = managedPods.map((p) => p.id);
    
    if (!podIds.includes(queryRequest.podId)) {
      return response.error(res, 'Not authorized to reject this request', 403, 'FORBIDDEN');
    }
  }

  // Use the internal ID from the fetched request for database updates
  const internalId = queryRequest.id;

  // Reject the request
  const rejectedRequest = await QueryRequest.reject(internalId, user.id, user.email, reason);

  // Get requester for Slack notification
  const requester = await User.findById(queryRequest.userId);

  // Send rejection notification
  await slackService.notifyRejection({
    ...rejectedRequest,
    slackUserId: requester?.slackUserId,
  });

  logger.info('Request rejected', { requestId: internalId, uuid, rejectorId: user.id, reason });

  return response.success(res, rejectedRequest, 'Request rejected');
};

/**
 * Clone a request (re-submit)
 * POST /api/requests/:uuid/clone
 * 
 * SECURITY: Uses UUID lookup to prevent enumeration attacks
 */
const cloneRequest = async (req, res) => {
  const { uuid } = req.params;
  const user = req.user;

  // SECURE: Use UUID lookup only
  const originalRequest = await QueryRequest.findByUuid(uuid);
  
  if (!originalRequest) {
    return response.error(res, 'Request not found', 404, 'NOT_FOUND');
  }

  // Only allow cloning own requests
  if (originalRequest.userId !== user.id) {
    return response.error(res, 'Can only clone your own requests', 403, 'FORBIDDEN');
  }

  // Create new request with same data
  const newRequest = await QueryRequest.create({
    userId: user.id,
    databaseType: originalRequest.databaseType,
    instanceId: originalRequest.instanceId,
    instanceName: originalRequest.instanceName,
    databaseName: originalRequest.databaseName,
    submissionType: originalRequest.submissionType,
    queryContent: originalRequest.queryContent,
    scriptFilename: originalRequest.scriptFilename,
    scriptContent: originalRequest.scriptContent,
    comments: `[Cloned from ${originalRequest.uuid}] ${originalRequest.comments}`,
    podId: originalRequest.podId,
    podName: originalRequest.podName,
  });

  // Send notification
  const fullRequest = await QueryRequest.findById(newRequest.id);
  await slackService.notifyNewSubmission({
    ...fullRequest,
    slackUserId: user.slackUserId,
  });

  logger.info('Request cloned', { originalUuid: uuid, newId: newRequest.id, newUuid: newRequest.uuid, userId: user.id });

  return response.created(res, {
    id: newRequest.id,
    uuid: newRequest.uuid,
    status: newRequest.status,
    createdAt: newRequest.createdAt,
  }, 'Request cloned successfully');
};

/**
 * Get all requests (Admin view)
 * GET /api/requests
 */
const getAllRequests = async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, podId, databaseType, submissionType, search, startDate, endDate } = req.query;

  const [requests, total] = await Promise.all([
    QueryRequest.findAll({
      status,
      podId,
      databaseType,
      submissionType,
      search,
      startDate,
      endDate,
      limit,
      offset,
    }),
    QueryRequest.count({ status, podId }),
  ]);

  return response.paginated(res, requests, { page, limit, total });
};

/**
 * Get query statistics (Admin only)
 * GET /api/queries/stats
 */
const getStats = async (req, res) => {
  try {
    // Get overall stats by status
    const overallStats = await QueryRequest.getStatusCounts();
    
    // Get stats by POD
    const podStats = await QueryRequest.getStatsByPod();
    
    // Get stats by database type
    const typeStats = await QueryRequest.getStatsByDatabaseType();
    
    // Get recent activity (last 7 days)
    const recentActivity = await QueryRequest.getRecentActivity(7);

    return response.success(res, {
      overall: overallStats,
      byPod: podStats,
      byType: typeStats,
      recentActivity,
    });
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message });
    return response.error(res, 'Failed to fetch statistics', 500, 'STATS_ERROR');
  }
};

/**
 * Get available instances
 * GET /api/instances
 */
const getInstances = async (req, res) => {
  const { type } = req.query;

  let instances;
  if (type) {
    instances = getInstancesByType(type);
  } else {
    instances = getAllInstances();
  }

  return response.success(res, instances);
};

/**
 * Get databases for an instance
 * GET /api/instances/:instanceId/databases
 */
const getDatabases = async (req, res) => {
  const { instanceId } = req.params;

  const instance = getInstanceById(instanceId);
  if (!instance) {
    return response.error(res, 'Instance not found', 404, 'NOT_FOUND');
  }

  const databases = getDatabasesForInstance(instanceId);

  return response.success(res, {
    instanceId,
    instanceName: instance.name,
    type: instance.type,
    databases,
  });
};

/**
 * Get available PODs
 * GET /api/pods
 */
const getPods = async (req, res) => {
  const pods = getAllPods();
  return response.success(res, pods);
};

module.exports = {
  submitRequest,
  getRequest,
  getMyRequests,
  getMyStatusCounts,
  getPendingRequests,
  approveRequest,
  rejectRequest,
  cloneRequest,
  getAllRequests,
  getStats,  // <-- Added
  getInstances,
  getDatabases,
  getPods,
};