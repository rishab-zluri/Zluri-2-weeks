/**
 * Rate Limiting Middleware
 * 
 * Prevents resource exhaustion by limiting:
 * - Script executions per user per hour
 * - Pending requests per POD
 * - Total concurrent executions
 */

import { Request, Response, NextFunction } from 'express';
import { getEntityManager } from '../db';
import { QueryRequest, RequestStatus, SubmissionType } from '../entities/QueryRequest';
import * as response from '../utils/response';
import logger from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const RATE_LIMITS = {
    // Max script executions per user per hour
    SCRIPT_EXECUTIONS_PER_USER_PER_HOUR: parseInt(process.env.RATE_LIMIT_SCRIPTS_PER_HOUR || '10', 10),
    
    // Max query executions per user per hour
    QUERY_EXECUTIONS_PER_USER_PER_HOUR: parseInt(process.env.RATE_LIMIT_QUERIES_PER_HOUR || '20', 10),
    
    // Max pending requests per POD
    MAX_PENDING_PER_POD: parseInt(process.env.RATE_LIMIT_PENDING_PER_POD || '50', 10),
    
    // Max pending requests per user
    MAX_PENDING_PER_USER: parseInt(process.env.RATE_LIMIT_PENDING_PER_USER || '10', 10),
    
    // Max concurrent executions globally
    MAX_CONCURRENT_EXECUTIONS: parseInt(process.env.RATE_LIMIT_MAX_CONCURRENT || '5', 10),
};

// =============================================================================
// RATE LIMIT CHECKS
// =============================================================================

/**
 * Check if user has exceeded script execution rate limit
 */
async function checkScriptExecutionLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
    const em = getEntityManager();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const count = await em.count(QueryRequest, {
        user: userId,
        submissionType: SubmissionType.SCRIPT,
        createdAt: { $gte: oneHourAgo },
    });
    
    if (count >= RATE_LIMITS.SCRIPT_EXECUTIONS_PER_USER_PER_HOUR) {
        return {
            allowed: false,
            message: `Rate limit exceeded: Maximum ${RATE_LIMITS.SCRIPT_EXECUTIONS_PER_USER_PER_HOUR} script submissions per hour. Please try again later.`
        };
    }
    
    return { allowed: true };
}

/**
 * Check if user has exceeded query execution rate limit
 */
async function checkQueryExecutionLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
    const em = getEntityManager();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const count = await em.count(QueryRequest, {
        user: userId,
        submissionType: SubmissionType.QUERY,
        createdAt: { $gte: oneHourAgo },
    });
    
    if (count >= RATE_LIMITS.QUERY_EXECUTIONS_PER_USER_PER_HOUR) {
        return {
            allowed: false,
            message: `Rate limit exceeded: Maximum ${RATE_LIMITS.QUERY_EXECUTIONS_PER_USER_PER_HOUR} query submissions per hour. Please try again later.`
        };
    }
    
    return { allowed: true };
}

/**
 * Check if user has too many pending requests
 */
async function checkPendingUserLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
    const em = getEntityManager();
    
    const count = await em.count(QueryRequest, {
        user: userId,
        status: RequestStatus.PENDING,
    });
    
    if (count >= RATE_LIMITS.MAX_PENDING_PER_USER) {
        return {
            allowed: false,
            message: `Too many pending requests: You have ${count} pending requests. Maximum allowed is ${RATE_LIMITS.MAX_PENDING_PER_USER}. Please wait for approval or cancel some requests.`
        };
    }
    
    return { allowed: true };
}

/**
 * Check if POD has too many pending requests
 */
async function checkPendingPodLimit(podId: string): Promise<{ allowed: boolean; message?: string }> {
    const em = getEntityManager();
    
    const count = await em.count(QueryRequest, {
        podId,
        status: RequestStatus.PENDING,
    });
    
    if (count >= RATE_LIMITS.MAX_PENDING_PER_POD) {
        return {
            allowed: false,
            message: `POD queue full: Your POD has ${count} pending requests. Maximum allowed is ${RATE_LIMITS.MAX_PENDING_PER_POD}. Please wait for approvals to complete.`
        };
    }
    
    return { allowed: true };
}

/**
 * Check if system has too many concurrent executions
 */
async function checkConcurrentExecutionLimit(): Promise<{ allowed: boolean; message?: string }> {
    const em = getEntityManager();
    
    const count = await em.count(QueryRequest, {
        status: RequestStatus.EXECUTING,
    });
    
    if (count >= RATE_LIMITS.MAX_CONCURRENT_EXECUTIONS) {
        return {
            allowed: false,
            message: `System busy: ${count} requests are currently executing. Maximum concurrent executions is ${RATE_LIMITS.MAX_CONCURRENT_EXECUTIONS}. Please try again in a few moments.`
        };
    }
    
    return { allowed: true };
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Rate limit middleware for request submission
 * Checks multiple limits before allowing submission
 */
export const rateLimitSubmission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = req.user!;
        const { submissionType, podId } = req.body;
        
        // Check user-specific limits
        const pendingUserCheck = await checkPendingUserLimit(user.id);
        if (!pendingUserCheck.allowed) {
            logger.warn('Rate limit: User pending limit exceeded', { userId: user.id });
            response.error(res, pendingUserCheck.message!, 429, 'RATE_LIMIT_EXCEEDED');
            return;
        }
        
        // Check submission type specific limits
        if (submissionType === 'script') {
            const scriptCheck = await checkScriptExecutionLimit(user.id);
            if (!scriptCheck.allowed) {
                logger.warn('Rate limit: Script execution limit exceeded', { userId: user.id });
                response.error(res, scriptCheck.message!, 429, 'RATE_LIMIT_EXCEEDED');
                return;
            }
        } else if (submissionType === 'query') {
            const queryCheck = await checkQueryExecutionLimit(user.id);
            if (!queryCheck.allowed) {
                logger.warn('Rate limit: Query execution limit exceeded', { userId: user.id });
                response.error(res, queryCheck.message!, 429, 'RATE_LIMIT_EXCEEDED');
                return;
            }
        }
        
        // Check POD limits
        if (podId) {
            const podCheck = await checkPendingPodLimit(podId);
            if (!podCheck.allowed) {
                logger.warn('Rate limit: POD pending limit exceeded', { podId, userId: user.id });
                response.error(res, podCheck.message!, 429, 'RATE_LIMIT_EXCEEDED');
                return;
            }
        }
        
        next();
    } catch (error) {
        const err = error as Error;
        logger.error('Rate limit check error', { error: err.message });
        // On error, allow the request (fail open for availability)
        next();
    }
};

/**
 * Rate limit middleware for execution (approval)
 * Checks concurrent execution limits
 */
export const rateLimitExecution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const concurrentCheck = await checkConcurrentExecutionLimit();
        if (!concurrentCheck.allowed) {
            logger.warn('Rate limit: Concurrent execution limit exceeded');
            response.error(res, concurrentCheck.message!, 429, 'RATE_LIMIT_EXCEEDED');
            return;
        }
        
        next();
    } catch (error) {
        const err = error as Error;
        logger.error('Rate limit check error', { error: err.message });
        // On error, allow the request (fail open for availability)
        next();
    }
};

/**
 * Get current rate limit status for a user
 */
export async function getRateLimitStatus(userId: string): Promise<{
    scriptsUsed: number;
    scriptsLimit: number;
    queriesUsed: number;
    queriesLimit: number;
    pendingRequests: number;
    pendingLimit: number;
}> {
    const em = getEntityManager();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const [scriptsUsed, queriesUsed, pendingRequests] = await Promise.all([
        em.count(QueryRequest, {
            user: userId,
            submissionType: SubmissionType.SCRIPT,
            createdAt: { $gte: oneHourAgo },
        }),
        em.count(QueryRequest, {
            user: userId,
            submissionType: SubmissionType.QUERY,
            createdAt: { $gte: oneHourAgo },
        }),
        em.count(QueryRequest, {
            user: userId,
            status: RequestStatus.PENDING,
        }),
    ]);
    
    return {
        scriptsUsed,
        scriptsLimit: RATE_LIMITS.SCRIPT_EXECUTIONS_PER_USER_PER_HOUR,
        queriesUsed,
        queriesLimit: RATE_LIMITS.QUERY_EXECUTIONS_PER_USER_PER_HOUR,
        pendingRequests,
        pendingLimit: RATE_LIMITS.MAX_PENDING_PER_USER,
    };
}

export default {
    rateLimitSubmission,
    rateLimitExecution,
    getRateLimitStatus,
    RATE_LIMITS,
};
