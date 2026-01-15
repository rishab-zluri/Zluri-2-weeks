/**
 * Middleware Index
 * Export all middleware from a single entry point
 *
 * ARCHITECTURE:
 * - Centralizes all middleware exports
 * - Clean imports: import { authenticate, validate } from '../middleware'
 *
 * MIGRATION NOTE:
 * - Validation migrated from express-validator to Zod (src/validation/)
 * - sanitizeInput preserved for XSS protection
 */

// =============================================================================
// Auth Middleware
// =============================================================================

export {
    authenticate,
    optionalAuth,
    authorize,
    requireRole,
    authorizeMinRole,
    authorizePodAccess,
    requireManagerOfPod,
    generateAccessToken,
    generateRefreshToken,
    generateTokenPair,
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    refreshTokens,
    logout,
    logoutAll,
    getActiveSessions,
    revokeSession,
    isTokenBlacklisted,
    blacklistAccessToken,
    blacklistAllUserTokens,
    areUserTokensInvalidated,
    cleanupBlacklist,
    hashToken,
    extractTokenFromHeader,
    cleanupExpiredTokens,
    ROLES,
    ROLE_HIERARCHY,
    JWT_CONFIG,
} from './auth';

// =============================================================================
// Error Handler Middleware
// =============================================================================

export {
    notFound,
    notFoundHandler,
    asyncHandler,
    errorHandler,
    globalErrorHandler,
} from './errorHandler';

// =============================================================================
// Sanitization Middleware (XSS Protection)
// =============================================================================

export { sanitizeInput } from './sanitize';

// =============================================================================
// Upload Middleware
// =============================================================================

export {
    upload,
    memoryUpload,
    uploadScript,
    handleUpload,
    validateScriptContent,
    handleScriptUpload,
    cleanupFile,
} from './upload';

// =============================================================================
// Type Exports
// =============================================================================

export type { ScriptInfo } from './upload';
export type { RoleType, JwtConfig } from './auth';
