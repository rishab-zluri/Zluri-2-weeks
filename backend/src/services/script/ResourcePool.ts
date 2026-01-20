/**
 * Global Resource Pool Manager
 * 
 * Manages system-wide resources to prevent exhaustion:
 * - Tracks total memory usage across all scripts
 * - Limits concurrent executions
 * - Queues requests when resources are exhausted
 */

import logger from '../../utils/logger';
import { EventEmitter } from 'events';

// =============================================================================
// CONFIGURATION
// =============================================================================

const POOL_CONFIG = {
    // Maximum total memory for all scripts (2GB)
    MAX_TOTAL_MEMORY_MB: parseInt(process.env.POOL_MAX_TOTAL_MEMORY_MB || '2048', 10),
    
    // Memory per script (512MB)
    MEMORY_PER_SCRIPT_MB: parseInt(process.env.POOL_MEMORY_PER_SCRIPT_MB || '512', 10),
    
    // Maximum concurrent executions
    MAX_CONCURRENT: parseInt(process.env.POOL_MAX_CONCURRENT || '5', 10),
    
    // Queue timeout (5 minutes)
    QUEUE_TIMEOUT_MS: parseInt(process.env.POOL_QUEUE_TIMEOUT_MS || '300000', 10),
};

// =============================================================================
// RESOURCE POOL
// =============================================================================

interface ExecutionSlot {
    id: string;
    memoryMB: number;
    startTime: number;
}

interface QueuedRequest {
    id: string;
    memoryMB: number;
    resolve: (slot: ExecutionSlot) => void;
    reject: (error: Error) => void;
    queuedAt: number;
    timeoutId: NodeJS.Timeout;
}

class ResourcePoolManager extends EventEmitter {
    private activeExecutions: Map<string, ExecutionSlot> = new Map();
    private queue: QueuedRequest[] = [];
    private totalMemoryUsed = 0;
    
    /**
     * Acquire resources for script execution
     * Returns a slot if resources available, otherwise queues the request
     */
    public async acquire(requestId: string, memoryMB: number = POOL_CONFIG.MEMORY_PER_SCRIPT_MB): Promise<ExecutionSlot> {
        return new Promise((resolve, reject) => {
            // Check if resources are available
            if (this.canAcquire(memoryMB)) {
                const slot = this.doAcquire(requestId, memoryMB);
                resolve(slot);
                return;
            }
            
            // Queue the request
            logger.info('Resource pool full, queueing request', {
                requestId,
                queueLength: this.queue.length,
                activeExecutions: this.activeExecutions.size,
                totalMemoryUsed: this.totalMemoryUsed,
            });
            
            const timeoutId = setTimeout(() => {
                this.removeFromQueue(requestId);
                reject(new Error(`Resource acquisition timeout after ${POOL_CONFIG.QUEUE_TIMEOUT_MS}ms`));
            }, POOL_CONFIG.QUEUE_TIMEOUT_MS);
            
            this.queue.push({
                id: requestId,
                memoryMB,
                resolve,
                reject,
                queuedAt: Date.now(),
                timeoutId,
            });
        });
    }
    
    /**
     * Release resources after script execution
     */
    public release(requestId: string): void {
        const slot = this.activeExecutions.get(requestId);
        if (!slot) {
            logger.warn('Attempted to release non-existent slot', { requestId });
            return;
        }
        
        this.activeExecutions.delete(requestId);
        this.totalMemoryUsed -= slot.memoryMB;
        
        const duration = Date.now() - slot.startTime;
        logger.info('Released execution slot', {
            requestId,
            duration,
            memoryMB: slot.memoryMB,
            remainingSlots: this.activeExecutions.size,
            totalMemoryUsed: this.totalMemoryUsed,
        });
        
        // Process queue
        this.processQueue();
    }
    
    /**
     * Check if resources can be acquired
     */
    private canAcquire(memoryMB: number): boolean {
        // Check concurrent execution limit
        if (this.activeExecutions.size >= POOL_CONFIG.MAX_CONCURRENT) {
            return false;
        }
        
        // Check memory limit
        if (this.totalMemoryUsed + memoryMB > POOL_CONFIG.MAX_TOTAL_MEMORY_MB) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Actually acquire resources (internal)
     */
    private doAcquire(requestId: string, memoryMB: number): ExecutionSlot {
        const slot: ExecutionSlot = {
            id: requestId,
            memoryMB,
            startTime: Date.now(),
        };
        
        this.activeExecutions.set(requestId, slot);
        this.totalMemoryUsed += memoryMB;
        
        logger.info('Acquired execution slot', {
            requestId,
            memoryMB,
            activeSlots: this.activeExecutions.size,
            totalMemoryUsed: this.totalMemoryUsed,
        });
        
        return slot;
    }
    
    /**
     * Process queued requests
     */
    private processQueue(): void {
        while (this.queue.length > 0) {
            const request = this.queue[0];
            
            if (this.canAcquire(request.memoryMB)) {
                // Remove from queue
                this.queue.shift();
                clearTimeout(request.timeoutId);
                
                // Acquire resources
                const slot = this.doAcquire(request.id, request.memoryMB);
                
                const waitTime = Date.now() - request.queuedAt;
                logger.info('Processed queued request', {
                    requestId: request.id,
                    waitTime,
                    remainingQueue: this.queue.length,
                });
                
                request.resolve(slot);
            } else {
                // Can't process more, stop
                break;
            }
        }
    }
    
    /**
     * Remove request from queue
     */
    private removeFromQueue(requestId: string): void {
        const index = this.queue.findIndex(r => r.id === requestId);
        if (index !== -1) {
            const request = this.queue[index];
            clearTimeout(request.timeoutId);
            this.queue.splice(index, 1);
            logger.info('Removed request from queue', { requestId, remainingQueue: this.queue.length });
        }
    }
    
    /**
     * Get current pool status
     */
    public getStatus(): {
        activeExecutions: number;
        queuedRequests: number;
        totalMemoryUsed: number;
        maxMemory: number;
        maxConcurrent: number;
        availableSlots: number;
    } {
        return {
            activeExecutions: this.activeExecutions.size,
            queuedRequests: this.queue.length,
            totalMemoryUsed: this.totalMemoryUsed,
            maxMemory: POOL_CONFIG.MAX_TOTAL_MEMORY_MB,
            maxConcurrent: POOL_CONFIG.MAX_CONCURRENT,
            availableSlots: Math.max(0, POOL_CONFIG.MAX_CONCURRENT - this.activeExecutions.size),
        };
    }
    
    /**
     * Force cleanup (for testing/shutdown)
     */
    public cleanup(): void {
        // Clear all timeouts
        for (const request of this.queue) {
            clearTimeout(request.timeoutId);
            request.reject(new Error('Resource pool shutting down'));
        }
        
        this.queue = [];
        this.activeExecutions.clear();
        this.totalMemoryUsed = 0;
        
        logger.info('Resource pool cleaned up');
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let poolInstance: ResourcePoolManager | null = null;

export function getResourcePool(): ResourcePoolManager {
    if (!poolInstance) {
        poolInstance = new ResourcePoolManager();
        logger.info('Resource pool initialized', {
            maxMemory: POOL_CONFIG.MAX_TOTAL_MEMORY_MB,
            maxConcurrent: POOL_CONFIG.MAX_CONCURRENT,
            memoryPerScript: POOL_CONFIG.MEMORY_PER_SCRIPT_MB,
        });
    }
    return poolInstance;
}

export function resetResourcePool(): void {
    if (poolInstance) {
        poolInstance.cleanup();
        poolInstance = null;
    }
}

export default {
    getResourcePool,
    resetResourcePool,
    POOL_CONFIG,
};
