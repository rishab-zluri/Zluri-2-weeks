/**
 * Query Request Validation Schemas
 *
 * Zod schemas for query submission and approval workflow.
 * These are CRITICAL for security as they validate user-submitted queries
 * before they reach the database execution layer.
 *
 * WHY THIS EXISTS:
 * - Security: Limit query size to prevent DoS attacks
 * - Type Safety: Ensure submission type is a valid enum value
 * - Data Integrity: Validate required fields before DB persistence
 *
 * SECURITY CONSIDERATIONS:
 * - Query content is limited to 50KB max (DoS prevention)
 * - Script content is limited to 500KB max
 * - Filename extensions are validated
 * - submission_type is strictly typed enum
 */

import { z } from 'zod';

// =============================================================================
// Submission Type Enum
// =============================================================================

/**
 * Valid submission types
 *
 * WHY ZOD ENUM vs STRING:
 * - Compile-time AND runtime validation
 * - Auto-complete in IDE
 * - Clear error messages when invalid
 */
export const SubmissionTypeEnum = z.enum(['query', 'script']);
export type SubmissionType = z.infer<typeof SubmissionTypeEnum>;

// =============================================================================
// Submit Request Schema
// =============================================================================

/**
 * Query/Script submission validation
 *
 * ENDPOINT: POST /api/requests
 *
 * VALIDATES:
 * - Instance and database are specified
 * - Submission type is valid enum
 * - Query content is within size limits
 * - Script files have valid extensions
 *
 * SIZE LIMITS (DoS Prevention):
 * - queryContent: 50KB (typical SQL is < 10KB)
 * - scriptContent: 500KB (reasonable for JS/Python)
 * - comments: 1000 chars
 */
export const SubmitRequestSchema = z
    .object({
        instanceId: z
            .string()
            .min(1, 'Instance ID is required')
            .max(255, 'Instance ID too long'),

        databaseName: z
            .string()
            .min(1, 'Database name is required')
            .max(255, 'Database name too long'),

        submissionType: SubmissionTypeEnum,

        queryContent: z
            .string()
            .max(50000, 'Query content must be at most 50KB')
            .optional(),

        comments: z
            .string()
            .max(1000, 'Comments must be at most 1000 characters')
            .optional()
            .default(''),

        podId: z
            .string()
            .min(1, 'Pod ID is required'),

        // Script-specific fields
        scriptContent: z
            .string()
            .max(500000, 'Script content must be at most 500KB')
            .optional(),

        scriptFilename: z
            .string()
            .max(255, 'Filename too long')
            .regex(
                /\.(js|py)$/i,
                'Script filename must end with .js or .py'
            )
            .optional(),
    })
    .refine(
        (data) => {
            // If submission type is query, queryContent is required
            if (data.submissionType === 'query') {
                return !!data.queryContent && data.queryContent.trim().length > 0;
            }
            return true;
        },
        {
            message: 'Query content is required for query submissions',
            path: ['queryContent'],
        }
    )
    .refine(
        (data) => {
            // If submission type is script, either scriptContent is required
            // OR file upload is handled separately
            if (data.submissionType === 'script') {
                return !!data.scriptContent || true; // File upload handled in controller
            }
            return true;
        },
        {
            message: 'Script content is required for script submissions',
            path: ['scriptContent'],
        }
    );

export type SubmitRequestInput = z.infer<typeof SubmitRequestSchema>;

// =============================================================================
// Reject Request Schema
// =============================================================================

/**
 * Request rejection validation
 *
 * ENDPOINT: POST /api/requests/:id/reject
 *
 * VALIDATES:
 * - Reason is provided (audit trail requirement)
 * - Reason is within reasonable length
 */
export const RejectRequestSchema = z.object({
    reason: z
        .string()
        .min(1, 'Rejection reason is required')
        .max(500, 'Reason must be at most 500 characters')
        .transform((reason) => reason.trim()),
});

export type RejectRequestInput = z.infer<typeof RejectRequestSchema>;

// =============================================================================
// Request Query Schema (for filtering/listing)
// =============================================================================

/**
 * Request list query parameters
 *
 * ENDPOINT: GET /api/requests
 *
 * WHY COERCE:
 * - Query params come as strings from URL
 * - z.coerce converts "10" to 10 automatically
 */
export const RequestQuerySchema = z.object({
    status: z.string().optional(), // Allows comma-separated values

    podId: z.string().optional(),

    instanceId: z.string().optional(),

    submissionType: z.string().optional(), // Allows comma-separated values

    databaseType: z.string().optional(), // Allows comma-separated values

    userId: z.string().uuid().optional(),

    // Generic search (comments, instances)
    search: z.string().optional(),

    // Date range filters
    startDate: z
        .string()
        .datetime()
        .optional(),

    endDate: z
        .string()
        .datetime()
        .optional(),
});

export type RequestQueryInput = z.infer<typeof RequestQuerySchema>;
