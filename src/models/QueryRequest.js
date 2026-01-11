/**
 * QueryRequest Model
 * Database operations for query/script submission management
 */

const { query, transaction } = require('../config/database');
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

/**
 * Find request by ID
 * @param {number} id - Request ID
 * @returns {Object|null} Request or null
 */
const findById = async (id) => {
  const sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE qr.id = $1
  `;

  try {
    const result = await query(sql, [id]);
    if (result.rows.length === 0) return null;
    return mapRequestRow(result.rows[0]);
  } catch (error) {
    logger.error('Failed to find request by ID', { error: error.message });
    throw new DatabaseError('Failed to find request');
  }
};

/**
 * Find request by UUID
 * @param {string} uuid - Request UUID
 * @returns {Object|null} Request or null
 */
const findByUuid = async (uuid) => {
  const sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE qr.uuid = $1
  `;

  try {
    const result = await query(sql, [uuid]);
    if (result.rows.length === 0) return null;
    return mapRequestRow(result.rows[0]);
  } catch (error) {
    logger.error('Failed to find request by UUID', { error: error.message });
    throw new DatabaseError('Failed to find request');
  }
};

/**
 * Find requests by user ID
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Array} Array of requests
 */
const findByUserId = async (userId, { status = null, limit = 50, offset = 0 } = {}) => {
  let sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE qr.user_id = $1
  `;
  const params = [userId];
  let paramIndex = 2;

  if (status) {
    sql += ` AND qr.status = $${paramIndex++}`;
    params.push(status);
  }

  sql += ` ORDER BY qr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  try {
    const result = await query(sql, params);
    return result.rows.map(mapRequestRow);
  } catch (error) {
    logger.error('Failed to find requests by user ID', { error: error.message });
    throw new DatabaseError('Failed to find requests');
  }
};

/**
 * Find requests by POD IDs (for managers)
 * @param {Array} podIds - Array of POD IDs
 * @param {Object} options - Query options
 * @returns {Array} Array of requests
 */
const findByPodIds = async (podIds, { status = null, limit = 50, offset = 0 } = {}) => {
  let sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE qr.pod_id = ANY($1)
  `;
  const params = [podIds];
  let paramIndex = 2;

  if (status) {
    sql += ` AND qr.status = $${paramIndex++}`;
    params.push(status);
  }

  sql += ` ORDER BY qr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  try {
    const result = await query(sql, params);
    return result.rows.map(mapRequestRow);
  } catch (error) {
    logger.error('Failed to find requests by POD IDs', { error: error.message });
    throw new DatabaseError('Failed to find requests');
  }
};

/**
 * Find all requests with filters
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
  let sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND qr.status = $${paramIndex++}`;
    params.push(status);
  }

  if (podId) {
    sql += ` AND qr.pod_id = $${paramIndex++}`;
    params.push(podId);
  }

  if (userId) {
    sql += ` AND qr.user_id = $${paramIndex++}`;
    params.push(userId);
  }

  if (databaseType) {
    sql += ` AND qr.database_type = $${paramIndex++}`;
    params.push(databaseType);
  }

  if (submissionType) {
    sql += ` AND qr.submission_type = $${paramIndex++}`;
    params.push(submissionType);
  }

  if (search) {
    sql += ` AND (qr.comments ILIKE $${paramIndex} OR qr.query_content ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (startDate) {
    sql += ` AND qr.created_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND qr.created_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  sql += ` ORDER BY qr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  try {
    const result = await query(sql, params);
    return result.rows.map(mapRequestRow);
  } catch (error) {
    logger.error('Failed to find requests', { error: error.message });
    throw new DatabaseError('Failed to find requests');
  }
};

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
  let paramIndex = 1;

  if (status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  if (podId) {
    sql += ` AND pod_id = $${paramIndex++}`;
    params.push(podId);
  }

  if (userId) {
    sql += ` AND user_id = $${paramIndex++}`;
    params.push(userId);
  }

  if (podIds && podIds.length > 0) {
    sql += ` AND pod_id = ANY($${paramIndex++})`;
    params.push(podIds);
  }

  try {
    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Failed to count requests', { error: error.message });
    throw new DatabaseError('Failed to count requests');
  }
};

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
  let paramIndex = 3;

  if (additionalData.approverId) {
    updateFields.push(`approver_id = $${paramIndex++}`);
    params.push(additionalData.approverId);
  }

  if (additionalData.approverEmail) {
    updateFields.push(`approver_email = $${paramIndex++}`);
    params.push(additionalData.approverEmail);
  }

  if (status === RequestStatus.APPROVED) {
    updateFields.push('approved_at = CURRENT_TIMESTAMP');
  }

  if (additionalData.rejectionReason !== undefined) {
    updateFields.push(`rejection_reason = $${paramIndex++}`);
    params.push(additionalData.rejectionReason);
  }

  if (additionalData.executionResult !== undefined) {
    updateFields.push(`execution_result = $${paramIndex++}`);
    params.push(additionalData.executionResult);
  }

  if (additionalData.executionError !== undefined) {
    updateFields.push(`execution_error = $${paramIndex++}`);
    params.push(additionalData.executionError);
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
 * @param {number} id - Request ID
 * @param {string} approverId - Approver user ID
 * @param {string} approverEmail - Approver email
 * @returns {Object} Updated request
 */
const approve = async (id, approverId, approverEmail) => {
  return updateStatus(id, RequestStatus.APPROVED, { approverId, approverEmail });
};

/**
 * Reject request
 * @param {number} id - Request ID
 * @param {string} approverId - Approver user ID
 * @param {string} approverEmail - Approver email
 * @param {string} reason - Rejection reason
 * @returns {Object} Updated request
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
 * @param {number} id - Request ID
 * @returns {Object} Updated request
 */
const markExecuting = async (id) => {
  return updateStatus(id, RequestStatus.EXECUTING);
};

/**
 * Mark request as completed
 * @param {number} id - Request ID
 * @param {string} result - Execution result
 * @returns {Object} Updated request
 */
const markCompleted = async (id, result) => {
  return updateStatus(id, RequestStatus.COMPLETED, { executionResult: result });
};

/**
 * Mark request as failed
 * @param {number} id - Request ID
 * @param {string} error - Error message
 * @returns {Object} Updated request
 */
const markFailed = async (id, error) => {
  return updateStatus(id, RequestStatus.FAILED, { executionError: error });
};

// ============================================================================
// STATS FUNCTIONS (for admin dashboard)
// ============================================================================

/**
 * Get overall status counts
 * @returns {Object} Status counts
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
 * @param {string} userId - User ID
 * @returns {Object} Status counts
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
 * @returns {Object} Stats by POD
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
 * @returns {Object} Stats by database type
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
 * @param {number} days - Number of days to look back
 * @returns {Array} Daily request counts
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

/**
 * Map database row to request object
 * @param {Object} row - Database row
 * @returns {Object} Mapped request
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

module.exports = {
  RequestStatus,
  SubmissionType,
  DatabaseType,
  createTable,
  create,
  findById,
  findByUuid,
  findByUserId,
  findByPodIds,
  findAll,
  count,
  updateStatus,
  approve,
  reject,
  markExecuting,
  markCompleted,
  markFailed,
  getStatusCounts,
  getStatusCountsByUser,
  getStatsByPod,
  getStatsByDatabaseType,
  getRecentActivity,
};