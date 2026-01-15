/**
 * Input Sanitization Middleware
 *
 * Provides XSS protection by sanitizing user input in request body, query, and params.
 * This is a PRODUCTION SECURITY measure that should be applied to all routes.
 *
 * WHY THIS EXISTS:
 * - Defense in depth: Even with validation, sanitization adds another security layer
 * - XSS Prevention: Removes script tags, javascript: URIs, and event handlers
 * - Safe for stored data: Prevents malicious content from being persisted
 *
 * WHAT IT DOES:
 * - Removes <script> tags
 * - Removes javascript: URLs
 * - Removes inline event handlers (onclick=, onload=, etc.)
 *
 * WHAT IT DOESN'T SANITIZE (by design):
 * - queryContent: May contain legitimate SQL/code
 * - scriptContent: Contains code to execute
 * - password fields: Should not be modified
 *
 * USAGE:
 * app.use(sanitizeInput); // Apply globally
 * --- OR ---
 * router.post('/endpoint', sanitizeInput, controller.handler); // Per-route
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

// =============================================================================
// Types
// =============================================================================

type SanitizableValue = string | Record<string, unknown> | unknown[] | unknown;

// =============================================================================
// Sanitization Logic
// =============================================================================

/**
 * Recursively sanitize an object to prevent XSS attacks
 *
 * @param obj - Value to sanitize (can be string, object, array, or any)
 * @returns Sanitized value
 */
function sanitize(obj: SanitizableValue): SanitizableValue {
    if (typeof obj === 'string') {
        return obj
            // Remove <script>...</script> blocks
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            // Remove javascript: URLs
            .replace(/javascript:/gi, '')
            // Remove inline event handlers
            .replace(/on\w+=/gi, '');
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitize);
    }

    if (obj && typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip sanitization for fields that legitimately contain code
            // These fields are handled by other security measures (sandboxing, etc.)
            if (['queryContent', 'scriptContent', 'password', 'currentPassword', 'newPassword'].includes(key)) {
                sanitized[key] = value;
            } else {
                sanitized[key] = sanitize(value as SanitizableValue);
            }
        }
        return sanitized;
    }

    return obj;
}

// =============================================================================
// Middleware Export
// =============================================================================

/**
 * Express middleware to sanitize potentially dangerous input
 *
 * Sanitizes:
 * - req.body
 * - req.query
 * - req.params
 *
 * @example
 * // Global application
 * app.use(sanitizeInput);
 *
 * @example
 * // Per-route application
 * router.post('/submit', sanitizeInput, submitHandler);
 */
export const sanitizeInput: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query) as typeof req.query;
    }
    if (req.params) {
        req.params = sanitize(req.params) as typeof req.params;
    }

    next();
};

export default sanitizeInput;
