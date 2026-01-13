/**
 * Session Model (Refresh Tokens)
 * Database operations for session/refresh token management
 * 
 * This model handles all database operations for refresh tokens,
 * following the DAL (Data Access Layer) separation principle.
 */

const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const { DatabaseError, NotFoundError } = require('../utils/errors');

/**
 * Create a new refresh token session
 * @param {Object} sessionData - Session data
 * @returns {Object} Created session
 */
const create = async ({ userId, tokenHash, deviceInfo = null, ipAddress = null, expiresAt }) => {
  const sql = `
    INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, device_info, ip_address, created_at, expires_at
  `;

  try {
    const result = await query(sql, [userId, tokenHash, deviceInfo, ipAddress, expiresAt]);
    logger.debug('Refresh token session created', { userId });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create refresh token session', { error: error.message });
    throw new DatabaseError('Failed to create session');
  }
};

/**
 * Find valid refresh token with user data
 * @param {string} tokenHash - Hashed refresh token
 * @returns {Object|null} Token data with user info or null
 */
const findValidTokenWithUser = async (tokenHash) => {
  const sql = `
    SELECT rt.*, u.id as user_id, u.email, u.name, u.role, u.pod_id, u.is_active
    FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token_hash = $1 
      AND rt.is_revoked = false 
      AND rt.expires_at > CURRENT_TIMESTAMP
  `;

  try {
    const result = await query(sql, [tokenHash]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to find refresh token', { error: error.message });
    throw new DatabaseError('Failed to find session');
  }
};

/**
 * Revoke a refresh token by hash
 * @param {string} tokenHash - Hashed refresh token
 * @returns {Object|null} Revoked token info or null if not found
 */
const revokeByHash = async (tokenHash) => {
  const sql = `
    UPDATE refresh_tokens 
    SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = $1 AND is_revoked = false
    RETURNING user_id
  `;

  try {
    const result = await query(sql, [tokenHash]);
    if (result.rowCount === 0) return null;
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to revoke refresh token', { error: error.message });
    throw new DatabaseError('Failed to revoke session');
  }
};

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 * @returns {number} Number of sessions revoked
 */
const revokeAllForUser = async (userId) => {
  const sql = `
    UPDATE refresh_tokens 
    SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND is_revoked = false
    RETURNING id
  `;

  try {
    const result = await query(sql, [userId]);
    logger.info('Revoked all sessions for user', { userId, count: result.rowCount });
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to revoke all sessions', { error: error.message });
    throw new DatabaseError('Failed to revoke sessions');
  }
};

/**
 * Revoke a specific session by ID for a user
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if revoked, false if not found
 */
const revokeById = async (userId, sessionId) => {
  const sql = `
    UPDATE refresh_tokens 
    SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2 AND is_revoked = false
    RETURNING id
  `;

  try {
    const result = await query(sql, [sessionId, userId]);
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Failed to revoke session', { error: error.message });
    throw new DatabaseError('Failed to revoke session');
  }
};

/**
 * Get active sessions for a user
 * @param {string} userId - User ID
 * @returns {Array} Active sessions
 */
const getActiveForUser = async (userId) => {
  const sql = `
    SELECT id, device_info, ip_address, created_at, expires_at
    FROM refresh_tokens
    WHERE user_id = $1 
      AND is_revoked = false 
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
  `;

  try {
    const result = await query(sql, [userId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get active sessions', { error: error.message });
    throw new DatabaseError('Failed to get sessions');
  }
};

/**
 * Clean up expired and revoked tokens
 * @returns {number} Number of tokens deleted
 */
const cleanupExpired = async () => {
  const sql = `
    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = true
    RETURNING id
  `;

  try {
    const result = await query(sql);
    logger.info('Cleaned up expired tokens', { count: result.rowCount });
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', { error: error.message });
    throw new DatabaseError('Failed to cleanup tokens');
  }
};

/**
 * Validate and refresh token atomically (with transaction)
 * This ensures the token validation and any updates happen atomically
 * @param {string} tokenHash - Hashed refresh token
 * @param {Function} onValidToken - Callback when token is valid, receives tokenData
 * @returns {Object} Result from callback or error object
 */
const validateTokenWithTransaction = async (tokenHash, onValidToken) => {
  return transaction(async (client) => {
    // Find valid token within transaction
    const findSql = `
      SELECT rt.*, u.id as user_id, u.email, u.name, u.role, u.pod_id, u.is_active
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = $1 
        AND rt.is_revoked = false 
        AND rt.expires_at > CURRENT_TIMESTAMP
      FOR UPDATE
    `;
    
    const result = await client.query(findSql, [tokenHash]);
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid or expired refresh token' };
    }

    const tokenData = result.rows[0];

    // Check if user is still active
    if (!tokenData.is_active) {
      // Revoke the token since user is disabled
      await client.query(
        'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1',
        [tokenHash]
      );
      return { valid: false, error: 'Account is disabled' };
    }

    // Call the callback with valid token data
    return onValidToken(tokenData, client);
  });
};

module.exports = {
  create,
  findValidTokenWithUser,
  revokeByHash,
  revokeAllForUser,
  revokeById,
  getActiveForUser,
  cleanupExpired,
  validateTokenWithTransaction,
};
