/**
 * Origin Validation Middleware
 * 
 * Provides additional CSRF protection by validating request origins
 * for sensitive endpoints. Works alongside SameSite cookies.
 * 
 * WHY THIS EXISTS:
 * - Extra layer of CSRF protection beyond SameSite cookies
 * - Detects cross-origin attacks even if cookies are somehow sent
 * - Logs suspicious origin mismatches for security monitoring
 * 
 * SECURITY CONSIDERATIONS:
 * - Validates both Origin and Referer headers
 * - Allows requests with no origin (non-browser clients like mobile apps)
 * - Strict mode for mutation endpoints (POST, PUT, DELETE)
 */

import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../utils/logger';

/**
 * Get client IP address from request
 * Handles proxied requests (X-Forwarded-For)
 */
export function getClientIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // X-Forwarded-For can be comma-separated list
        const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        return ips.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Extract origin from request headers
 * Falls back to Referer if Origin is not present
 */
function getRequestOrigin(req: Request): string | null {
    const origin = req.headers.origin;
    if (origin) {
        return origin;
    }

    // Fallback to Referer header
    const referer = req.headers.referer;
    if (referer) {
        try {
            const url = new URL(referer);
            return `${url.protocol}//${url.host}`;
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string): boolean {
    const allowedOrigins = Array.isArray(config.cors.origin)
        ? config.cors.origin
        : [config.cors.origin];

    // Allow if '*' is in allowed origins (not recommended for production)
    if (allowedOrigins.includes('*')) {
        return true;
    }

    return allowedOrigins.includes(origin);
}

/**
 * Origin Validation Middleware
 * 
 * Validates that the request origin matches allowed origins for
 * state-changing requests (POST, PUT, DELETE, PATCH).
 * 
 * @param options Configuration options
 * @param options.strictMode If true, rejects requests with invalid origins (default: true)
 * @param options.allowNoOrigin If true, allows requests without origin header (default: true for non-browser clients)
 */
export interface OriginValidationOptions {
    strictMode?: boolean;
    allowNoOrigin?: boolean;
}

export function validateOrigin(options: OriginValidationOptions = {}) {
    const { strictMode = true, allowNoOrigin = true } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
        // Only validate state-changing methods
        const mutationMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        if (!mutationMethods.includes(req.method)) {
            return next();
        }

        const origin = getRequestOrigin(req);
        const clientIP = getClientIP(req);

        // No origin header (non-browser client)
        if (!origin) {
            if (allowNoOrigin) {
                return next();
            }
            logger.warn('Request without origin header on sensitive endpoint', {
                path: req.path,
                method: req.method,
                ip: clientIP,
                userAgent: req.headers['user-agent'],
            });
            if (strictMode) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ORIGIN_REQUIRED',
                        message: 'Origin header is required for this request',
                    },
                });
                return;
            }
            return next();
        }

        // Check if origin is allowed
        if (!isOriginAllowed(origin)) {
            logger.warn('Invalid origin detected', {
                origin,
                path: req.path,
                method: req.method,
                ip: clientIP,
                userAgent: req.headers['user-agent'],
            });

            if (strictMode) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'INVALID_ORIGIN',
                        message: 'Request origin is not allowed',
                    },
                });
                return;
            }
        }

        next();
    };
}

/**
 * Sensitive endpoints middleware
 * Apply stricter origin validation to sensitive endpoints
 */
export const sensitiveEndpointsOriginCheck = validateOrigin({
    strictMode: true,
    allowNoOrigin: true, // Allow API clients without browser origin
});

export default {
    validateOrigin,
    sensitiveEndpointsOriginCheck,
    getClientIP,
};
