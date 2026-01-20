/**
 * Result Validator
 * 
 * Validates execution results before storage to prevent:
 * - Database bloat from large results
 * - Memory exhaustion from serialization
 * - Slow queries from large TEXT columns
 */

import logger from './logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const RESULT_LIMITS = {
    // Maximum result size in bytes (10MB)
    MAX_RESULT_SIZE_BYTES: parseInt(process.env.MAX_RESULT_SIZE_BYTES || '10485760', 10), // 10MB
    
    // Maximum result size for display (1MB)
    MAX_DISPLAY_SIZE_BYTES: parseInt(process.env.MAX_DISPLAY_SIZE_BYTES || '1048576', 10), // 1MB
    
    // Maximum number of rows/documents to store
    MAX_ROWS_TO_STORE: parseInt(process.env.MAX_ROWS_TO_STORE || '1000', 10),
};

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationResult {
    valid: boolean;
    truncated: boolean;
    originalSize: number;
    truncatedSize?: number;
    result: any;
    warning?: string;
}

/**
 * Validate and potentially truncate result before storage
 */
export function validateResult(result: any): ValidationResult {
    try {
        // Serialize to check size
        const resultStr = JSON.stringify(result);
        const originalSize = Buffer.byteLength(resultStr, 'utf8');
        
        // If within limits, return as-is
        if (originalSize <= RESULT_LIMITS.MAX_RESULT_SIZE_BYTES) {
            return {
                valid: true,
                truncated: false,
                originalSize,
                result,
            };
        }
        
        // Result too large - truncate
        logger.warn('Result exceeds size limit, truncating', {
            originalSize,
            limit: RESULT_LIMITS.MAX_RESULT_SIZE_BYTES,
        });
        
        const truncatedResult = truncateResult(result);
        const truncatedStr = JSON.stringify(truncatedResult);
        const truncatedSize = Buffer.byteLength(truncatedStr, 'utf8');
        
        return {
            valid: true,
            truncated: true,
            originalSize,
            truncatedSize,
            result: truncatedResult,
            warning: `Result was truncated from ${formatBytes(originalSize)} to ${formatBytes(truncatedSize)} due to size limits`,
        };
        
    } catch (error) {
        const err = error as Error;
        logger.error('Result validation error', { error: err.message });
        
        return {
            valid: false,
            truncated: false,
            originalSize: 0,
            result: { error: 'Result validation failed', message: err.message },
        };
    }
}

/**
 * Truncate result to fit within size limits
 */
function truncateResult(result: any): any {
    // If result is an array, truncate to max rows
    if (Array.isArray(result)) {
        const truncated = result.slice(0, RESULT_LIMITS.MAX_ROWS_TO_STORE);
        return {
            data: truncated,
            truncated: true,
            originalCount: result.length,
            displayedCount: truncated.length,
            message: `Showing ${truncated.length} of ${result.length} rows`,
        };
    }
    
    // If result is an object with data array
    if (result && typeof result === 'object' && Array.isArray(result.data)) {
        const truncated = result.data.slice(0, RESULT_LIMITS.MAX_ROWS_TO_STORE);
        return {
            ...result,
            data: truncated,
            truncated: true,
            originalCount: result.data.length,
            displayedCount: truncated.length,
            message: `Showing ${truncated.length} of ${result.data.length} rows`,
        };
    }
    
    // If result is an object, try to summarize
    if (result && typeof result === 'object') {
        return {
            summary: summarizeObject(result),
            truncated: true,
            message: 'Result was too large and has been summarized',
        };
    }
    
    // For primitives, convert to string and truncate
    const str = String(result);
    if (str.length > 10000) {
        return {
            value: str.substring(0, 10000) + '...',
            truncated: true,
            originalLength: str.length,
            message: 'Result was truncated',
        };
    }
    
    return result;
}

/**
 * Create a summary of an object (for large results)
 */
function summarizeObject(obj: any): any {
    const summary: any = {
        type: typeof obj,
        keys: Object.keys(obj).length,
    };
    
    // Add sample of keys
    const keys = Object.keys(obj);
    if (keys.length > 0) {
        summary.sampleKeys = keys.slice(0, 10);
    }
    
    // Add counts for arrays
    for (const key of keys.slice(0, 10)) {
        if (Array.isArray(obj[key])) {
            summary[`${key}_count`] = obj[key].length;
        }
    }
    
    return summary;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if result is too large for display
 */
export function isResultTooLargeForDisplay(result: any): boolean {
    try {
        const resultStr = JSON.stringify(result);
        const size = Buffer.byteLength(resultStr, 'utf8');
        return size > RESULT_LIMITS.MAX_DISPLAY_SIZE_BYTES;
    } catch {
        return true;
    }
}

/**
 * Get display-friendly version of result
 */
export function getDisplayResult(result: any): any {
    if (!isResultTooLargeForDisplay(result)) {
        return result;
    }
    
    // Truncate for display
    if (Array.isArray(result)) {
        return {
            data: result.slice(0, 100),
            truncated: true,
            message: `Showing first 100 of ${result.length} rows. Full result stored in database.`,
        };
    }
    
    return {
        summary: 'Result too large for display',
        message: 'Full result stored in database. Use download feature to access complete data.',
    };
}

export default {
    validateResult,
    isResultTooLargeForDisplay,
    getDisplayResult,
    RESULT_LIMITS,
};
