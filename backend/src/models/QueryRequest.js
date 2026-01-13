/**
 * QueryRequest Model
 * Database operations for query/script submission management
 * 
 * REFACTORED with:
 * - DRY principle: Common query builder for all find operations
 * - Field-based filtering: Dynamic filter application using field mapping
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { DatabaseError, NotFoundError } = require('../utils/errors');

/**
 * Request status enum
 */
const RequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Submission type enum
 */
const SubmissionType = {
  QUERY: 'query',
  SCRIPT: 'script',
};

/**
 * Database type enum
 */
const DatabaseType = {
  POSTGRESQL: 'postgresql',
  MONGODB: 'mongodb',
};

// ============================================================================
// DRY QUERY BUILDER (Phase 1 Refactoring)
// ============================================================================

/**
 * Base SELECT query with user join
 * Used by all find operations to avoid duplication
 */
const BASE_SELECT = `
  SELECT qr.*, u.email as user_email, u.name as user_name
  FROM query_requests qr
  JOIN users u ON qr.user_id = u.id
`;

/**
 * Filter field mapping for dynamic query building
 * Maps filter keys to their database columns and operators
 */
const FILTER_FIELDS = {
  status: { column: 'qr.status', operator: '=' },
  podId: { column: 'qr.pod_id', operator: '=' },
  userId: { column: 'qr.user_id', operator: '=' },
  databaseType: { column: 'qr.database_type', operator: '=' },
  submissionType: { column: 'qr.submission_type', operator: '=' },
  startDate: { column: 'qr.created_at', operator: '>=' },
  endDate: { column: 'qr.created_at', operator: '<=' },
};

/**
 * Build a query with dynamic WHERE clauses
 * DRY helper to reduce code duplication across find functions
 * 
 * @param {Object} options - Query building options
 * @param {Array} options.where - Array of WHERE clause strings
 * @param {Array} options.params - Array of parameter values
 * @param {string} options.orderBy - ORDER BY clause
 * @param {number} options.limit - LIMIT value
 * @param {number} options.offset - OFFSET value
 * @returns {Object} { sql, params }
 */
const buildQuery = ({ where = [], params = [], orderBy = 'qr.created_at DESC', limit, offset }) => {
  let sql = BASE_SELECT;
  const finalParams = [...params];
  
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  
  sql += ` ORDER BY ${orderBy}`;
  
  if (limit !== undefined) {
    finalParams.push(limit);
    sql += ` LIMIT $${finalParams.length}`;
  }
  
  if (offset !== undefined) {
    finalParams.push(offset);
    sql += ` OFFSET $${finalParams.length}`;
  }
  
  return { sql, params: finalParams };
};

/**
 * Apply filters dynamically using FILTER_FIELDS mapping
 * Reduces repetitive if blocks in findAll
 * 
 * @param {Object} filters - Filter object
 * @returns {Object} { where, params }
 */
const applyFilters = (filters) => {
  const where = [];
  const params = [];
  
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    
    const fieldConfig = FILTER_FIELDS[key];
    if (!fieldConfig) continue;
    
    params.push(value);
    where.push(`${fieldConfig.column} ${fieldConfig.operator} $${params.length}`);
  }
  
  return { where, params };
};

// ============================================================================
// TABLE CREATION
// ============================================================================

/**
 * Create query_requests table if not exists
 */
const createTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS query_requests (
      id SERIAL PRIMARY KEY,
      uuid UUID UNIQUE DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      database_type VARCHAR(50) NOT NULL,
      instance_id VARCHAR(100) NOT NULL,
      instance_name VARCHAR(255) NOT NULL,
      database_name VARCHAR(255) NOT NULL,
      submission_type VARCHAR(50) NOT NULL,
      query_content TEXT,
      script_filename VARCHAR(255),
      script_content TEXT,
      comments TEXT NOT NULL,
      pod_id VARCHAR(50) NOT NULL,
      pod_name VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      approver_id UUID REFERENCES users(id),
      approver_email VARCHAR(255),
      approved_at TIMESTAMP WITH TIME ZONE,
      rejection_reason TEXT,
      execution_result TEXT,
      execution_error TEXT,
      execution_started_at TIMESTAMP WITH TIME ZONE,
      execution_completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_query_requests_user_id ON query_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_query_requests_status ON query_requests(status);
    CREATE INDEX IF NOT EXISTS idx_query_requests_pod_id ON query_requests(pod_id);
    CREATE INDEX IF NOT EXISTS idx_query_requests_created_at ON query_requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_query_requests_uuid ON query_requests(uuid);
  `;

  try {
    await query(sql);
    logger.info('QueryRequests table created/verified');
  } catch (error) {
    logger.error('Failed to create query_requests table', { error: error.message });
    throw new DatabaseError('Failed to create query_requests table');
  }
};

// ============================================================================
// CREATE OPERATION
// ============================================================================

/**
 * Create a new query request
 * @param {Object} requestData - Request data
 * @returns {Object} Created request
 */
/* istanbul ignore next */
const create = async ({
  userId,
  databaseType,
  instanceId,
  instanceName,
  databaseName,
  submissionType,
  queryContent = null,
  scriptFilename = null,
  scriptContent = null,
  comments,
  podId,
  podName,
}) => {
  const sql = `
    INSERT INTO query_requests (
      user_id, database_type, instance_id, instance_name, database_name,
      submission_type, query_content, script_filename, script_content,
      comments, pod_id, pod_name
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;

  try {
    const result = await query(sql, [
      userId,
      databaseType,
      instanceId,
      instanceName,
      databaseName,
      submissionType,
      queryContent,
      scriptFilename,
      scriptContent,
      comments,
      podId,
      podName,
    ]);
    logger.info('Query request created', { requestId: result.rows[0].id });
    return mapRequestRow(result.rows[0]);
  } catch (error) {
    logger.error('Failed to create query request', { error: error.message });
    throw new DatabaseError('Failed to create query request');
  }
};

// ============================================================================
// FIND OPERATIONS (DRY Refactored)
// ============================================================================

/**
 * Find request by ID
 * Uses DRY query builder
 * @param {number} id - Request ID
 * @returns {Object|null} Request or null
 */
const findById = async (id) => {
  const { sql, params } = buildQuery({
    where: ['qr.id = $1'],
    params: [id],
  });

  try {
    const result = await query(sql, params);
    if (result.rows.length === 0) return null;
    return mapRequestRow(result.rows[0]);
  } catch (error) {
    logger.error('Failed to find request by ID', { error: error.message });
    throw new DatabaseError('Failed to find request');
  }
};

/**
 * Find request by UUID
 * Uses DRY query builder
 * @param {string} uuid - Request UUID
 * @returns {Object|null} Request or null
 */
const findByUuid = async (uuid) => {
  const { sql, params } = buildQuery({
    where: ['qr.uuid = $1'],
    params: [uuid],
  });

  try {
    const result = await query(sql, params);
    if (result.rows.length === 0) return null;
    return mapRequestRow(result.rows[0]);
  } catch (error) {
    logger.error('Failed to find request by UUID', { error: error.message });
    throw new DatabaseError('Failed to find request');
  }
};

/**
 * Find requests by user ID
 * Uses DRY query builder with dynamic filters
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Array} Array of requests
 */
const findByUserId = async (userId, { status = null, limit = 50, offset = 0 } = {}) => {
  const where = ['qr.user_id = $1'];
  const params = [userId];
  
  if (status) {
    params.push(status);
    where.push(`qr.status = $${params.length}`);
  }
  
  const { sql, params: finalParams } = buildQuery({
    where,
    params,
    limit,
    offset,
  });

  try {
    const result = await query(sql, finalParams);
    return result.rows.map(mapRequestRow);
  } catch (error) {
    logger.error('Failed to find requests by user ID', { error: error.message });
    throw new DatabaseError('Failed to find requests');
  }
};

/**
 * Find requests by POD IDs (for managers)
 * Uses DRY query builder with dynamic filters
 * @param {Array} podIds - Array of POD IDs
 * @param {Object} options - Query options
 * @returns {Array} Array of requests
 */
const findByPodIds = async (podIds, { status = null, limit = 50, offset = 0 } = {}) => {
  const where = ['qr.pod_id = ANY($1)'];
  const params = [podIds];
  
  if (status) {
    params.push(status);
    where.push(`qr.status = $${params.length}`);
  }
  
  const { sql, params: finalParams } = buildQuery({
    where,
    params,
    limit,
    offset,
  });

  try {
    const result = await query(sql, finalParams);
    return result.rows.map(mapRequestRow);
  } catch (error) {
    logger.error('Failed to find requests by POD IDs', { error: error.message });
    throw new DatabaseError('Failed to find requests');
  }
};

/**
 * Find all requests with filters
 * REFACTORED: Uses field-based filtering instead of multiple if blocks
 * @param {Object} filters - Filter options
 * @returns {Array} Array of requests
 */
const findAll = async ({
  status = null,
  podId = null,
  userId = null,
  databaseType = null,
  submissionType = null,
  search = null,
  startDate = null,
  endDate = null,
  limit = 50,
  offset = 0,
} = {}) => {
  // Apply standard filters using field mapping (DRY)
  const { where, params } = applyFilters({
    status,
    podId,
    userId,
    databaseType,
    submissionType,
    startDate,
    endDate,
  });
  
  // Handle special search filter (requires ILIKE across multiple columns)
  if (search) {
    params.push(`%${search}%`);
    where.push(`(qr.comments ILIKE $${params.length} OR qr.query_content ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  
  // Build final query with WHERE 1=1 pattern for empty filters
  let sql = BASE_SELECT + ' WHERE 1=1';
  
  if (where.length > 0) {
    sql += ' AND ' + where.join(' AND ');
  }
  
  sql += ' ORDER BY qr.created_at DESC';
  
  params.push(limit);
  sql += ` LIMIT $${params.length}`;
  
  params.push(offset);
  sql += ` OFFSET $${params.length}`;

  try {
    const result = await query(sql, params);
    return result.rows.map(mapRequestRow);
  } catch (error) {
    logger.error('Failed to find requests', { error: error.message });
    throw new DatabaseError('Failed to find requests');
  }
};

// ============================================================================
// COUNT OPERATION
// ============================================================================

/**
 * Count requests with filters
 * @param {Object} filters - Filter options
 * @returns {number} Count
 */
const count = async ({
  status = null,
  podId = null,
  userId = null,
  podIds = null,
} = {}) => {
  let sql = 'SELECT COUNT(*) as count FROM query_requests WHERE 1=1';
  const params = [];

  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }

  if (podId) {
    params.push(podId);
    sql += ` AND pod_id = $${params.length}`;
  }

  if (userId) {
    params.push(userId);
    sql += ` AND user_id = $${params.length}`;
  }

  if (podIds && podIds.length > 0) {
    params.push(podIds);
    sql += ` AND pod_id = ANY($${params.length})`;
  }

  try {
    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Failed to count requests', { error: error.message });
    throw new DatabaseError('Failed to count requests');
  }
};

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

/**
 * Update request status
 * @param {number} id - Request ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data to update
 * @returns {Object} Updated request
 */
const updateStatus = async (id, status, additionalData = {}) => {
  const updateFields = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [id, status];

  if (additionalData.approverId) {
    params.push(additionalData.approverId);
    updateFields.push(`approver_id = $${params.length}`);
  }

  if (additionalData.approverEmail) {
    params.push(additionalData.approverEmail);
    updateFields.push(`approver_email = $${params.length}`);
  }

  if (status === RequestStatus.APPROVED) {
    updateFields.push('approved_at = CURRENT_TIMESTAMP');
  }

  if (additionalData.rejectionReason !== undefined) {
    params.push(additionalData.rejectionReason);
    updateFields.push(`rejection_reason = $${params.length}`);
  }

  if (additionalData.executionResult !== undefined) {
    params.push(additionalData.executionResult);
    updateFields.push(`execution_result = $${params.length}`);
  }

  if (additionalData.executionError !== undefined) {
    params.push(additionalData.executionError);
    updateFields.push(`execution_error = $${params.length}`);
  }

  if (status === RequestStatus.EXECUTING) {
    updateFields.push('execution_started_at = CURRENT_TIMESTAMP');
  }

  if (status === RequestStatus.COMPLETED || status === RequestStatus.FAILED) {
    updateFields.push('execution_completed_at = CURRENT_TIMESTAMP');
  }

  const sql = `
    UPDATE query_requests SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  try {
    const result = await query(sql, params);
    if (result.rows.length === 0) {
      throw new NotFoundError('Request not found');
    }
    logger.info('Request status updated', { requestId: id, status });
    return mapRequestRow(result.rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Failed to update request status', { error: error.message });
    throw new DatabaseError('Failed to update request status');
  }
};

/**
 * Approve request
 */
const approve = async (id, approverId, approverEmail) => {
  return updateStatus(id, RequestStatus.APPROVED, { approverId, approverEmail });
};

/**
 * Reject request
 */
const reject = async (id, approverId, approverEmail, reason = null) => {
  return updateStatus(id, RequestStatus.REJECTED, {
    approverId,
    approverEmail,
    rejectionReason: reason,
  });
};

/**
 * Mark request as executing
 */
const markExecuting = async (id) => {
  return updateStatus(id, RequestStatus.EXECUTING);
};

/**
 * Mark request as completed
 */
const markCompleted = async (id, result) => {
  return updateStatus(id, RequestStatus.COMPLETED, { executionResult: result });
};

/**
 * Mark request as failed
 */
const markFailed = async (id, error) => {
  return updateStatus(id, RequestStatus.FAILED, { executionError: error });
};

// ============================================================================
// STATS FUNCTIONS (for admin dashboard)
// ============================================================================

/**
 * Get overall status counts
 */
const getStatusCounts = async () => {
  const sql = `
    SELECT status, COUNT(*) as count
    FROM query_requests
    GROUP BY status
  `;

  try {
    const result = await query(sql);
    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    result.rows.forEach((row) => {
      counts[row.status] = parseInt(row.count, 10);
      counts.total += parseInt(row.count, 10);
    });

    return counts;
  } catch (error) {
    logger.error('Failed to get status counts', { error: error.message });
    throw new DatabaseError('Failed to get status counts');
  }
};

/**
 * Get status counts for a user
 */
const getStatusCountsByUser = async (userId) => {
  const sql = `
    SELECT status, COUNT(*) as count
    FROM query_requests
    WHERE user_id = $1
    GROUP BY status
  `;

  try {
    const result = await query(sql, [userId]);
    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    result.rows.forEach((row) => {
      counts[row.status] = parseInt(row.count, 10);
      counts.total += parseInt(row.count, 10);
    });

    return counts;
  } catch (error) {
    logger.error('Failed to get status counts', { error: error.message });
    throw new DatabaseError('Failed to get status counts');
  }
};

/**
 * Get stats grouped by POD
 */
const getStatsByPod = async () => {
  const sql = `
    SELECT pod_id, pod_name, status, COUNT(*) as count
    FROM query_requests
    GROUP BY pod_id, pod_name, status
    ORDER BY pod_name, status
  `;

  try {
    const result = await query(sql);
    const byPod = {};

    result.rows.forEach((row) => {
      if (!byPod[row.pod_id]) {
        byPod[row.pod_id] = {
          name: row.pod_name,
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          executing: 0,
          completed: 0,
          failed: 0,
        };
      }
      byPod[row.pod_id][row.status] = parseInt(row.count, 10);
      byPod[row.pod_id].total += parseInt(row.count, 10);
    });

    return byPod;
  } catch (error) {
    logger.error('Failed to get stats by POD', { error: error.message });
    throw new DatabaseError('Failed to get stats by POD');
  }
};

/**
 * Get stats grouped by database type
 */
const getStatsByDatabaseType = async () => {
  const sql = `
    SELECT database_type, status, COUNT(*) as count
    FROM query_requests
    GROUP BY database_type, status
  `;

  try {
    const result = await query(sql);
    const byType = {
      postgresql: { total: 0, pending: 0, completed: 0, rejected: 0, failed: 0 },
      mongodb: { total: 0, pending: 0, completed: 0, rejected: 0, failed: 0 },
    };

    result.rows.forEach((row) => {
      if (!byType[row.database_type]) {
        byType[row.database_type] = { total: 0 };
      }
      byType[row.database_type][row.status] = parseInt(row.count, 10);
      byType[row.database_type].total += parseInt(row.count, 10);
    });

    return byType;
  } catch (error) {
    logger.error('Failed to get stats by database type', { error: error.message });
    throw new DatabaseError('Failed to get stats by database type');
  }
};

/**
 * Get recent activity (requests per day)
 */
const getRecentActivity = async (days = 7) => {
  const sql = `
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM query_requests
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  try {
    const result = await query(sql);
    return result.rows.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    }));
  } catch (error) {
    logger.error('Failed to get recent activity', { error: error.message });
    throw new DatabaseError('Failed to get recent activity');
  }
};

// ============================================================================
// ROW MAPPER
// ============================================================================

/**
 * Map database row to request object
 */
const mapRequestRow = (row) => ({
  id: row.id,
  uuid: row.uuid,
  userId: row.user_id,
  userEmail: row.user_email,
  userName: row.user_name,
  databaseType: row.database_type,
  instanceId: row.instance_id,
  instanceName: row.instance_name,
  databaseName: row.database_name,
  submissionType: row.submission_type,
  queryContent: row.query_content,
  scriptFilename: row.script_filename,
  scriptContent: row.script_content,
  comments: row.comments,
  podId: row.pod_id,
  podName: row.pod_name,
  status: row.status,
  approverId: row.approver_id,
  approverEmail: row.approver_email,
  approvedAt: row.approved_at,
  rejectionReason: row.rejection_reason,
  executionResult: row.execution_result,
  executionError: row.execution_error,
  executionStartedAt: row.execution_started_at,
  executionCompletedAt: row.execution_completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Enums
  RequestStatus,
  SubmissionType,
  DatabaseType,
  // Table
  createTable,
  // CRUD
  create,
  findById,
  findByUuid,
  findByUserId,
  findByPodIds,
  findAll,
  count,
  // Status updates
  updateStatus,
  approve,
  reject,
  markExecuting,
  markCompleted,
  markFailed,
  // Stats
  getStatusCounts,
  getStatusCountsByUser,
  getStatsByPod,
  getStatsByDatabaseType,
  getRecentActivity,
  // Internal helpers (exported for testing)
  _internal: {
    buildQuery,
    applyFilters,
    FILTER_FIELDS,
    BASE_SELECT,
  },
};
