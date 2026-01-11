/**
 * Authentication Middleware
 * Handles JWT authentication, session management, and authorization
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

// ============================================================================
// CONFIGURATION
// ============================================================================

/* istanbul ignore next - environment variable fallbacks */
const JWT_CONFIG = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-change-in-production',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production',
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  issuer: process.env.JWT_ISSUER || 'db-query-portal',
  audience: process.env.JWT_AUDIENCE || 'db-query-portal-users',
};

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  DEVELOPER: 'developer',
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 3,
  [ROLES.MANAGER]: 2,
  [ROLES.DEVELOPER]: 1,
};

// ============================================================================
// TOKEN GENERATION
// ============================================================================

const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    podId: user.pod_id || user.podId,
    managedPods: user.managed_pods || user.managedPods || [],
  };

  return jwt.sign(payload, JWT_CONFIG.accessTokenSecret, {
    expiresIn: JWT_CONFIG.accessTokenExpiry,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
    subject: user.id,
  });
};

const generateRefreshToken = (user) => {
  const tokenId = crypto.randomUUID();
  
  const payload = {
    userId: user.id,
    tokenId,
    type: 'refresh',
  };

  const token = jwt.sign(payload, JWT_CONFIG.refreshTokenSecret, {
    expiresIn: JWT_CONFIG.refreshTokenExpiry,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
    subject: user.id,
  });

  return { token, tokenId };
};

const generateTokenPair = async (user) => {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, tokenId } = generateRefreshToken(user);

  // Calculate expiry date
  const expiresAt = new Date();
  /* istanbul ignore next - parseInt fallback */
  const days = parseInt(JWT_CONFIG.refreshTokenExpiry) || 7;
  expiresAt.setDate(expiresAt.getDate() + days);

  // Store refresh token in database
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenId, user.id, hashToken(refreshToken), expiresAt]
  );

  logger.info('Token pair generated', { userId: user.id, tokenId });

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_CONFIG.accessTokenExpiry,
  };
};

// ============================================================================
// TOKEN UTILITIES
// ============================================================================

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.accessTokenSecret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Access token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid access token');
    }
    throw new AuthenticationError('Token verification failed');
  }
};

const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
};

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

const authenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      podId: decoded.podId,
      managedPods: decoded.managedPods || [],
    };

    logger.debug('User authenticated', { 
      userId: req.user.id, 
      role: req.user.role,
      path: req.path,
    });

    next();
  } catch (error) {
    /* istanbul ignore else - AuthenticationError is the expected error type */
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        status: 'fail',
        code: 'AUTHENTICATION_ERROR',
        message: error.message,
      });
    }
    
    /* istanbul ignore next - defensive code for unexpected errors */
    logger.error('Authentication error', { 
      error: error.message,
      path: req.path,
    });
    
    /* istanbul ignore next */
    return res.status(401).json({
      status: 'fail',
      code: 'AUTHENTICATION_ERROR',
      message: 'Authentication failed',
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        podId: decoded.podId,
        managedPods: decoded.managedPods || [],
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization denied', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      return res.status(403).json({
        status: 'fail',
        code: 'AUTHORIZATION_ERROR',
        message: 'You do not have permission to perform this action',
      });
    }

    next();
  };
};

const authorizeMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      });
    }

    /* istanbul ignore next - role hierarchy fallback */
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    /* istanbul ignore next - role hierarchy fallback */
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      logger.warn('Authorization denied - insufficient role level', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredMinRole: minRole,
        path: req.path,
      });

      return res.status(403).json({
        status: 'fail',
        code: 'AUTHORIZATION_ERROR',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

const authorizePodAccess = (podIdParam = 'podId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      });
    }

    // Admins have access to all pods
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const requestedPodId = req.params[podIdParam] || req.body.podId || req.query.podId;

    if (!requestedPodId) {
      return next();
    }

    // Check if user manages this pod or belongs to it
    const hasAccess = 
      req.user.podId === requestedPodId ||
      (req.user.managedPods && req.user.managedPods.includes(requestedPodId));

    if (!hasAccess) {
      logger.warn('POD access denied', {
        userId: req.user.id,
        userPodId: req.user.podId,
        managedPods: req.user.managedPods,
        requestedPodId,
        path: req.path,
      });

      return res.status(403).json({
        status: 'fail',
        code: 'AUTHORIZATION_ERROR',
        message: 'You do not have access to this POD',
      });
    }

    next();
  };
};

// ============================================================================
// REFRESH TOKEN HANDLING
// ============================================================================

const verifyRefreshToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_CONFIG.refreshTokenSecret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token has expired');
    }
    throw new AuthenticationError('Invalid refresh token');
  }

  // Check if token exists in database and is not revoked
  const tokenHash = hashToken(refreshToken);
  const result = await query(
    `SELECT rt.*, u.email, u.role, u.pod_id, u.name
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.id = $1 
       AND rt.token_hash = $2 
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
       AND u.is_active = true`,
    [decoded.tokenId, tokenHash]
  );

  // Defensive check for undefined/null result
  if (!result || !result.rows || result.rows.length === 0) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  const tokenRecord = result.rows[0];

  return {
    userId: tokenRecord.user_id,
    email: tokenRecord.email,
    role: tokenRecord.role,
    podId: tokenRecord.pod_id,
    name: tokenRecord.name,
    tokenId: decoded.tokenId,
  };
};

const refreshTokens = async (refreshToken) => {
  const tokenData = await verifyRefreshToken(refreshToken);

  // Revoke current refresh token
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
    [tokenData.tokenId]
  );

  // Generate new token pair
  const user = {
    id: tokenData.userId,
    email: tokenData.email,
    role: tokenData.role,
    pod_id: tokenData.podId,
    name: tokenData.name,
  };

  const tokens = await generateTokenPair(user);

  logger.info('Tokens refreshed', { userId: user.id });

  return tokens;
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const logout = async (refreshToken) => {
  try {
    const tokenHash = hashToken(refreshToken);
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked_at = NOW() 
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING user_id`,
      [tokenHash]
    );

    // Defensive check for undefined/null result
    if (!result || result.rowCount === 0) {
      logger.warn('Logout: token not found or already revoked');
      return { success: false, error: 'Token not found or already revoked' };
    }

    logger.info('User logged out', { userId: result.rows?.[0]?.user_id });
    return { success: true };
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    throw error;
  }
};

const logoutAll = async (userId) => {
  try {
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked_at = NOW() 
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    // Defensive null check
    const revokedCount = result?.rowCount || 0;

    logger.info('User logged out from all devices', { 
      userId, 
      sessionsRevoked: revokedCount,
    });

    return { 
      success: true, 
      message: 'Logged out from all devices',
      sessionsRevoked: revokedCount,
    };
  } catch (error) {
    logger.error('Logout all error', { userId, error: error.message });
    throw error;
  }
};

const getActiveSessions = async (userId) => {
  const result = await query(
    `SELECT id, created_at, expires_at, 
            EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
     FROM refresh_tokens 
     WHERE user_id = $1 
       AND revoked_at IS NULL 
       AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );

  // Defensive null check
  if (!result || !result.rows) {
    return [];
  }

  return result.rows.map(row => ({
    sessionId: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    expiresIn: Math.round(row.seconds_until_expiry),
  }));
};

const revokeSession = async (userId, sessionId) => {
  const result = await query(
    `UPDATE refresh_tokens 
     SET revoked_at = NOW() 
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId]
  );

  // Defensive null check
  const revoked = result?.rowCount > 0;

  if (revoked) {
    logger.info('Session revoked', { userId, sessionId });
  }

  return revoked;
};

// ============================================================================
// TOKEN CLEANUP
// ============================================================================

const cleanupExpiredTokens = async () => {
  const result = await query(
    `DELETE FROM refresh_tokens 
     WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'`
  );

  // Defensive null check
  const deletedCount = result?.rowCount || 0;

  if (deletedCount > 0) {
    logger.info('Cleaned up expired tokens', { count: deletedCount });
  }

  return deletedCount;
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Middleware
  authenticate,
  optionalAuth,
  authorize,
  requireRole: authorize,  // Alias for backward compatibility
  authorizeMinRole,
  authorizePodAccess,
  requireManagerOfPod: authorizePodAccess,  // Alias for backward compatibility
  
  // Token operations
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  generateTokens: generateTokenPair,  // ALIAS - authController uses this name
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokens,
  
  // Session management
  logout,
  logoutAll,
  getActiveSessions,
  revokeSession,
  
  // Utilities
  hashToken,
  extractTokenFromHeader,
  cleanupExpiredTokens,
  
  // Constants
  ROLES,
  ROLE_HIERARCHY,
  JWT_CONFIG,
};