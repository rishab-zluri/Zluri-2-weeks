/**
 * Authentication Middleware
 * Handles JWT authentication, session management, and authorization
 */

import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { extractAccessToken } from '../utils/cookies';
import type {
    AuthenticatedUser,
    AccessTokenPayload,
    RefreshTokenPayload,
    TokenPair,
    SessionInfo,
    LogoutResult,
    LogoutAllResult,
    TokenUser,
    RefreshTokenData,
} from '../types/express';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface JwtConfig {
    readonly accessTokenSecret: string;
    readonly refreshTokenSecret: string;
    readonly accessTokenExpiry: string;
    readonly refreshTokenExpiry: string;
    readonly issuer: string;
    readonly audience: string;
}

/* istanbul ignore next - environment variable fallbacks */
export const JWT_CONFIG: JwtConfig = {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-key-change-in-production',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'db-query-portal',
    audience: process.env.JWT_AUDIENCE || 'db-query-portal-users',
};

export const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    DEVELOPER: 'developer',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<RoleType, number> = {
    [ROLES.ADMIN]: 3,
    [ROLES.MANAGER]: 2,
    [ROLES.DEVELOPER]: 1,
};

// ============================================================================
// TOKEN UTILITIES
// ============================================================================

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
        return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return null;
    }

    return parts[1];
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate an access token for a user
 */
export function generateAccessToken(user: TokenUser): string {
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'sub'> = {
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
    } as SignOptions);
}

/**
 * Generate a refresh token for a user
 */
export function generateRefreshToken(user: TokenUser): { token: string; tokenId: string } {
    const tokenId = crypto.randomUUID();

    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'sub'> = {
        userId: user.id,
        tokenId,
        type: 'refresh',
    };

    const token = jwt.sign(payload, JWT_CONFIG.refreshTokenSecret, {
        expiresIn: JWT_CONFIG.refreshTokenExpiry,
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
        subject: user.id,
    } as SignOptions);

    return { token, tokenId };
}

/**
 * Generate both access and refresh tokens
 *
 * TOKEN FAMILY ARCHITECTURE:
 * When called during login (no familyId), creates a new token family.
 * When called during refresh, pass the existing familyId to continue the chain.
 *
 * @param user - User information for token payload
 * @param options - Optional settings including familyId and IP address
 */
export async function generateTokenPair(
    user: TokenUser,
    options?: {
        familyId?: string;      // Pass existing familyId during refresh
        ipAddress?: string;     // Client IP for security binding
        deviceInfo?: string;    // User-Agent for session identification
    }
): Promise<TokenPair> {
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, tokenId } = generateRefreshToken(user);

    // Calculate expiry date
    const expiresAt = new Date();
    /* istanbul ignore next - parseInt fallback */
    const days = parseInt(JWT_CONFIG.refreshTokenExpiry) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    // Generate new familyId for login, or use existing for refresh
    const familyId = options?.familyId || crypto.randomUUID();

    // Store refresh token in database with Token Family fields
    await query(
        `INSERT INTO refresh_tokens 
         (id, user_id, token_hash, family_id, is_used, is_revoked, ip_address, device_info, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
            tokenId,
            user.id,
            hashToken(refreshToken),
            familyId,
            false,  // isUsed
            false,  // isRevoked
            options?.ipAddress || null,
            options?.deviceInfo || null,
            expiresAt
        ]
    );

    logger.info('Token pair generated', {
        userId: user.id,
        tokenId,
        familyId,
        isNewFamily: !options?.familyId
    });

    return {
        accessToken,
        refreshToken,
        expiresIn: JWT_CONFIG.accessTokenExpiry,
    };
}

// Alias for backward compatibility
export const generateTokens = generateTokenPair;

// ============================================================================
// ACCESS TOKEN BLACKLIST
// ============================================================================

/**
 * Check if access token is blacklisted (logged out)
 */
export async function isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    const result = await query(
        `SELECT 1 FROM access_token_blacklist 
     WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash]
    );
    return !!(result && result.rows && result.rows.length > 0);
}

/**
 * Blacklist an access token (called on logout)
 */
export async function blacklistAccessToken(token: string, userId: string): Promise<void> {
    try {
        const decoded = jwt.decode(token) as JwtPayload | null;
        if (!decoded || !decoded.exp) return;

        const tokenHash = hashToken(token);
        const expiresAt = new Date(decoded.exp * 1000);

        await query(
            `INSERT INTO access_token_blacklist (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO NOTHING`,
            [tokenHash, userId, expiresAt]
        );

        logger.info('Access token blacklisted', { userId });
    } catch (error) {
        const err = error as Error;
        logger.error('Failed to blacklist token', { error: err.message });
    }
}

/**
 * Blacklist all access tokens for a user (for logout-all)
 */
export async function blacklistAllUserTokens(userId: string): Promise<void> {
    try {
        await query(
            `INSERT INTO user_token_invalidation (user_id, invalidated_at)
       VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET invalidated_at = NOW()`,
            [userId]
        );
        logger.info('All user tokens invalidated', { userId });
    } catch (error) {
        const err = error as Error;
        logger.warn('Could not invalidate all user tokens', { error: err.message });
    }
}

/**
 * Check if user's tokens were bulk invalidated after token was issued
 */
export async function areUserTokensInvalidated(userId: string, tokenIssuedAt: number): Promise<boolean> {
    try {
        const result = await query(
            `SELECT invalidated_at FROM user_token_invalidation 
       WHERE user_id = $1 AND invalidated_at > $2`,
            [userId, new Date(tokenIssuedAt * 1000)]
        );
        return result && result.rows && result.rows.length > 0;
    } catch {
        return false;
    }
}

// ============================================================================
// TOKEN VERIFICATION
// ============================================================================

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
    try {
        const options: VerifyOptions = {
            issuer: JWT_CONFIG.issuer,
            audience: JWT_CONFIG.audience,
        };
        return jwt.verify(token, JWT_CONFIG.accessTokenSecret, options) as AccessTokenPayload;
    } catch (error) {
        const err = error as Error;
        if (err.name === 'TokenExpiredError') {
            throw new AuthenticationError('Access token has expired');
        }
        if (err.name === 'JsonWebTokenError') {
            throw new AuthenticationError('Invalid access token');
        }
        throw new AuthenticationError('Token verification failed');
    }
}

/**
 * Verify a refresh token and get associated user data
 *
 * TOKEN FAMILY: Returns additional fields for reuse detection:
 * - familyId: The token's family for chain revocation
 * - isUsed: Whether this token was already exchanged
 * - ipAddress: Original creation IP for binding check
 */
export async function verifyRefreshToken(refreshToken: string): Promise<RefreshTokenData & {
    familyId: string;
    isUsed: boolean;
    ipAddress: string | null;
}> {
    let decoded: RefreshTokenPayload;
    try {
        const options: VerifyOptions = {
            issuer: JWT_CONFIG.issuer,
            audience: JWT_CONFIG.audience,
        };
        decoded = jwt.verify(refreshToken, JWT_CONFIG.refreshTokenSecret, options) as RefreshTokenPayload;
    } catch (error) {
        const err = error as Error;
        if (err.name === 'TokenExpiredError') {
            throw new AuthenticationError('Refresh token has expired');
        }
        throw new AuthenticationError('Invalid refresh token');
    }

    const tokenHash = hashToken(refreshToken);

    // Query includes Token Family fields
    // NOTE: We do NOT filter by is_used here - we need to detect reuse
    const result = await query(
        `SELECT rt.*, u.email, u.role, u.pod_id, u.name
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.id = $1 
           AND rt.token_hash = $2 
           AND rt.is_revoked = false
           AND rt.expires_at > NOW()
           AND u.is_active = true`,
        [decoded.tokenId, tokenHash]
    );

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
        // Token Family fields
        familyId: tokenRecord.family_id,
        isUsed: tokenRecord.is_used,
        ipAddress: tokenRecord.ip_address,
    };
}

/**
 * Revoke all tokens in a family (security response to reuse detection)
 *
 * WHY: When token reuse is detected, it means either:
 * 1. The legitimate user's token was stolen and thief used it first
 * 2. A stolen token is being replayed
 *
 * In both cases, the entire session chain is compromised and must be terminated.
 * Both the attacker AND the victim are kicked out, forcing a fresh login.
 */
async function revokeTokenFamily(familyId: string, reason: string): Promise<number> {
    const result = await query(
        `UPDATE refresh_tokens 
         SET is_revoked = true, revoked_at = NOW() 
         WHERE family_id = $1 AND is_revoked = false`,
        [familyId]
    );

    const revokedCount = result.rowCount || 0;

    logger.warn('Token family revoked', {
        familyId,
        reason,
        tokensRevoked: revokedCount
    });

    return revokedCount;
}

/**
 * Refresh tokens - verify old refresh token and generate new pair
 *
 * TOKEN FAMILY ARCHITECTURE - HONEYTOKEN TRAP:
 * This function implements the core security logic:
 *
 * 1. REUSE DETECTION: If a token marked as "used" is presented again,
 *    it's a replay attack. Revoke the entire family.
 *
 * 2. IP BINDING (Optional): If IP changed significantly, reject and revoke.
 *    Currently logs a warning but allows - can be made strict.
 *
 * 3. NORMAL ROTATION: Mark current token as used, issue new token in same family.
 *
 * @param refreshToken - The refresh token to exchange
 * @param clientInfo - Optional client IP and device info for security checks
 */
export async function refreshTokens(
    refreshToken: string,
    clientInfo?: {
        ipAddress?: string;
        deviceInfo?: string;
    }
): Promise<TokenPair> {
    const tokenData = await verifyRefreshToken(refreshToken);

    // =========================================================================
    // SECURITY CHECK 1: REUSE DETECTION (The Honeytoken Trap)
    // =========================================================================
    if (tokenData.isUsed) {
        // CRITICAL: This token was already exchanged for a new one.
        // Someone is trying to use it again - this is a replay attack.

        // Log security alert with full context
        logger.error('🚨 SECURITY ALERT: Refresh Token Reuse Detected!', {
            userId: tokenData.userId,
            email: tokenData.email,
            familyId: tokenData.familyId,
            tokenId: tokenData.tokenId,
            originalIp: tokenData.ipAddress,
            attemptIp: clientInfo?.ipAddress || 'unknown',
            timestamp: new Date().toISOString()
        });

        // Revoke the ENTIRE family - kick out both attacker and victim
        await revokeTokenFamily(
            tokenData.familyId,
            'Token reuse detected - possible token theft'
        );

        throw new AuthenticationError(
            'Session terminated due to suspicious activity. Please login again.'
        );
    }

    // =========================================================================
    // SECURITY CHECK 2: IP BINDING (Optional - Currently Warning Only)
    // =========================================================================
    if (clientInfo?.ipAddress && tokenData.ipAddress) {
        if (clientInfo.ipAddress !== tokenData.ipAddress) {
            // IP changed - this could be:
            // - Legitimate: User on mobile network, VPN, etc.
            // - Suspicious: Token stolen and used from different location

            logger.warn('IP address mismatch during token refresh', {
                userId: tokenData.userId,
                familyId: tokenData.familyId,
                originalIp: tokenData.ipAddress,
                currentIp: clientInfo.ipAddress
            });

            // OPTION A: Strict mode - revoke and require re-login
            // Uncomment below for high-security environments:
            /*
            await revokeTokenFamily(
                tokenData.familyId,
                'IP address mismatch'
            );
            throw new AuthenticationError(
                'Session invalidated due to IP change. Please login again.'
            );
            */

            // OPTION B: Lenient mode - allow but log (current behavior)
            // Good for apps with mobile users or VPN users
        }
    }

    // =========================================================================
    // HAPPY PATH: Normal Token Rotation
    // =========================================================================

    // Step 1: Mark current token as USED (arm the honeytoken trap)
    await query(
        `UPDATE refresh_tokens SET is_used = true, updated_at = NOW() WHERE id = $1`,
        [tokenData.tokenId]
    );

    // Step 2: Generate new token pair in the SAME family
    const user: TokenUser = {
        id: tokenData.userId,
        email: tokenData.email,
        role: tokenData.role,
        pod_id: tokenData.podId,
        name: tokenData.name,
    };

    const tokens = await generateTokenPair(user, {
        familyId: tokenData.familyId,  // Continue the chain
        ipAddress: clientInfo?.ipAddress,
        deviceInfo: clientInfo?.deviceInfo,
    });

    logger.info('Tokens refreshed successfully', {
        userId: user.id,
        familyId: tokenData.familyId,
        oldTokenId: tokenData.tokenId
    });

    return tokens;
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authenticate middleware - requires valid access token
 *
 * TOKEN EXTRACTION PRIORITY:
 * 1. HttpOnly Cookie (preferred for web clients - XSS protection)
 * 2. Authorization Bearer header (backward compatibility for API clients)
 */
export const authenticate: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Use cookie utility for flexible token extraction
        const token = extractAccessToken(req);

        if (!token) {
            throw new AuthenticationError('No authentication token provided');
        }

        const decoded = verifyAccessToken(token);

        // Check if token is blacklisted
        const tokenHash = hashToken(token);
        if (await isTokenBlacklisted(tokenHash)) {
            throw new AuthenticationError('Token has been revoked');
        }

        // Check if all user tokens were invalidated
        if (decoded.iat && await areUserTokensInvalidated(decoded.userId, decoded.iat)) {
            throw new AuthenticationError('Session has been invalidated');
        }

        // Attach user info to request
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            podId: decoded.podId,
            managedPods: decoded.managedPods || [],
        };

        // Store token for potential blacklisting on logout
        req.accessToken = token;

        logger.debug('User authenticated', {
            userId: req.user.id,
            role: req.user.role,
            path: req.path,
        });

        next();
    } catch (error) {
        if (error instanceof AuthenticationError) {
            res.status(401).json({
                status: 'fail',
                code: 'AUTHENTICATION_ERROR',
                message: error.message,
            });
            return;
        }

        /* istanbul ignore next */
        const err = error as Error;
        logger.error('Authentication error', {
            error: err.message,
            path: req.path,
        });

        /* istanbul ignore next */
        res.status(401).json({
            status: 'fail',
            code: 'AUTHENTICATION_ERROR',
            message: 'Authentication failed',
        });
    }
};

/**
 * Optional authentication - continues even without valid token
 */
export const optionalAuth: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
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
    } catch {
        next();
    }
};

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Authorization middleware - requires specific roles
 */
export function authorize(...allowedRoles: RoleType[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                status: 'fail',
                code: 'AUTHENTICATION_ERROR',
                message: 'Authentication required',
            });
            return;
        }

        if (!allowedRoles.includes(req.user.role as RoleType)) {
            logger.warn('Authorization denied', {
                userId: req.user.id,
                userRole: req.user.role,
                requiredRoles: allowedRoles,
                path: req.path,
            });

            res.status(403).json({
                status: 'fail',
                code: 'AUTHORIZATION_ERROR',
                message: 'You do not have permission to perform this action',
            });
            return;
        }

        next();
    };
}

// Alias for backward compatibility
export const requireRole = authorize;

/**
 * Authorization middleware - requires minimum role level
 */
export function authorizeMinRole(minRole: RoleType): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                status: 'fail',
                code: 'AUTHENTICATION_ERROR',
                message: 'Authentication required',
            });
            return;
        }

        const userLevel = ROLE_HIERARCHY[req.user.role as RoleType] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

        if (userLevel < requiredLevel) {
            logger.warn('Authorization denied - insufficient role level', {
                userId: req.user.id,
                userRole: req.user.role,
                requiredMinRole: minRole,
                path: req.path,
            });

            res.status(403).json({
                status: 'fail',
                code: 'AUTHORIZATION_ERROR',
                message: 'Insufficient permissions',
            });
            return;
        }

        next();
    };
}

/**
 * Authorization middleware - requires POD access
 */
export function authorizePodAccess(podIdParam: string = 'podId'): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                status: 'fail',
                code: 'AUTHENTICATION_ERROR',
                message: 'Authentication required',
            });
            return;
        }

        // Admins have access to all pods
        if (req.user.role === ROLES.ADMIN) {
            next();
            return;
        }

        const requestedPodId =
            req.params[podIdParam] ||
            (req.body as Record<string, unknown>)?.podId ||
            (req.query as Record<string, unknown>)?.podId;

        if (!requestedPodId) {
            next();
            return;
        }

        const hasAccess =
            req.user.podId === requestedPodId ||
            (req.user.managedPods && req.user.managedPods.includes(requestedPodId as string));

        if (!hasAccess) {
            logger.warn('POD access denied', {
                userId: req.user.id,
                userPodId: req.user.podId,
                managedPods: req.user.managedPods,
                requestedPodId,
                path: req.path,
            });

            res.status(403).json({
                status: 'fail',
                code: 'AUTHORIZATION_ERROR',
                message: 'You do not have access to this POD',
            });
            return;
        }

        next();
    };
}

// Alias for backward compatibility
export const requireManagerOfPod = authorizePodAccess;

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Logout - revoke refresh token and optionally blacklist access token
 */
export async function logout(
    refreshToken: string,
    accessToken: string | null = null,
    userId: string | null = null
): Promise<LogoutResult> {
    try {
        const tokenHash = hashToken(refreshToken);
        const result = await query(
            `UPDATE refresh_tokens 
       SET revoked_at = NOW() 
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING user_id`,
            [tokenHash]
        );

        const loggedOutUserId = result?.rows?.[0]?.user_id || userId;

        if (accessToken && loggedOutUserId) {
            await blacklistAccessToken(accessToken, loggedOutUserId);
        }

        if (!result || result.rowCount === 0) {
            logger.warn('Logout: token not found or already revoked');
            if (accessToken && loggedOutUserId) {
                return { success: true, message: 'Access token revoked' };
            }
            return { success: false, error: 'Token not found or already revoked' };
        }

        logger.info('User logged out', { userId: loggedOutUserId });
        return { success: true };
    } catch (error) {
        const err = error as Error;
        logger.error('Logout error', { error: err.message });
        throw error;
    }
}

/**
 * Logout from all devices
 */
export async function logoutAll(userId: string): Promise<LogoutAllResult> {
    try {
        const result = await query(
            `UPDATE refresh_tokens 
       SET revoked_at = NOW() 
       WHERE user_id = $1 AND revoked_at IS NULL`,
            [userId]
        );

        const revokedCount = result?.rowCount || 0;
        await blacklistAllUserTokens(userId);

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
        const err = error as Error;
        logger.error('Logout all error', { userId, error: err.message });
        throw error;
    }
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessions(userId: string): Promise<SessionInfo[]> {
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

    if (!result || !result.rows) {
        return [];
    }

    return result.rows.map((row) => ({
        sessionId: row.id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        expiresIn: Math.round(row.seconds_until_expiry),
    }));
}

/**
 * Revoke a specific session
 */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await query(
        `UPDATE refresh_tokens 
     SET revoked_at = NOW() 
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
        [sessionId, userId]
    );

    const revoked = (result?.rowCount ?? 0) > 0;

    if (revoked) {
        logger.info('Session revoked', { userId, sessionId });
    }

    return revoked;
}

// ============================================================================
// TOKEN CLEANUP
// ============================================================================

/**
 * Cleanup expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
    const result = await query(
        `DELETE FROM refresh_tokens 
     WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'`
    );

    const deletedCount = result?.rowCount || 0;

    if (deletedCount > 0) {
        logger.info('Cleaned up expired tokens', { count: deletedCount });
    }

    return deletedCount;
}

/**
 * Cleanup expired blacklist entries
 */
export async function cleanupBlacklist(): Promise<number> {
    try {
        const result = await query(
            `DELETE FROM access_token_blacklist WHERE expires_at < NOW()`
        );
        const deletedCount = result?.rowCount || 0;
        if (deletedCount > 0) {
            logger.info('Cleaned up blacklist', { count: deletedCount });
        }
        return deletedCount;
    } catch (error) {
        const err = error as Error;
        logger.warn('Could not cleanup blacklist', { error: err.message });
        return 0;
    }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
    // Middleware
    authenticate,
    optionalAuth,
    authorize,
    requireRole,
    authorizeMinRole,
    authorizePodAccess,
    requireManagerOfPod,

    // Token operations
    generateAccessToken,
    generateRefreshToken,
    generateTokenPair,
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    refreshTokens,

    // Session management
    logout,
    logoutAll,
    getActiveSessions,
    revokeSession,

    // Token blacklist
    isTokenBlacklisted,
    blacklistAccessToken,
    blacklistAllUserTokens,
    areUserTokensInvalidated,
    cleanupBlacklist,

    // Utilities
    hashToken,
    extractTokenFromHeader,
    cleanupExpiredTokens,

    // Constants
    ROLES,
    ROLE_HIERARCHY,
    JWT_CONFIG,
};
