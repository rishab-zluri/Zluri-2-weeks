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

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getEntityManager, getORM } from '../db';
import { User, UserRole } from '../entities/User';
import { RefreshToken } from '../entities/RefreshToken';
import { ref } from '@mikro-orm/core';
import { TokenType } from '../constants/auth';
import logger from '../utils/logger';
import { TokenPair } from '../types/express';
import config from '../config'; // Use default config export

// ============================================================================
// Types
// ============================================================================

export interface AccessTokenPayload {
    userId: string;
    email: string;
    role: string;
    podId: string | null;
    type: string;
    iat?: number;
    exp?: number;
}

export interface UserForToken {
    id: string;
    email: string;
    role: string;
    podId?: string | null;
    name?: string;
}

export interface UserRow {
    id: string;
    email: string;
    name: string;
    role: string;
    pod_id: string | null;
    slack_user_id: string | null;
    is_active: boolean;
    password_hash?: string;
    last_login?: Date;
}

export interface LoginResult {
    success: boolean;
    error?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        podId: string | null;
    };
    expiresIn?: string;
}

export interface LogoutResult {
    success: boolean;
    error?: string;
    message?: string;
}

export interface LogoutAllResult {
    success: boolean;
    message: string;
    sessionsRevoked: number;
}

export interface RefreshResult {
    success: boolean;
    valid?: boolean;
    error?: string;
    accessToken?: string;
    expiresIn?: string;
}

export interface VerifyResult {
    valid: boolean;
    error?: string;
    expired?: boolean;
    payload?: AccessTokenPayload;
}

// ============================================================================
// Configuration
// ============================================================================

/* istanbul ignore next - environment variable fallback */
// AUTH_CONFIG removed in favor of global config

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate access token (short-lived, stateless)
 */
export function generateAccessToken(user: UserForToken): string {
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        role: user.role,
        podId: user.podId || null,
        type: TokenType.ACCESS,
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    } as SignOptions);
}

/**
 * Generate refresh token (long-lived, stored in DB)
 */
export function generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash refresh token for storage
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================================================
// User Authentication
// ============================================================================

/**
 * Find user by email
 */
/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
    const em = getEntityManager();
    const user = await em.findOne(User, { email: email.toLowerCase(), isActive: true });
    return user;
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string): Promise<User | null> {
    const em = getEntityManager();
    const user = await em.findOne(User, { id: userId });
    return user;
}

/**
 * Verify password
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptSaltRounds);
}

// ============================================================================
// Login / Logout
// ============================================================================

/**
 * Login user - returns access token and refresh token
 */
// Legacy User import removed

/**
 * Create a new session (generate tokens and store refresh token)
 */
/**
 * Create a new session (generate tokens and store refresh token)
 */
export async function createSession(
    user: User,
    deviceInfo: string | null = null,
    ipAddress: string | null = null
): Promise<TokenPair & { refreshTokenId: number }> {
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenString = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshTokenString);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.jwt.refreshExpiresInDays);

    // Store refresh token in DB using MikroORM
    const em = getEntityManager();
    const refreshTokenEntity = new RefreshToken();
    refreshTokenEntity.user = ref(user);
    refreshTokenEntity.tokenHash = refreshTokenHash;
    refreshTokenEntity.deviceInfo = deviceInfo || undefined;
    refreshTokenEntity.ipAddress = ipAddress || undefined;
    refreshTokenEntity.expiresAt = expiresAt;

    await em.persistAndFlush(refreshTokenEntity);
    logger.debug('Refresh token session created', { userId: user.id });

    return {
        accessToken,
        refreshToken: refreshTokenString,
        refreshTokenId: refreshTokenEntity.id,
        expiresIn: config.jwt.expiresIn,
    };
}

/**
 * Login user - returns access token and refresh token
 */
export async function login(
    email: string,
    password: string,
    deviceInfo: string | null = null,
    ipAddress: string | null = null
): Promise<LoginResult> {
    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
        logger.warn('Login failed: user not found', { email });
        return { success: false, error: 'Invalid email or password' };
    }

    // Check if user is active
    if (!user.isActive) {
        logger.warn('Login failed: user inactive', { email });
        return { success: false, error: 'Account is disabled' };
    }

    // Verify password
    if (!user.passwordHash) {
        logger.warn('Login failed: no password hash', { email });
        return { success: false, error: 'Invalid email or password' };
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
        logger.warn('Login failed: invalid password', { email });
        return { success: false, error: 'Invalid email or password' };
    }

    // Create session
    const tokens = await createSession(user, deviceInfo, ipAddress);

    // Update last login
    user.lastLogin = new Date();
    await getEntityManager().flush();

    logger.info('User logged in', { userId: user.id, email: user.email });

    return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            podId: user.podId || null,
        },
        expiresIn: tokens.expiresIn,
    };
}

/**
 * Logout user - revokes the specific refresh token
 */
export async function logout(refreshToken: string): Promise<LogoutResult> {
    if (!refreshToken) {
        return { success: false, error: 'Refresh token required' };
    }

    const tokenHash = hashToken(refreshToken);
    const em = getEntityManager();

    const token = await em.findOne(RefreshToken, {
        tokenHash,
        isRevoked: false
    });

    if (!token) {
        logger.warn('Logout: token not found or already revoked');
        return { success: false, error: 'Invalid or expired token' };
    }

    token.revoke();
    await em.flush();

    // We need userId for logging, populate or use reference
    const userId = token.user.id; // accessing ID from Ref is synchronous

    logger.info('User logged out', { userId });
    return { success: true, message: 'Logged out successfully' };
}

/**
 * Logout from all devices - revokes ALL refresh tokens for user
 */
export async function logoutAll(userId: string): Promise<LogoutAllResult> {
    const em = getEntityManager();
    // Using native update for bulk efficient update
    const result = await em.nativeUpdate(RefreshToken,
        { user: userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
    );

    logger.info('User logged out from all devices', {
        userId,
        sessionsRevoked: result,
    });

    return {
        success: true,
        message: 'Logged out from all devices',
        sessionsRevoked: result,
    };
}

/**
 * Refresh access token using refresh token
 *
 * TOKEN FAMILY ARCHITECTURE:
 * This function now implements security checks for the Token Family pattern:
 * 1. REUSE DETECTION: If token was already used, revoke entire family
 * 2. IP BINDING: Optional IP mismatch detection (logged, not enforced)
 *
 * @param refreshToken - The refresh token JWT
 * @param clientInfo - Optional client IP and device info for security
 */
export async function refreshAccessToken(
    refreshToken: string,
    clientInfo?: {
        ipAddress?: string;
        deviceInfo?: string;
    }
): Promise<RefreshResult> {
    if (!refreshToken) {
        return { success: false, error: 'Refresh token required' };
    }

    const tokenHash = hashToken(refreshToken);
    const em = getEntityManager();

    try {
        // Use transactional EM for safety
        const result = await em.transactional(async (tem) => {
            // Find token with user (do NOT filter by isUsed - we need to detect reuse)
            const storedToken = await tem.findOne(RefreshToken, {
                tokenHash,
                isRevoked: false,
                expiresAt: { $gt: new Date() }
            }, {
                populate: ['user']
            });

            if (!storedToken) {
                return { valid: false, error: 'Invalid or expired refresh token' };
            }

            // ==================================================================
            // SECURITY CHECK 1: REUSE DETECTION (Honeytoken Trap)
            // ==================================================================
            if (storedToken.isUsed) {
                // CRITICAL: This token was already used. This is a replay attack.
                const familyId = storedToken.familyId;

                logger.error('🚨 SECURITY ALERT: Refresh Token Reuse Detected!', {
                    userId: storedToken.user.id,
                    familyId,
                    tokenId: storedToken.id,
                    originalIp: storedToken.ipAddress,
                    attemptIp: clientInfo?.ipAddress || 'unknown'
                });

                // Revoke ALL tokens in this family
                await tem.nativeUpdate(
                    RefreshToken,
                    { familyId, isRevoked: false },
                    { isRevoked: true, revokedAt: new Date() }
                );

                return {
                    valid: false,
                    error: 'Session terminated due to suspicious activity. Please login again.'
                };
            }

            const user = storedToken.user.getEntity();

            // Check if user is still active
            if (!user.isActive) {
                storedToken.revoke();
                return { valid: false, error: 'Account is disabled' };
            }

            // ==================================================================
            // SECURITY CHECK 2: IP BINDING (Warning Only - Not Enforced)
            // ==================================================================
            if (clientInfo?.ipAddress && storedToken.ipAddress) {
                if (clientInfo.ipAddress !== storedToken.ipAddress) {
                    logger.warn('IP address mismatch during token refresh', {
                        userId: user.id,
                        familyId: storedToken.familyId,
                        originalIp: storedToken.ipAddress,
                        currentIp: clientInfo.ipAddress
                    });
                    // Currently just logging - can enable strict mode here
                }
            }

            // ==================================================================
            // HAPPY PATH: Issue new access token, mark refresh token as used
            // ==================================================================

            // Mark this token as used (arm the trap)
            storedToken.markAsUsed();

            // Generate new access token
            const newAccessToken = generateAccessToken({
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                podId: user.podId,
            } as UserForToken);

            logger.info('Access token refreshed', {
                userId: user.id,
                familyId: storedToken.familyId
            });

            return {
                valid: true,
                success: true,
                accessToken: newAccessToken,
                expiresIn: config.jwt.expiresIn,
            };
        });

        if (!result.valid) {
            logger.warn('Token refresh failed: ' + result.error);
            return { success: false, error: result.error };
        }

        return result as RefreshResult;

    } catch (error) {
        const err = error as Error;
        logger.error('Token refresh error', { error: err.message });
        return { success: false, error: 'Token refresh failed' };
    }
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): VerifyResult {
    try {
        const decoded = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;

        if (decoded.type !== TokenType.ACCESS) {
            return { valid: false, error: 'Invalid token type' };
        }

        return { valid: true, payload: decoded };
    } catch (error) {
        const err = error as Error;
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Token expired', expired: true };
        }
        return { valid: false, error: 'Invalid token' };
    }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get active sessions for a user
 */
/**
 * Get active sessions for a user
 */
export async function getActiveSessions(userId: string): Promise<any[]> {
    const em = getEntityManager();
    const sessions = await em.find(RefreshToken, {
        user: userId,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
    }, {
        orderBy: { createdAt: 'DESC' }
    });

    return sessions.map(s => ({
        id: s.id,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt
    }));
}

/**
 * Revoke a specific session
 */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const em = getEntityManager();
    // Parse sessionId to number since Entity uses IntBaseEntity (Serial PK)
    const id = parseInt(sessionId, 10);
    if (isNaN(id)) return false;

    const session = await em.findOne(RefreshToken, {
        id,
        user: userId,
        isRevoked: false
    });

    if (!session) return false;

    session.revoke();
    await em.flush();
    return true;
}

/**
 * Clean up expired tokens (call periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
    const em = getEntityManager();
    // Use QueryBuilder for bulk delete logic or simply custom query
    // Or iterate? Bulk delete is better.
    // Logic: expiresAt < NOW OR isRevoked = true

    // Using native query for performance and bulk deletion if needed, 
    // or QB: em.qb(RefreshToken).delete().where(...)
    const result = await em.nativeDelete(RefreshToken, {
        $or: [
            { expiresAt: { $lt: new Date() } },
            { isRevoked: true }
        ]
    });

    return result;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
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

    // Token operations
    generateAccessToken,
    generateRefreshToken,
    hashToken,

    // Session management
    getActiveSessions,
    revokeSession,
    cleanupExpiredTokens,
};
