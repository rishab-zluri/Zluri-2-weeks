/**
 * Authentication Controller
 * Handle user authentication endpoints
 * 
 * Updated with true logout support via DB-backed refresh tokens
 */

const User = require('../models/User');
const auth = require('../middleware/auth');
const response = require('../utils/response');
const logger = require('../utils/logger');
const { AuthenticationError, ValidationError } = require('../utils/errors');

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, name, podId } = req.body;

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return response.error(res, 'User with this email already exists', 409, 'CONFLICT');
    }

    // Create user
    const user = await User.create({
      email,
      password,
      name,
      role: User.UserRoles.DEVELOPER,
      podId,
    });

    // Get device info for session tracking
    const deviceInfo = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    // Generate tokens (stores refresh token in DB)
    const tokens = await auth.generateTokens(user, { deviceInfo, ipAddress });

    // Update last login
    await User.updateLastLogin(user.id);

    logger.info('User registered', { userId: user.id, email });

    return response.created(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        podId: user.podId,
      },
      ...tokens,
    }, 'Registration successful');
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    return response.error(res, error.message || 'Registration failed', 500);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return response.error(res, 'Email and password are required', 400, 'VALIDATION_ERROR');
    }

    // Find user with password
    const user = await User.findByEmail(email, true);
    
    if (!user) {
      return response.error(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (!user.isActive) {
      return response.error(res, 'Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      return response.error(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Get device info for session tracking
    const deviceInfo = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    // Generate tokens (stores refresh token in DB)
    const tokens = await auth.generateTokens(user, { deviceInfo, ipAddress });

    // Update last login
    await User.updateLastLogin(user.id);

    logger.info('User logged in', { userId: user.id, email });

    return response.success(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        podId: user.podId,
        slackUserId: user.slackUserId,
      },
      ...tokens,
    }, 'Login successful');
  } catch (error) {
    logger.error('Login error', { error: error.message });
    return response.error(res, 'Login failed', 500);
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return response.error(res, 'Refresh token is required', 400, 'VALIDATION_ERROR');
    }

    // Verify refresh token (checks DB)
    const userData = await auth.verifyRefreshToken(token);
    
    // Get full user object
    const user = await User.findById(userData.userId);
    
    if (!user) {
      return response.error(res, 'User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return response.error(res, 'Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }

    // Get device info
    const deviceInfo = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    // Revoke old refresh token and generate new ones
    await auth.logout(token);
    const tokens = await auth.generateTokens(user, { deviceInfo, ipAddress });

    return response.success(res, tokens, 'Token refreshed');
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return response.error(res, error.message, 401, 'INVALID_TOKEN');
    }
    logger.error('Token refresh error', { error: error.message });
    return response.error(res, 'Invalid refresh token', 401, 'INVALID_TOKEN');
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    return response.success(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      podId: user.podId,
      slackUserId: user.slackUserId,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    });
  } catch (error) {
    logger.error('Get profile error', { error: error.message });
    return response.error(res, 'Failed to get profile', 500);
  }
};

/**
 * Update current user profile
 * PUT /api/auth/me
 */
const updateProfile = async (req, res) => {
  try {
    const { name, slackUserId } = req.body;
    const userId = req.user.id;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (slackUserId !== undefined) updates.slackUserId = slackUserId;

    const user = await User.update(userId, updates);

    logger.info('User profile updated', { userId });

    return response.success(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      podId: user.podId,
      slackUserId: user.slackUserId,
    }, 'Profile updated');
  } catch (error) {
    logger.error('Update profile error', { error: error.message });
    return response.error(res, 'Failed to update profile', 500);
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validation
    if (!currentPassword || !newPassword) {
      return response.error(res, 'Current password and new password are required', 400, 'VALIDATION_ERROR');
    }

    if (newPassword.length < 8) {
      return response.error(res, 'New password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }

    // Get user with password
    const user = await User.findByEmail(req.user.email, true);

    // Verify current password
    const isValidPassword = await User.verifyPassword(currentPassword, user.passwordHash);
    
    if (!isValidPassword) {
      return response.error(res, 'Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    // Update password
    await User.updatePassword(userId, newPassword);

    // Revoke all refresh tokens (force re-login on all devices)
    await auth.logoutAll(userId);

    logger.info('Password changed', { userId });

    return response.success(res, null, 'Password changed successfully. Please login again.');
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    return response.error(res, 'Failed to change password', 500);
  }
};

/**
 * Logout - revokes refresh token
 * POST /api/auth/logout
 * Body: { refreshToken }
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      // Still return success - user wants to logout
      // Client should clear tokens regardless
      return response.success(res, null, 'Logged out successfully');
    }

    // Revoke the refresh token in database
    const result = await auth.logout(refreshToken);

    if (!result.success) {
      // Token not found or already revoked - still return success
      logger.warn('Logout: token issue', { error: result.error });
    }

    logger.info('User logged out', { userId: req.user?.id });

    return response.success(res, null, 'Logged out successfully');
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    // Still return success - we want user to be able to logout
    return response.success(res, null, 'Logged out successfully');
  }
};

/**
 * Logout from all devices
 * POST /api/auth/logout-all
 */
const logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await auth.logoutAll(userId);

    logger.info('User logged out from all devices', { userId, sessionsRevoked: result.sessionsRevoked });

    return response.success(res, {
      sessionsRevoked: result.sessionsRevoked,
    }, result.message);
  } catch (error) {
    logger.error('Logout all error', { error: error.message });
    return response.error(res, 'Failed to logout from all devices', 500);
  }
};

/**
 * Get active sessions
 * GET /api/auth/sessions
 */
const getSessions = async (req, res) => {
  try {
    const sessions = await auth.getActiveSessions(req.user.id);

    return response.success(res, {
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    logger.error('Get sessions error', { error: error.message });
    return response.error(res, 'Failed to get sessions', 500);
  }
};

/**
 * Revoke a specific session
 * DELETE /api/auth/sessions/:sessionId
 */
const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const revoked = await auth.revokeSession(req.user.id, sessionId);

    if (!revoked) {
      return response.error(res, 'Session not found or already revoked', 404);
    }

    return response.success(res, null, 'Session revoked successfully');
  } catch (error) {
    logger.error('Revoke session error', { error: error.message });
    return response.error(res, 'Failed to revoke session', 500);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  logoutAll,
  getSessions,
  revokeSession,
};