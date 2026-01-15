/**
 * Validation Helpers
 * Common validation functions and sanitizers
 */

/**
 * Password validation result
 */
export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Query safety check result
 */
export interface QuerySafetyResult {
    hasDangerousPatterns: boolean;
    warnings: string[];
}

/**
 * Parsed pagination parameters
 */
export interface ParsedPagination {
    page: number;
    limit: number;
    offset: number;
}

/**
 * Query parameters for pagination
 */
export interface PaginationQuery {
    page?: string | number;
    limit?: string | number;
    [key: string]: unknown;
}

/**
 * Valid database types
 */
export type DatabaseType = 'postgresql' | 'mongodb';

/**
 * Valid submission types
 */
export type SubmissionType = 'query' | 'script';

/**
 * Valid request statuses
 */
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';

/**
 * Sanitize string input
 * Trims whitespace and removes angle brackets
 */
export function sanitizeString(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Alias for isValidEmail
 */
export const validateEmail = isValidEmail;

/**
 * Validate password strength
 * Requires: 8+ chars, uppercase, lowercase, number
 */
export function validatePassword(password: string): PasswordValidationResult {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    const isValid =
        password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber;

    return {
        isValid,
        errors: [
            ...(password.length < minLength
                ? [`Password must be at least ${minLength} characters`]
                : []),
            ...(!hasUpperCase
                ? ['Password must contain at least one uppercase letter']
                : []),
            ...(!hasLowerCase
                ? ['Password must contain at least one lowercase letter']
                : []),
            ...(!hasNumber ? ['Password must contain at least one number'] : []),
        ],
    };
}

/**
 * Validate UUID format (versions 1-5)
 */
export function isValidUUID(uuid: string): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate database type
 */
export function isValidDatabaseType(type: unknown): type is DatabaseType {
    if (typeof type !== 'string') return false;
    const validTypes: DatabaseType[] = ['postgresql', 'mongodb'];
    return validTypes.includes(type.toLowerCase() as DatabaseType);
}

/**
 * Validate submission type
 */
export function isValidSubmissionType(type: unknown): type is SubmissionType {
    if (typeof type !== 'string') return false;
    const validTypes: SubmissionType[] = ['query', 'script'];
    return validTypes.includes(type.toLowerCase() as SubmissionType);
}

/**
 * Validate status value
 */
export function isValidStatus(status: unknown): status is RequestStatus {
    if (typeof status !== 'string') return false;
    const validStatuses: RequestStatus[] = [
        'pending',
        'approved',
        'rejected',
        'executing',
        'completed',
        'failed',
    ];
    return validStatuses.includes(status.toLowerCase() as RequestStatus);
}

/**
 * Sanitize SQL query
 * Removes comments and trims whitespace
 * NOTE: This is NOT a substitute for proper parameterization
 */
export function sanitizeQuery(query: unknown): string {
    if (typeof query !== 'string') return '';
    // Remove comments
    let sanitized = query
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    // Trim whitespace
    sanitized = sanitized.trim();
    return sanitized;
}

/**
 * Check if query contains dangerous patterns
 */
export function checkQuerySafety(query: unknown): QuerySafetyResult {
    if (typeof query !== 'string') {
        return { hasDangerousPatterns: false, warnings: [] };
    }

    const warnings: string[] = [];

    // Check for DROP statements
    if (/\bdrop\s+(table|database|index|schema)\b/i.test(query)) {
        warnings.push('Query contains DROP statement - this is a destructive operation');
    }

    // Check for TRUNCATE
    if (/\btruncate\s+table\b/i.test(query)) {
        warnings.push('Query contains TRUNCATE statement - this will delete all data');
    }

    // Check for DELETE without WHERE
    if (/\bdelete\s+from\b/i.test(query) && !/\bwhere\b/i.test(query)) {
        warnings.push('DELETE statement without WHERE clause - this will delete all rows');
    }

    // Check for UPDATE without WHERE
    if (/\bupdate\s+\w+\s+set\b/i.test(query) && !/\bwhere\b/i.test(query)) {
        warnings.push('UPDATE statement without WHERE clause - this will update all rows');
    }

    return {
        hasDangerousPatterns: warnings.length > 0,
        warnings,
    };
}

/**
 * Validate file extension
 */
export function isValidFileExtension(
    filename: unknown,
    allowedExtensions: string[] = ['.js', '.py']
): boolean {
    if (typeof filename !== 'string') return false;
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return allowedExtensions.includes(ext);
}

/**
 * Parse pagination parameters
 * Enforces page >= 1 and limit between 1-100
 */
export function parsePagination(query: PaginationQuery): ParsedPagination {
    const page = Math.max(1, parseInt(String(query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit), 10) || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

/**
 * Sanitize input string for XSS prevention
 */
/* istanbul ignore next */
export function sanitizeInput(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .replace(/[<>]/g, '');
}

/**
 * Sanitize MongoDB query for NoSQL injection prevention
 */
/* istanbul ignore next */
export function sanitizeMongoQuery(query: unknown): string {
    if (typeof query !== 'string') return '';
    return query
        .replace(/\$where/gi, '')
        .replace(/\$gt/gi, '')
        .replace(/\$ne/gi, '')
        .replace(/\$or/gi, '');
}

/**
 * Sanitize file path to prevent path traversal
 */
/* istanbul ignore next */
export function sanitizePath(path: unknown): string {
    if (typeof path !== 'string') return '';
    return path
        .replace(/\.\.\//g, '')
        .replace(/\.\.\\/g, '')
        .replace(/%2e%2e/gi, '')
        .replace(/%252f/gi, '/')
        .replace(/\/etc\//gi, '')
        .replace(/\\Windows\\/gi, '');
}

/**
 * Validate query length to prevent DoS
 */
/* istanbul ignore next */
export function validateQueryLength(
    query: unknown,
    maxLength: number = 50000
): boolean {
    if (typeof query !== 'string') return false;
    return query.length <= maxLength;
}

/**
 * Default export for CommonJS compatibility
 */
export default {
    sanitizeString,
    isValidEmail,
    validateEmail,
    validatePassword,
    isValidUUID,
    isValidDatabaseType,
    isValidSubmissionType,
    isValidStatus,
    sanitizeQuery,
    sanitizeInput,
    sanitizeMongoQuery,
    sanitizePath,
    validateQueryLength,
    checkQuerySafety,
    isValidFileExtension,
    parsePagination,
};
