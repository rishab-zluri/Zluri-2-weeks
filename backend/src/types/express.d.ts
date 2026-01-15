/**
 * Express Request/Response Extensions
 * Extends Express types with application-specific properties
 */

import type { UserRoleValue } from '../constants/auth';

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
    id: string;
    email: string;
    role: UserRoleValue;
    podId?: string;
    slackUserId?: string;
    managedPods: string[];
}

/**
 * JWT Access Token Payload
 */
export interface AccessTokenPayload {
    userId: string;
    email: string;
    role: UserRoleValue;
    podId?: string;
    managedPods: string[];
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
    sub?: string;
}

/**
 * JWT Refresh Token Payload
 */
export interface RefreshTokenPayload {
    userId: string;
    tokenId: string;
    type: 'refresh';
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
    sub?: string;
}

/**
 * Token pair returned after login/refresh
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
}

/**
 * Session info for user sessions list
 */
export interface SessionInfo {
    sessionId: string;
    createdAt: Date;
    expiresAt: Date;
    expiresIn: number;
}

/**
 * Logout result
 */
export interface LogoutResult {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Logout all result
 */
export interface LogoutAllResult {
    success: boolean;
    message: string;
    sessionsRevoked: number;
}

/**
 * User data for token generation
 */
export interface TokenUser {
    id: string;
    email: string;
    role: UserRoleValue;
    pod_id?: string;
    podId?: string;
    name?: string;
    managed_pods?: string[];
    managedPods?: string[];
}

/**
 * Refresh token verification result
 */
export interface RefreshTokenData {
    userId: string;
    email: string;
    role: UserRoleValue;
    podId?: string;
    name?: string;
    tokenId: string;
}

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            /**
             * Authenticated user (set by authenticate middleware)
             */
            user?: AuthenticatedUser;

            /**
             * Current access token (for blacklisting on logout)
             */
            accessToken?: string;

            /**
             * Raw body for webhook signature verification
             */
            rawBody?: Buffer;
        }
    }
}

export { };
