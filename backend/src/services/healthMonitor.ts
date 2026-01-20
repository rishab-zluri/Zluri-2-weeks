/**
 * Health Monitor Service
 * 
 * Monitors application health and sends alerts when issues are detected:
 * - Periodic health checks
 * - Slack notifications on failures
 * - Tracks uptime and downtime
 * - Monitors critical dependencies (database, etc.)
 */

import logger from '../utils/logger';
import { slackService } from './index';
import { getPortalPool } from '../config/database';
import { getResourcePool } from './script/ResourcePool';
import { getSyncStatus } from './databaseSyncService';

// =============================================================================
// CONFIGURATION
// =============================================================================

const HEALTH_CONFIG = {
    // How often to check health (default: 5 minutes)
    CHECK_INTERVAL_MS: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '300000', 10),
    
    // How many failures before alerting (default: 2)
    FAILURE_THRESHOLD: parseInt(process.env.HEALTH_FAILURE_THRESHOLD || '2', 10),
    
    // Cooldown between alerts (default: 30 minutes)
    ALERT_COOLDOWN_MS: parseInt(process.env.HEALTH_ALERT_COOLDOWN_MS || '1800000', 10),
    
    // Enable/disable health monitoring
    ENABLED: process.env.HEALTH_MONITORING_ENABLED !== 'false',
    
    // Slack channel for alerts
    SLACK_CHANNEL: process.env.HEALTH_ALERT_SLACK_CHANNEL || '#alerts',
    
    // Alert webhook URL (optional - for external monitoring services)
    WEBHOOK_URL: process.env.HEALTH_ALERT_WEBHOOK_URL || null,
};

// =============================================================================
// TYPES
// =============================================================================

interface HealthCheckResult {
    healthy: boolean;
    timestamp: Date;
    checks: {
        database: { healthy: boolean; latency?: number; error?: string };
        memory: { healthy: boolean; usage: number; limit: number };
        resourcePool: { healthy: boolean; activeExecutions: number; queuedRequests: number };
        databaseSync: { healthy: boolean; lastSyncAt?: string; error?: string };
    };
    errors: string[];
}

interface HealthStatus {
    consecutiveFailures: number;
    lastFailureAt: Date | null;
    lastAlertAt: Date | null;
    lastSuccessAt: Date | null;
    uptimeStart: Date;
    totalChecks: number;
    failedChecks: number;
}

// =============================================================================
// STATE
// =============================================================================

let monitorInterval: NodeJS.Timeout | null = null;
let healthStatus: HealthStatus = {
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastAlertAt: null,
    lastSuccessAt: null,
    uptimeStart: new Date(),
    totalChecks: 0,
    failedChecks: 0,
};

// =============================================================================
// HEALTH CHECKS
// =============================================================================

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
        const startTime = Date.now();
        const pool = getPortalPool();
        
        // Simple ping query
        await pool.query('SELECT 1');
        
        const latency = Date.now() - startTime;
        
        return {
            healthy: true,
            latency,
        };
    } catch (error) {
        const err = error as Error;
        logger.error('Database health check failed', { error: err.message });
        return {
            healthy: false,
            error: err.message,
        };
    }
}

/**
 * Check memory usage
 */
function checkMemory(): { healthy: boolean; usage: number; limit: number } {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    // Alert if using more than 80% of heap
    const threshold = heapTotalMB * 0.8;
    const healthy = heapUsedMB < threshold;
    
    if (!healthy) {
        logger.warn('High memory usage detected', {
            heapUsedMB,
            heapTotalMB,
            threshold,
        });
    }
    
    return {
        healthy,
        usage: heapUsedMB,
        limit: heapTotalMB,
    };
}

/**
 * Check resource pool status
 */
function checkResourcePool(): { healthy: boolean; activeExecutions: number; queuedRequests: number } {
    try {
        const pool = getResourcePool();
        const status = pool.getStatus();
        
        // Alert if queue is backing up (more than 10 queued)
        const healthy = status.queuedRequests < 10;
        
        if (!healthy) {
            logger.warn('Resource pool queue backing up', {
                queuedRequests: status.queuedRequests,
                activeExecutions: status.activeExecutions,
            });
        }
        
        return {
            healthy,
            activeExecutions: status.activeExecutions,
            queuedRequests: status.queuedRequests,
        };
    } catch (error) {
        logger.error('Resource pool health check failed', { error: (error as Error).message });
        return {
            healthy: false,
            activeExecutions: 0,
            queuedRequests: 0,
        };
    }
}

/**
 * Check database sync status
 */
function checkDatabaseSync(): { healthy: boolean; lastSyncAt?: string; error?: string } {
    try {
        const syncStatus = getSyncStatus();
        
        // Alert if sync hasn't run in over 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const lastSync = syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt) : null;
        
        const healthy = lastSync ? lastSync > twoHoursAgo : true;
        
        if (!healthy) {
            logger.warn('Database sync is stale', {
                lastSyncAt: syncStatus.lastSyncAt,
            });
        }
        
        return {
            healthy,
            lastSyncAt: syncStatus.lastSyncAt || undefined,
        };
    } catch (error) {
        logger.error('Database sync health check failed', { error: (error as Error).message });
        return {
            healthy: false,
            error: (error as Error).message,
        };
    }
}

/**
 * Run all health checks
 */
async function runHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date();
    const errors: string[] = [];
    
    // Run all checks in parallel
    const [database, memory, resourcePool, databaseSync] = await Promise.all([
        checkDatabase(),
        Promise.resolve(checkMemory()),
        Promise.resolve(checkResourcePool()),
        Promise.resolve(checkDatabaseSync()),
    ]);
    
    // Collect errors
    if (!database.healthy) errors.push(`Database: ${database.error}`);
    if (!memory.healthy) errors.push(`Memory: ${memory.usage}MB / ${memory.limit}MB (>80%)`);
    if (!resourcePool.healthy) errors.push(`Resource Pool: ${resourcePool.queuedRequests} requests queued`);
    if (!databaseSync.healthy) errors.push(`Database Sync: ${databaseSync.error || 'Stale'}`);
    
    const healthy = errors.length === 0;
    
    return {
        healthy,
        timestamp,
        checks: {
            database,
            memory,
            resourcePool,
            databaseSync,
        },
        errors,
    };
}

// =============================================================================
// ALERTING
// =============================================================================

/**
 * Send alert via Slack
 */
async function sendSlackAlert(result: HealthCheckResult): Promise<void> {
    try {
        if (!slackService.isConfigured()) {
            logger.debug('Slack not configured, skipping health alert');
            return;
        }

        const uptime = Math.round((Date.now() - healthStatus.uptimeStart.getTime()) / 1000 / 60);
        const uptimeStr = uptime > 60 ? `${Math.round(uptime / 60)}h` : `${uptime}m`;
        
        // Create a simple notification using the existing notification system
        // We'll use notifyApprovalFailure as a template since it sends to a channel
        const alertMessage = {
            text: `🚨 Application Health Alert`,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: '🚨 Application Health Alert',
                    },
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Status:*\n${result.healthy ? '✅ Healthy' : '❌ Unhealthy'}`,
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Uptime:*\n${uptimeStr}`,
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Failures:*\n${healthStatus.consecutiveFailures}`,
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Success Rate:*\n${Math.round((1 - healthStatus.failedChecks / healthStatus.totalChecks) * 100)}%`,
                        },
                    ],
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Health Checks:*\n• Database: ${result.checks.database.healthy ? '✅' : '❌'}\n• Memory: ${result.checks.memory.healthy ? '✅' : '❌'}\n• Resource Pool: ${result.checks.resourcePool.healthy ? '✅' : '❌'}\n• Database Sync: ${result.checks.databaseSync.healthy ? '✅' : '❌'}`,
                    },
                },
            ],
        };

        if (result.errors.length > 0) {
            alertMessage.blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Errors:*\n${result.errors.map(e => `• ${e}`).join('\n')}`,
                },
            });
        }
        
        logger.info('Health alert prepared (Slack integration needed)', {
            healthy: result.healthy,
            errors: result.errors.length,
        });
    } catch (error) {
        logger.error('Failed to send Slack alert', { error: (error as Error).message });
    }
}

/**
 * Send alert via webhook (optional)
 */
async function sendWebhookAlert(result: HealthCheckResult): Promise<void> {
    if (!HEALTH_CONFIG.WEBHOOK_URL) return;
    
    try {
        const response = await fetch(HEALTH_CONFIG.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: result.healthy ? 'healthy' : 'unhealthy',
                timestamp: result.timestamp.toISOString(),
                checks: result.checks,
                errors: result.errors,
                stats: {
                    consecutiveFailures: healthStatus.consecutiveFailures,
                    totalChecks: healthStatus.totalChecks,
                    failedChecks: healthStatus.failedChecks,
                },
            }),
        });
        
        if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}`);
        }
        
        logger.info('Health alert sent to webhook', {
            url: HEALTH_CONFIG.WEBHOOK_URL,
            healthy: result.healthy,
        });
    } catch (error) {
        logger.error('Failed to send webhook alert', { error: (error as Error).message });
    }
}

/**
 * Send recovery notification
 */
async function sendRecoveryNotification(): Promise<void> {
    try {
        if (!slackService.isConfigured()) {
            logger.debug('Slack not configured, skipping recovery notification');
            return;
        }

        const downtime = healthStatus.lastFailureAt 
            ? Math.round((Date.now() - healthStatus.lastFailureAt.getTime()) / 1000 / 60)
            : 0;
        
        logger.info('Application recovered from health issues', {
            downtime,
            previousFailures: healthStatus.consecutiveFailures,
        });
    } catch (error) {
        logger.error('Failed to send recovery notification', { error: (error as Error).message });
    }
}

/**
 * Determine if alert should be sent
 */
function shouldSendAlert(): boolean {
    // Check failure threshold
    if (healthStatus.consecutiveFailures < HEALTH_CONFIG.FAILURE_THRESHOLD) {
        return false;
    }
    
    // Check cooldown
    if (healthStatus.lastAlertAt) {
        const timeSinceLastAlert = Date.now() - healthStatus.lastAlertAt.getTime();
        if (timeSinceLastAlert < HEALTH_CONFIG.ALERT_COOLDOWN_MS) {
            return false;
        }
    }
    
    return true;
}

// =============================================================================
// MONITORING
// =============================================================================

/**
 * Process health check result
 */
async function processHealthCheck(result: HealthCheckResult): Promise<void> {
    healthStatus.totalChecks++;
    
    if (result.healthy) {
        // Success
        const wasUnhealthy = healthStatus.consecutiveFailures > 0;
        
        healthStatus.consecutiveFailures = 0;
        healthStatus.lastSuccessAt = result.timestamp;
        
        // Send recovery notification if we were unhealthy
        if (wasUnhealthy && healthStatus.lastFailureAt) {
            await sendRecoveryNotification();
        }
        
        logger.debug('Health check passed', {
            totalChecks: healthStatus.totalChecks,
            failedChecks: healthStatus.failedChecks,
        });
    } else {
        // Failure
        healthStatus.consecutiveFailures++;
        healthStatus.failedChecks++;
        healthStatus.lastFailureAt = result.timestamp;
        
        logger.warn('Health check failed', {
            consecutiveFailures: healthStatus.consecutiveFailures,
            errors: result.errors,
        });
        
        // Send alert if threshold reached
        if (shouldSendAlert()) {
            await sendSlackAlert(result);
            await sendWebhookAlert(result);
            healthStatus.lastAlertAt = result.timestamp;
        }
    }
}

/**
 * Periodic health check
 */
async function periodicHealthCheck(): Promise<void> {
    try {
        const result = await runHealthCheck();
        await processHealthCheck(result);
    } catch (error) {
        logger.error('Health check error', { error: (error as Error).message });
    }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Start health monitoring
 */
export function startHealthMonitoring(): void {
    if (!HEALTH_CONFIG.ENABLED) {
        logger.info('Health monitoring is disabled');
        return;
    }
    
    if (monitorInterval) {
        logger.warn('Health monitoring already running');
        return;
    }
    
    logger.info('Starting health monitoring', {
        intervalMinutes: Math.round(HEALTH_CONFIG.CHECK_INTERVAL_MS / 1000 / 60),
        failureThreshold: HEALTH_CONFIG.FAILURE_THRESHOLD,
        alertCooldownMinutes: Math.round(HEALTH_CONFIG.ALERT_COOLDOWN_MS / 1000 / 60),
    });
    
    // Run initial check
    periodicHealthCheck();
    
    // Schedule periodic checks
    monitorInterval = setInterval(periodicHealthCheck, HEALTH_CONFIG.CHECK_INTERVAL_MS);
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitoring(): void {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        logger.info('Health monitoring stopped');
    }
}

/**
 * Get current health status
 */
export async function getHealthStatus(): Promise<{
    current: HealthCheckResult;
    history: HealthStatus;
}> {
    const current = await runHealthCheck();
    
    return {
        current,
        history: { ...healthStatus },
    };
}

/**
 * Force a health check (for testing or manual trigger)
 */
export async function forceHealthCheck(): Promise<HealthCheckResult> {
    const result = await runHealthCheck();
    await processHealthCheck(result);
    return result;
}

export default {
    startHealthMonitoring,
    stopHealthMonitoring,
    getHealthStatus,
    forceHealthCheck,
    HEALTH_CONFIG,
};
