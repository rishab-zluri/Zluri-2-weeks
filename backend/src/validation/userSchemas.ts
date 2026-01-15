/**
 * User Management Validation Schemas
 *
 * Zod schemas for admin user management operations.
 * These endpoints are admin-only, but we still validate input
 * to prevent accidental data corruption and ensure audit trail integrity.
 *
 * WHY THIS EXISTS:
 * - Defense in Depth: Even admins can make typos
 * - Audit Trail: Validated role changes are logged correctly
 * - Type Safety: Controllers receive properly typed data
 *
 * SECURITY CONSIDERATIONS:
 * - Role enum is strictly validated (prevents privilege escalation via typos)
 * - slackUserId format is validated (Slack API compatibility)
 * - Password requirements enforced on reset
 */

import { z } from 'zod';

// =============================================================================
// Role Enum
// =============================================================================

/**
 * User role enum validation
 *
 * WHY NOT IMPORT FROM ENTITY:
 * - Zod schemas should be standalone for testing
 * - Entity enum might change, validation should be explicit
 * - This is the "contract" for API consumers
 */
export const UserRoleEnum = z.enum(['developer', 'manager', 'admin']);
export type UserRole = z.infer<typeof UserRoleEnum>;

// =============================================================================
// Update User Schema
// =============================================================================

/**
 * User update validation
 *
 * ENDPOINT: PUT /api/users/:id
 *
 * VALIDATES:
 * - All fields are optional (partial update)
 * - Role changes are to valid enum values
 * - Slack user ID matches Slack's format
 *
 * BUSINESS RULES (enforced in controller):
 * - Admin cannot deactivate themselves
 * - Role change requires sufficient privileges
 */
export const UpdateUserSchema = z.object({
    name: z
        .string()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name must be at most 100 characters')
        .transform((name) => name.trim())
        .optional(),

    role: UserRoleEnum.optional(),

    podId: z
        .string()
        .min(1, 'Pod ID cannot be empty')
        .optional()
        .nullable(), // Allow null to clear pod assignment

    slackUserId: z
        .string()
        .regex(/^U[A-Z0-9]{8,}$/, 'Invalid Slack user ID format (e.g., U01ABC23DEF)')
        .optional()
        .nullable(),

    isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// =============================================================================
// Reset Password Schema
// =============================================================================

/**
 * Admin password reset validation
 *
 * ENDPOINT: POST /api/users/:id/reset-password
 *
 * WHY ADMIN RESET IS DIFFERENT:
 * - Admin doesn't need to know current password
 * - Still enforces password complexity
 * - Creates audit log entry
 */
export const ResetPasswordSchema = z.object({
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// =============================================================================
// User Query Schema
// =============================================================================

/**
 * User list query parameters
 *
 * ENDPOINT: GET /api/users
 *
 * WHY COERCE:
 * - Query params are strings from URL
 * - Boolean 'true'/'false' strings need conversion
 *
 * PAGINATION:
 * - Inherited from common schemas
 * - This adds user-specific filters
 */
export const UserQuerySchema = z.object({
    role: UserRoleEnum.optional(),

    podId: z.string().optional(),

    search: z
        .string()
        .max(100, 'Search term too long')
        .optional(),

    isActive: z
        .string()
        .transform((val) => {
            if (val === 'true') return true;
            if (val === 'false') return false;
            return undefined;
        })
        .optional(),

    // Pagination (will be merged with common pagination schema in routes)
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
});

export type UserQueryInput = z.infer<typeof UserQuerySchema>;

// =============================================================================
// Activate User Schema
// =============================================================================

/**
 * User activation validation
 *
 * ENDPOINT: POST /api/users/:id/activate
 *
 * NOTE: No body required, just the ID param
 * This schema exists for consistency and future extensibility
 */
export const ActivateUserSchema = z.object({}).strict();

export type ActivateUserInput = z.infer<typeof ActivateUserSchema>;
