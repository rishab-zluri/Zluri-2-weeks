/**
 * Authentication Service
 * 
 * Implements secure authentication with:
 * - Short-lived access tokens (15-30 min)
 * - Long-lived refresh tokens (7 days, stored in DB)
 * - True logout (refresh token deletion)
 * - "Logout everywhere" functionality
 * 
 * ARCHITECTURE NOTE:
 * - User queries use User model (DAL separation)
 * - Session/token queries use Session model (DAL separation)
 * - Token refresh uses transactions for atomicity
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { portalQuery } = require('../config/database');
const Session = require('../models/Session');
const { TokenType } = require('../constants/auth');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const AUTH_CONFIG = {
  // Access token - short lived, not stored in DB
  accessToken: {
    /* istanbul ignore next - environment variable fallback */
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    /* istanbul ignore next - environment variable fallback */
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '30m',  // 30 minutes
  },
  // Refresh token - long lived, stored in DB
  refreshToken: {
    /* istanbul ignore next - environment variable fallback */
    secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-refresh-secret',
    /* istanbul ignore next - environment variable fallback */
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
 * Uses TokenType.ACCESS enum for type safety
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    podId: user.pod_id,
    type: TokenType.ACCESS,
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

  // Store refresh token in DB using Session model (DAL separation)
  await Session.create({
    userId: user.id,
    tokenHash: refreshTokenHash,
    deviceInfo,
    ipAddress,
    expiresAt,
  });

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
 * Uses Session model for DAL separation
 */
const logout = async (refreshToken) => {
  if (!refreshToken) {
    return { success: false, error: 'Refresh token required' };
  }

  const tokenHash = hashToken(refreshToken);

  // Revoke the token using Session model
  const result = await Session.revokeByHash(tokenHash);

  if (!result) {
    logger.warn('Logout: token not found or already revoked');
    return { success: false, error: 'Invalid or expired token' };
  }

  logger.info('User logged out', { userId: result.user_id });

  return { success: true, message: 'Logged out successfully' };
};

/**
 * Logout from all devices - revokes ALL refresh tokens for user
 * Uses Session model for DAL separation
 */
const logoutAll = async (userId) => {
  const sessionsRevoked = await Session.revokeAllForUser(userId);

  logger.info('User logged out from all devices', { 
    userId, 
    sessionsRevoked 
  });

  return { 
    success: true, 
    message: 'Logged out from all devices',
    sessionsRevoked,
  };
};

// ============================================================================
// TOKEN REFRESH
// ============================================================================

/**
 * Refresh access token using refresh token
 * CRITICAL FIX: Uses transaction for atomicity
 * - Token validation and user check happen in single transaction
 * - Prevents race conditions between validation and revocation
 */
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    return { success: false, error: 'Refresh token required' };
  }

  const tokenHash = hashToken(refreshToken);

  try {
    // Use Session model's transaction-based validation
    const result = await Session.validateTokenWithTransaction(tokenHash, (tokenData) => {
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
        valid: true,
        success: true,
        accessToken: newAccessToken,
        expiresIn: AUTH_CONFIG.accessToken.expiresIn,
      };
    });

    // Handle validation failures
    if (!result.valid) {
      logger.warn('Token refresh failed: ' + result.error);
      return { success: false, error: result.error };
    }

    return result;
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    return { success: false, error: 'Token refresh failed' };
  }
};

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

/**
 * Verify access token
 * Uses TokenType.ACCESS enum for type safety
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, AUTH_CONFIG.accessToken.secret);
    
    if (decoded.type !== TokenType.ACCESS) {
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
 * Uses Session model for DAL separation
 */
const getActiveSessions = async (userId) => {
  return Session.getActiveForUser(userId);
};

/**
 * Revoke a specific session
 * Uses Session model for DAL separation
 */
const revokeSession = async (userId, sessionId) => {
  return Session.revokeById(userId, sessionId);
};

/**
 * Clean up expired tokens (call periodically)
 * Uses Session model for DAL separation
 */
const cleanupExpiredTokens = async () => {
  return Session.cleanupExpired();
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