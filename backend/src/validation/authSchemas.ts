/**
 * Authentication Validation Schemas
 *
 * Zod schemas for all authentication-related endpoints.
 * These schemas validate user input BEFORE any business logic or database operations.
 *
 * WHY THIS EXISTS:
 * - Security: Prevents malformed data from reaching auth logic
 * - Type Safety: Inferred types used throughout the controller
 * - Consistency: Same validation rules for API and any future clients
 *
 * SECURITY CONSIDERATIONS:
 * - Password validation enforces minimum complexity
 * - Email normalization (lowercase) prevents duplicate accounts
 * - Token format validation prevents injection attempts
 */

import { z } from 'zod';

// =============================================================================
// Password Validation Helper
// =============================================================================

/**
 * Password validation schema with security requirements
 *
 * REQUIREMENTS:
 * - Minimum 8 characters (NIST recommendation)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 *
 * WHY THESE RULES:
 * - Balance between security and usability
 * - Meets most enterprise compliance requirements
 * - Regex checks are performant for runtime validation
 */
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Email validation with normalization
 *
 * TRANSFORMS:
 * - Converts to lowercase (case-insensitive matching)
 * - Trims whitespace
 */
const emailSchema = z
    .string()
    .trim()
    .email('Invalid email format')
    .toLowerCase();

// =============================================================================
// Registration Schema
// =============================================================================

/**
 * User registration validation
 *
 * ENDPOINT: POST /api/auth/register
 *
 * VALIDATES:
 * - Email format and uniqueness check (done in controller)
 * - Password complexity requirements
 * - Name is non-empty and reasonable length
 * - Pod ID for organizational assignment
 */
export const RegisterSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z
        .string()
        .min(1, 'Name is required')
        .max(100, 'Name must be at most 100 characters')
        .transform((name) => name.trim()),
    podId: z.string().min(1, 'Pod ID is required'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// =============================================================================
// Login Schema
// =============================================================================

/**
 * User login validation
 *
 * ENDPOINT: POST /api/auth/login
 *
 * NOTE: We don't validate password complexity here because:
 * - User might have legacy password that doesn't meet current rules
 * - Just need to check credentials, not enforce rules
 */
export const LoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// =============================================================================
// Refresh Token Schema
// =============================================================================

/**
 * Token refresh validation
 *
 * ENDPOINT: POST /api/auth/refresh
 *
 * WHY VALIDATE:
 * - Ensures token is provided
 * - Basic format check before DB lookup
 */
export const RefreshTokenSchema = z.object({
    refreshToken: z
        .string()
        .min(1, 'Refresh token is required')
        .max(1000, 'Token too long')
        .optional(), // Allow cookie-only refresh
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// =============================================================================
// Update Profile Schema
// =============================================================================

/**
 * Profile update validation
 *
 * ENDPOINT: PUT /api/auth/profile
 *
 * OPTIONAL FIELDS:
 * - All fields are optional (partial update)
 * - Only provided fields are validated and updated
 */
export const UpdateProfileSchema = z.object({
    name: z
        .string()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name must be at most 100 characters')
        .transform((name) => name.trim())
        .optional(),
    slackUserId: z
        .string()
        .regex(/^U[A-Z0-9]{8,}$/, 'Invalid Slack user ID format')
        .optional()
        .nullable(), // Allow null to clear the value
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// =============================================================================
// Change Password Schema
// =============================================================================

/**
 * Password change validation
 *
 * ENDPOINT: POST /api/auth/change-password
 *
 * VALIDATES:
 * - Current password is provided (verified against DB in controller)
 * - New password meets complexity requirements
 * - New password is different from current (optional business rule)
 */
export const ChangePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: passwordSchema,
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: 'New password must be different from current password',
        path: ['newPassword'],
    });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// =============================================================================
// Logout Schema
// =============================================================================

/**
 * Logout validation
 *
 * ENDPOINT: POST /api/auth/logout
 *
 * OPTIONAL:
 * - refreshToken can be provided to invalidate specific session
 * - If not provided, only access token is blacklisted
 */
export const LogoutSchema = z.object({
    refreshToken: z.string().max(1000).optional(),
});

export type LogoutInput = z.infer<typeof LogoutSchema>;
