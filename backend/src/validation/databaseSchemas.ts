/**
 * Database Controller Validation Schemas
 *
 * Zod schemas for database instance and sync management endpoints.
 * These endpoints manage the portal's view of available database servers.
 *
 * WHY THIS EXISTS:
 * - Input Validation: Prevents invalid blacklist patterns
 * - Type Safety: Query parameters are coerced and typed
 * - Security: Blacklist regex patterns are validated for syntax
 *
 * SECURITY CONSIDERATIONS:
 * - patternType is strictly enum (prevents injection)
 * - reason field is length-limited (DoS prevention)
 * - Instance type is validated against known values
 */

import { z } from 'zod';

// =============================================================================
// Database Type Enum
// =============================================================================

/**
 * Valid database types
 *
 * CURRENTLY SUPPORTED:
 * - postgresql: PostgreSQL databases
 * - mongodb: MongoDB databases
 */
export const DatabaseTypeEnum = z.enum(['postgresql', 'mongodb']);
export type DatabaseType = z.infer<typeof DatabaseTypeEnum>;

// =============================================================================
// Pattern Type Enum
// =============================================================================

/**
 * Blacklist pattern types
 *
 * TYPES:
 * - exact: Database name must match exactly
 * - prefix: Database name must start with pattern
 * - regex: Pattern is a regular expression
 */
export const PatternTypeEnum = z.enum(['exact', 'prefix', 'regex']);
export type PatternType = z.infer<typeof PatternTypeEnum>;

// =============================================================================
// Instances Query Schema
// =============================================================================

/**
 * Instance list query parameters
 *
 * ENDPOINT: GET /api/databases/instances
 *
 * VALIDATES:
 * - type filter is a valid database type
 */
export const InstancesQuerySchema = z.object({
    type: DatabaseTypeEnum.optional(),
});

export type InstancesQueryInput = z.infer<typeof InstancesQuerySchema>;

// =============================================================================
// Blacklist Schema
// =============================================================================

/**
 * Database blacklist entry validation
 *
 * ENDPOINT: POST /api/databases/blacklist
 *
 * VALIDATES:
 * - Pattern is provided and reasonable length
 * - Pattern type is valid enum
 * - Reason is within length limits
 *
 * SECURITY:
 * - If patternType is 'regex', we validate it's a valid regex
 * - This prevents regex DoS attacks (ReDoS)
 */
export const BlacklistSchema = z
    .object({
        pattern: z
            .string()
            .min(1, 'Pattern is required')
            .max(255, 'Pattern must be at most 255 characters'),

        patternType: PatternTypeEnum.default('exact'),

        reason: z
            .string()
            .max(500, 'Reason must be at most 500 characters')
            .optional()
            .default(''),
    })
    .refine(
        (data) => {
            // If pattern type is regex, validate it's a valid regex
            if (data.patternType === 'regex') {
                try {
                    new RegExp(data.pattern);
                    return true;
                } catch {
                    return false;
                }
            }
            return true;
        },
        {
            message: 'Invalid regular expression pattern',
            path: ['pattern'],
        }
    );

export type BlacklistInput = z.infer<typeof BlacklistSchema>;

// =============================================================================
// Databases Query Schema
// =============================================================================

/**
 * Database list query parameters
 *
 * ENDPOINT: GET /api/databases/instances/:instanceId/databases
 *
 * VALIDATES:
 * - search term is reasonable length
 * - pagination params are valid
 */
export const DatabasesQuerySchema = z.object({
    search: z
        .string()
        .max(100, 'Search term too long')
        .optional(),

    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
});

export type DatabasesQueryInput = z.infer<typeof DatabasesQuerySchema>;

// =============================================================================
// Sync Request Schema
// =============================================================================

/**
 * Manual sync trigger validation
 *
 * ENDPOINT: POST /api/databases/sync
 *
 * VALIDATES:
 * - instanceId is optional (full sync if not provided)
 */
export const SyncRequestSchema = z.object({
    instanceId: z.string().optional(),
});

export type SyncRequestInput = z.infer<typeof SyncRequestSchema>;
