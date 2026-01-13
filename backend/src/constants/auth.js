/**
 * Authentication Constants
 * Centralized enums and constants for authentication
 */

/**
 * Token types for JWT tokens
 */
const TokenType = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
});

/**
 * User roles for RBAC
 */
const UserRole = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  DEVELOPER: 'developer',
});

/**
 * Session status
 */
const SessionStatus = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

module.exports = {
  TokenType,
  UserRole,
  SessionStatus,
};
