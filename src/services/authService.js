/**
 * Authentication Service
 * 
 * Implements secure authentication with:
 * - Short-lived access tokens (15-30 min)
 * - Long-lived refresh tokens (7 days, stored in DB)
 * - True logout (refresh token deletion)
 * - "Logout everywhere" functionality
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { portalQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const AUTH_CONFIG = {
  // Access token - short lived, not stored in DB
  accessToken: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '30m',  // 30 minutes
  },
  // Refresh token - long lived, stored in DB
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-refresh-secret',
    expiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS, 10) || 7,  // 7 days
  },
  // Password hashing
  bcryptRounds: 10,
};

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate access token (short-lived, stateless)
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    podId: user.pod_id,
    type: 'access',
  };

  return jwt.sign(payload, AUTH_CONFIG.accessToken.secret, {
    expiresIn: AUTH_CONFIG.accessToken.expiresIn,
  });
};

/**
 * Generate refresh token (long-lived, stored in DB)
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash refresh token for storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

/**
 * Find user by email
 */
const findUserByEmail = async (email) => {
  const result = await portalQuery(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
};

/**
 * Find user by ID
 */
const findUserById = async (userId) => {
  const result = await portalQuery(
    'SELECT id, email, name, role, pod_id, slack_user_id, is_active FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Verify password
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Hash password
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, AUTH_CONFIG.bcryptRounds);
};

// ============================================================================
// LOGIN / LOGOUT
// ============================================================================

/**
 * Login user - returns access token and refresh token
 */
const login = async (email, password, deviceInfo = null, ipAddress = null) => {
  // Find user
  const user = await findUserByEmail(email);
  if (!user) {
    logger.warn('Login failed: user not found', { email });
    return { success: false, error: 'Invalid email or password' };
  }

  // Check if user is active
  if (!user.is_active) {
    logger.warn('Login failed: user inactive', { email });
    return { success: false, error: 'Account is disabled' };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    logger.warn('Login failed: invalid password', { email });
    return { success: false, error: 'Invalid email or password' };
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + AUTH_CONFIG.refreshToken.expiresInDays);

  // Store refresh token in DB
  await portalQuery(`
    INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [user.id, refreshTokenHash, deviceInfo, ipAddress, expiresAt]);

  // Update last login
  await portalQuery(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  logger.info('User logged in', { userId: user.id, email: user.email });

  return {
    success: true,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      podId: user.pod_id,
    },
    expiresIn: AUTH_CONFIG.accessToken.expiresIn,
  };
};

/**
 * Logout user - revokes the specific refresh token
 */
const logout = async (refreshToken) => {
  if (!refreshToken) {
    return { success: false, error: 'Refresh token required' };
  }

  const tokenHash = hashToken(refreshToken);

  // Revoke the token
  const result = await portalQuery(`
    UPDATE refresh_tokens 
    SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = $1 AND is_revoked = false
    RETURNING user_id
  `, [tokenHash]);

  if (result.rowCount === 0) {
    logger.warn('Logout: token not found or already revoked');
    return { success: false, error: 'Invalid or expired token' };
  }

  logger.info('User logged out', { userId: result.rows[0].user_id });

  return { success: true, message: 'Logged out successfully' };
};

/**
 * Logout from all devices - revokes ALL refresh tokens for user
 */
const logoutAll = async (userId) => {
  const result = await portalQuery(`
    UPDATE refresh_tokens 
    SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND is_revoked = false
    RETURNING id
  `, [userId]);

  logger.info('User logged out from all devices', { 
    userId, 
    sessionsRevoked: result.rowCount 
  });

  return { 
    success: true, 
    message: 'Logged out from all devices',
    sessionsRevoked: result.rowCount,
  };
};

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    return { success: false, error: 'Refresh token required' };
  }

  const tokenHash = hashToken(refreshToken);

  // Find valid refresh token
  const result = await portalQuery(`
    SELECT rt.*, u.id as user_id, u.email, u.name, u.role, u.pod_id, u.is_active
    FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token_hash = $1 
      AND rt.is_revoked = false 
      AND rt.expires_at > CURRENT_TIMESTAMP
  `, [tokenHash]);

  if (result.rows.length === 0) {
    logger.warn('Token refresh failed: invalid or expired token');
    return { success: false, error: 'Invalid or expired refresh token' };
  }

  const tokenData = result.rows[0];

  // Check if user is still active
  if (!tokenData.is_active) {
    // Revoke the token since user is disabled
    await portalQuery(
      'UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1',
      [tokenHash]
    );
    return { success: false, error: 'Account is disabled' };
  }

  // Generate new access token
  const user = {
    id: tokenData.user_id,
    email: tokenData.email,
    name: tokenData.name,
    role: tokenData.role,
    pod_id: tokenData.pod_id,
  };

  const newAccessToken = generateAccessToken(user);

  logger.info('Access token refreshed', { userId: user.id });

  return {
    success: true,
    accessToken: newAccessToken,
    expiresIn: AUTH_CONFIG.accessToken.expiresIn,
  };
};

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, AUTH_CONFIG.accessToken.secret);
    
    if (decoded.type !== 'access') {
      return { valid: false, error: 'Invalid token type' };
    }

    return { valid: true, payload: decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired', expired: true };
    }
    return { valid: false, error: 'Invalid token' };
  }
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get active sessions for a user
 */
const getActiveSessions = async (userId) => {
  const result = await portalQuery(`
    SELECT id, device_info, ip_address, created_at, expires_at
    FROM refresh_tokens
    WHERE user_id = $1 
      AND is_revoked = false 
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
  `, [userId]);

  return result.rows;
};

/**
 * Revoke a specific session
 */
const revokeSession = async (userId, sessionId) => {
  const result = await portalQuery(`
    UPDATE refresh_tokens 
    SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2 AND is_revoked = false
    RETURNING id
  `, [sessionId, userId]);

  return result.rowCount > 0;
};

/**
 * Clean up expired tokens (call periodically)
 */
const cleanupExpiredTokens = async () => {
  const result = await portalQuery(`
    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = true
    RETURNING id
  `);

  logger.info('Cleaned up expired tokens', { count: result.rowCount });
  return result.rowCount;
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Auth operations
  login,
  logout,
  logoutAll,
  refreshAccessToken,
  verifyAccessToken,
  
  // User operations
  findUserByEmail,
  findUserById,
  hashPassword,
  verifyPassword,
  
  // Session management
  getActiveSessions,
  revokeSession,
  cleanupExpiredTokens,
  
  // Config (for testing)
  AUTH_CONFIG,
};