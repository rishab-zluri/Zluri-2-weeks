/**
 * Common Validation Schemas
 *
 * Shared schemas used across multiple controllers.
 * These are the building blocks for more specific schemas.
 *
 * WHY THIS EXISTS:
 * - DRY Principle: Pagination is used everywhere
 * - Consistency: Same validation rules across all endpoints
 * - Type Safety: UUID params are validated before DB queries
 *
 * USAGE:
 * import { PaginationSchema, UuidParamSchema } from '../validation';
 */

import { z } from 'zod';

// =============================================================================
// Pagination Schema
// =============================================================================

/**
 * Standard pagination query parameters
 *
 * USED BY: All list endpoints (GET /users, GET /requests, etc.)
 *
 * DEFAULTS:
 * - page: 1 (first page)
 * - limit: 10 (reasonable default)
 *
 * CONSTRAINTS:
 * - page >= 1
 * - limit: 1-100 (prevent DoS via huge page requests)
 *
 * WHY COERCE:
 * - Query params come as strings: "?page=5"
 * - z.coerce.number() converts "5" to 5
 */
export const PaginationSchema = z.object({
    page: z.coerce
        .number()
        .min(1, 'Page must be at least 1')
        .default(1),

    limit: z.coerce
        .number()
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit must be at most 100')
        .default(10),

    // Optional sorting
    sortBy: z
        .string()
        .max(50, 'Sort field name too long')
        .optional(),

    sortOrder: z
        .enum(['asc', 'desc'])
        .default('asc'),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

/**
 * Helper to calculate offset from pagination input
 *
 * USAGE:
 * const { page, limit } = PaginationSchema.parse(req.query);
 * const offset = getOffset({ page, limit });
 */
export function getOffset(pagination: PaginationInput): number {
    return (pagination.page - 1) * pagination.limit;
}

// =============================================================================
// UUID Parameter Schema
// =============================================================================

/**
 * UUID path parameter validation
 *
 * USED BY: Endpoints with UUID identifiers (GET /users/:id, etc.)
 *
 * WHY VALIDATE:
 * - Prevents invalid UUIDs from reaching database
 * - Protects against path traversal attempts
 * - Clear error message instead of DB "invalid input syntax"
 *
 * SUPPORTED VERSIONS:
 * - UUID v1, v4, v5 (covers most use cases)
 */
export const UuidParamSchema = z.object({
    id: z
        .string()
        .uuid('Invalid UUID format'),
});

export type UuidParamInput = z.infer<typeof UuidParamSchema>;

// =============================================================================
// Numeric ID Parameter Schema
// =============================================================================

/**
 * Numeric ID path parameter validation
 *
 * USED BY: Endpoints with numeric IDs (legacy or auto-increment PKs)
 *
 * WHY COERCE:
 * - Path params come as strings: /requests/123
 * - Need to convert to number for DB queries
 */
export const IdParamSchema = z.object({
    id: z.coerce
        .number()
        .int('ID must be an integer')
        .positive('ID must be positive'),
});

export type IdParamInput = z.infer<typeof IdParamSchema>;

// =============================================================================
// Request ID by UUID Schema
// =============================================================================

/**
 * Request UUID parameter
 *
 * USED BY: External-facing request endpoints (use UUID for security)
 */
export const RequestUuidParamSchema = z.object({
    uuid: z
        .string()
        .uuid('Invalid request UUID'),
});

export type RequestUuidParamInput = z.infer<typeof RequestUuidParamSchema>;

// =============================================================================
// Instance ID Parameter Schema
// =============================================================================

/**
 * Instance ID parameter validation
 *
 * USED BY: Database instance endpoints
 *
 * FORMAT:
 * - database-1, mongo-zluri-2, etc.
 * - Max 100 chars to prevent buffer issues
 */
export const InstanceIdParamSchema = z.object({
    instanceId: z
        .string()
        .min(1, 'Instance ID is required')
        .max(100, 'Instance ID too long'),
});

export type InstanceIdParamInput = z.infer<typeof InstanceIdParamSchema>;

// =============================================================================
// Search Schema
// =============================================================================

/**
 * Generic search query parameter
 *
 * USED BY: Endpoints with search functionality
 *
 * SECURITY:
 * - Max length prevents DoS via huge search strings
 * - Trim removes leading/trailing whitespace
 */
export const SearchSchema = z.object({
    q: z
        .string()
        .max(255, 'Search query too long')
        .transform((q) => q.trim())
        .optional(),

    search: z
        .string()
        .max(255, 'Search query too long')
        .transform((s) => s.trim())
        .optional(),
});

export type SearchInput = z.infer<typeof SearchSchema>;

// =============================================================================
// Date Range Schema
// =============================================================================

/**
 * Date range filter parameters
 *
 * USED BY: Endpoints with date filtering (audit logs, requests, etc.)
 *
 * FORMAT:
 * - ISO 8601 datetime strings
 * - Transforms to Date objects for query use
 */
export const DateRangeSchema = z.object({
    startDate: z
        .string()
        .datetime({ message: 'Invalid start date format (use ISO 8601)' })
        .transform((d) => new Date(d))
        .optional(),

    endDate: z
        .string()
        .datetime({ message: 'Invalid end date format (use ISO 8601)' })
        .transform((d) => new Date(d))
        .optional(),
}).refine(
    (data) => {
        if (data.startDate && data.endDate) {
            return data.startDate <= data.endDate;
        }
        return true;
    },
    {
        message: 'Start date must be before or equal to end date',
        path: ['startDate'],
    }
);

export type DateRangeInput = z.infer<typeof DateRangeSchema>;
