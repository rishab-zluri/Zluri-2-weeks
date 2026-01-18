/**
 * Audit Logger
 * 
 * Specialized logging for security-sensitive actions.
 * Creates structured audit logs for compliance and incident investigation.
 * 
 * WHY THIS EXISTS:
 * - Compliance: Many regulations require audit trails (SOC2, GDPR, etc.)
 * - Security: Enables incident investigation and forensics
 * - Monitoring: Unusual patterns can be detected via log analysis
 * 
 * WHAT IS LOGGED:
 * - Request approvals/rejections
 * - User authentication events
 * - Role changes
 * - Sensitive data access
 * 
 * LOG STRUCTURE:
 * - Timestamp (UTC)
 * - Event type
 * - Actor (who performed the action)
 * - Target (what was affected)
 * - IP address
 * - User agent
 * - Additional metadata
 */

import logger from './logger';
import { Request } from 'express';

// =============================================================================
// TYPES
// =============================================================================

export enum AuditEventType {
    // Authentication events
    LOGIN_SUCCESS = 'LOGIN_SUCCESS',
    LOGIN_FAILURE = 'LOGIN_FAILURE',
    LOGOUT = 'LOGOUT',
    TOKEN_REFRESH = 'TOKEN_REFRESH',

    // Request lifecycle events
    REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',
    REQUEST_APPROVED = 'REQUEST_APPROVED',
    REQUEST_REJECTED = 'REQUEST_REJECTED',
    REQUEST_EXECUTED = 'REQUEST_EXECUTED',
    REQUEST_FAILED = 'REQUEST_FAILED',

    // User management events
    USER_CREATED = 'USER_CREATED',
    USER_UPDATED = 'USER_UPDATED',
    USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
    USER_DEACTIVATED = 'USER_DEACTIVATED',
    USER_ACTIVATED = 'USER_ACTIVATED',
    PASSWORD_CHANGED = 'PASSWORD_CHANGED',
    PASSWORD_RESET = 'PASSWORD_RESET',

    // Access events
    UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
    FORBIDDEN_ACCESS = 'FORBIDDEN_ACCESS',
}

export interface AuditActor {
    id: string;
    email: string;
    role: string;
}

export interface AuditTarget {
    type: 'request' | 'user' | 'session';
    id: string;
    identifier?: string; // UUID, email, etc.
}

export interface AuditMetadata {
    reason?: string;
    previousValue?: unknown;
    newValue?: unknown;
    [key: string]: unknown;
}

export interface AuditLogEntry {
    timestamp: string;
    eventType: AuditEventType;
    actor: AuditActor | null;
    target?: AuditTarget;
    ipAddress: string;
    userAgent: string;
    metadata?: AuditMetadata;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get client IP address from request
 * Handles proxied requests (X-Forwarded-For)
 */
function getClientIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        return ips.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Get user agent from request
 */
function getUserAgent(req: Request): string {
    return req.headers['user-agent'] || 'unknown';
}

/**
 * Extract actor from authenticated request
 */
function extractActor(req: Request): AuditActor | null {
    if (!req.user) {
        return null;
    }
    return {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
    };
}

// =============================================================================
// AUDIT LOGGER CLASS
// =============================================================================

class AuditLogger {
    /**
     * Log an audit event from an Express request
     */
    log(
        req: Request,
        eventType: AuditEventType,
        target?: AuditTarget,
        metadata?: AuditMetadata
    ): void {
        const entry: AuditLogEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            actor: extractActor(req),
            target,
            ipAddress: getClientIP(req),
            userAgent: getUserAgent(req),
            metadata,
        };

        // Use a special log level for audit events
        logger.info('AUDIT', {
            audit: true,
            ...entry,
        });
    }

    /**
     * Log request approval
     */
    logApproval(
        req: Request,
        requestId: string,
        requestUuid: string,
        submitterEmail: string
    ): void {
        this.log(
            req,
            AuditEventType.REQUEST_APPROVED,
            {
                type: 'request',
                id: requestId,
                identifier: requestUuid,
            },
            {
                submitterEmail,
            }
        );
    }

    /**
     * Log request rejection
     */
    logRejection(
        req: Request,
        requestId: string,
        requestUuid: string,
        submitterEmail: string,
        reason: string
    ): void {
        this.log(
            req,
            AuditEventType.REQUEST_REJECTED,
            {
                type: 'request',
                id: requestId,
                identifier: requestUuid,
            },
            {
                submitterEmail,
                reason,
            }
        );
    }

    /**
     * Log request submission
     */
    logSubmission(
        req: Request,
        requestId: string,
        requestUuid: string,
        submissionType: string,
        databaseName: string
    ): void {
        this.log(
            req,
            AuditEventType.REQUEST_SUBMITTED,
            {
                type: 'request',
                id: requestId,
                identifier: requestUuid,
            },
            {
                submissionType,
                databaseName,
            }
        );
    }

    /**
     * Log successful login
     */
    logLoginSuccess(req: Request, userId: string, email: string): void {
        this.log(
            req,
            AuditEventType.LOGIN_SUCCESS,
            {
                type: 'user',
                id: userId,
                identifier: email,
            }
        );
    }

    /**
     * Log failed login attempt
     */
    logLoginFailure(req: Request, email: string, reason: string): void {
        this.log(
            req,
            AuditEventType.LOGIN_FAILURE,
            {
                type: 'user',
                id: 'unknown',
                identifier: email,
            },
            {
                reason,
            }
        );
    }

    /**
     * Log role change
     */
    logRoleChange(
        req: Request,
        targetUserId: string,
        targetEmail: string,
        previousRole: string,
        newRole: string
    ): void {
        this.log(
            req,
            AuditEventType.USER_ROLE_CHANGED,
            {
                type: 'user',
                id: targetUserId,
                identifier: targetEmail,
            },
            {
                previousValue: previousRole,
                newValue: newRole,
            }
        );
    }

    /**
     * Log unauthorized access attempt
     */
    logUnauthorizedAccess(req: Request, path: string): void {
        this.log(
            req,
            AuditEventType.UNAUTHORIZED_ACCESS,
            undefined,
            {
                path,
                method: req.method,
            }
        );
    }

    /**
     * Log forbidden access attempt
     */
    logForbiddenAccess(req: Request, path: string, requiredRole?: string): void {
        this.log(
            req,
            AuditEventType.FORBIDDEN_ACCESS,
            undefined,
            {
                path,
                method: req.method,
                requiredRole,
            }
        );
    }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

export default auditLogger;
