/**
 * Cookie Utilities
 *
 * Production-grade cookie configuration for secure token storage.
 * Uses HttpOnly cookies to prevent XSS attacks from stealing tokens.
 *
 * SECURITY FEATURES:
 * - HttpOnly: JavaScript cannot access the cookie (prevents XSS theft)
 * - Secure: Only sent over HTTPS (prevents MITM attacks)
 * - SameSite=Strict: Prevents CSRF attacks
 * - Domain/Path scoping: Limits where cookies are sent
 *
 * ARCHITECTURE:
 * - Centralized configuration for consistency
 * - Environment-aware (dev vs production)
 * - Backward compatible with Authorization header
 *
 * USAGE:
 * ```typescript
 * import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from '../utils/cookies';
 *
 * // On login/refresh
 * setAccessTokenCookie(res, accessToken);
 * setRefreshTokenCookie(res, refreshToken);
 *
 * // On logout
 * clearAuthCookies(res);
 * ```
 */

import { Response, Request, CookieOptions } from 'express';
import config from '../config';

// =============================================================================
// Cookie Configuration
// =============================================================================

/**
 * Cookie names - using prefixes for additional security
 *
 * __Host- prefix requirements:
 * - Must have Secure flag
 * - Must have Path=/
 * - Must NOT have Domain attribute
 * - Provides strongest cookie protection
 *
 * NOTE: __Host- prefix only works in production (HTTPS)
 * In development, we use simpler names
 */
export const COOKIE_NAMES = {
    ACCESS_TOKEN: config.isProduction ? '__Host-access_token' : 'access_token',
    REFRESH_TOKEN: config.isProduction ? '__Host-refresh_token' : 'refresh_token',
    CSRF_TOKEN: config.isProduction ? '__Host-csrf_token' : 'csrf_token',
} as const;

/**
 * Base cookie options shared across all auth cookies
 */
const getBaseCookieOptions = (): CookieOptions => ({
    httpOnly: true,                     // JavaScript cannot access
    secure: config.isProduction,        // HTTPS only in production
    // CRITICAL: Must be 'none' for Vercel (frontend) -> Railway (backend)
    // 'strict'/lax' will BLOCK cookies on cross-site requests
    sameSite: (config.security.cookieSameSite as 'strict' | 'lax' | 'none') || 'none',
    path: '/',                          // Available to all routes
    // Domain is intentionally NOT set for __Host- prefix compatibility
});

/**
 * Access token cookie options
 * Short-lived (matches JWT expiry)
 */
export const getAccessTokenCookieOptions = (): CookieOptions => ({
    ...getBaseCookieOptions(),
    maxAge: parseExpiry(config.jwt.expiresIn) * 1000, // Convert to ms
});

/**
 * Refresh token cookie options
 * Long-lived (matches refresh token expiry)
 */
export const getRefreshTokenCookieOptions = (): CookieOptions => ({
    ...getBaseCookieOptions(),
    maxAge: parseExpiry(config.jwt.refreshExpiresIn) * 1000, // Convert to ms
});

/**
 * CSRF token cookie options
 * NOT HttpOnly - needs to be read by JavaScript for double-submit pattern
 */
export const getCsrfCookieOptions = (): CookieOptions => ({
    ...getBaseCookieOptions(),
    httpOnly: false,  // JavaScript must read this for CSRF double-submit
});

// =============================================================================
// Cookie Helpers
// =============================================================================

/**
 * Parse JWT expiry string to seconds
 * Supports: 15m, 1h, 7d, etc.
 */
function parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
        // Default to 15 minutes if parsing fails
        return 15 * 60;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 60 * 60 * 24;
        default: return 15 * 60;
    }
}

// =============================================================================
// Cookie Setters
// =============================================================================

/**
 * Set access token cookie
 *
 * Called on:
 * - Login
 * - Token refresh
 */
export function setAccessTokenCookie(res: Response, token: string): void {
    res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        token,
        getAccessTokenCookieOptions()
    );
}

/**
 * Set refresh token cookie
 *
 * Called on:
 * - Login
 * - Token refresh (with new rotated token)
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie(
        COOKIE_NAMES.REFRESH_TOKEN,
        token,
        getRefreshTokenCookieOptions()
    );
}

/**
 * Set CSRF token cookie for double-submit pattern
 *
 * WHY: Since we're using cookies, we need CSRF protection.
 * The frontend reads this cookie and sends it in a header.
 * We verify the header matches the expected token.
 */
export function setCsrfTokenCookie(res: Response, token: string): void {
    res.cookie(
        COOKIE_NAMES.CSRF_TOKEN,
        token,
        getCsrfCookieOptions()
    );
}

/**
 * Set all auth cookies at once
 *
 * Called on login to set both access and refresh tokens
 */
export function setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    csrfToken?: string
): void {
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);
    if (csrfToken) {
        setCsrfTokenCookie(res, csrfToken);
    }
}

// =============================================================================
// Cookie Clearers
// =============================================================================

/**
 * Options for clearing cookies
 * Must match the options used when setting (except maxAge)
 */
const getClearCookieOptions = (): CookieOptions => ({
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
});

/**
 * Clear all auth cookies
 *
 * Called on:
 * - Logout
 * - Session invalidation
 */
export function clearAuthCookies(res: Response): void {
    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, getClearCookieOptions());
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, getClearCookieOptions());
    res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, {
        ...getClearCookieOptions(),
        httpOnly: false,
    });
}

// =============================================================================
// Cookie Extractors
// =============================================================================

/**
 * Extract access token from request
 *
 * Priority:
 * 1. Cookie (preferred for web clients)
 * 2. Authorization header (backward compatibility for API clients)
 *
 * WHY: Allows gradual migration. Mobile/API clients can still use
 * Authorization header, while web clients use cookies.
 *
 * TYPE: Uses generic to accept any Express Request variant
 */
export function extractAccessToken(req: Pick<Request, 'cookies' | 'headers'>): string | null {
    // 1. Try Authorization header first (API clients & SPA Header Mode)
    // This takes priority to allow headers to override potentially stale/invalid cookies
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    // 2. Fall back to cookie (Legacy web / Security fallback)
    const cookieToken = (req as any).cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
    if (cookieToken) {
        return cookieToken;
    }

    return null;
}

/**
 * Extract refresh token from request
 *
 * Priority:
 * 1. Cookie
 * 2. Request body (backward compatibility)
 *
 * TYPE: Uses flexible interface to accept any Express Request variant
 */
export function extractRefreshToken(req: Pick<Request, 'cookies'> & { body?: { refreshToken?: string } }): string | null {
    // 1. Try request body first (API clients & SPA Header Mode)
    // This takes priority to override potentially stale/invalid cookies
    if (req.body?.refreshToken) {
        return req.body.refreshToken;
    }

    // 2. Fall back to cookie
    const cookieToken = (req as any).cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
    if (cookieToken) {
        return cookieToken;
    }

    return null;
}

/**
 * Check if request is using cookie-based auth
 */
export function isUsingCookieAuth(req: Pick<Request, 'cookies'>): boolean {
    return !!(req as any).cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
}

// =============================================================================
// Exports
// =============================================================================

export default {
    COOKIE_NAMES,
    setAccessTokenCookie,
    setRefreshTokenCookie,
    setCsrfTokenCookie,
    setAuthCookies,
    clearAuthCookies,
    extractAccessToken,
    extractRefreshToken,
    isUsingCookieAuth,
    getAccessTokenCookieOptions,
    getRefreshTokenCookieOptions,
    getCsrfCookieOptions,
};
