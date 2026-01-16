/**
 * Zod Validation Schemas - Index
 *
 * Centralized exports for all validation schemas.
 * This module serves as the single entry point for importing validation schemas
 * throughout the application, promoting clean imports and maintainability.
 *
 * WHY THIS EXISTS:
 * - Single import point for all validation schemas
 * - Decoupled from controllers for testability
 * - TypeScript type inference via z.infer<typeof Schema>
 *
 * USAGE:
 * import { LoginSchema, RegisterSchema, validate } from '../validation';
 *
 * PRODUCTION NOTES:
 * - All schemas enforce strict validation at runtime
 * - Type inference eliminates need for duplicate TypeScript interfaces
 * - Schemas are frozen objects (immutable) for safety
 */

// Core validation middleware
export { validate, validateQuery, validateParams } from './middleware';

// Environment variable validation (startup safety)
export { envSchema, type EnvConfig } from './envSchema';

// Authentication schemas
export {
    LoginSchema,
    RegisterSchema,
    RefreshTokenSchema,
    UpdateProfileSchema,
    ChangePasswordSchema,
    LogoutSchema,
    type LoginInput,
    type RegisterInput,
    type RefreshTokenInput,
    type UpdateProfileInput,
    type ChangePasswordInput,
} from './authSchemas';

// Query request schemas
export {
    SubmitRequestSchema,
    RejectRequestSchema,
    type SubmitRequestInput,
    type RejectRequestInput,
} from './querySchemas';

// User management schemas
export {
    UpdateUserSchema,
    ResetPasswordSchema,
    UserQuerySchema,
    type UpdateUserInput,
    type ResetPasswordInput,
    type UserQueryInput,
} from './userSchemas';

// Database controller schemas
export {
    BlacklistSchema,
    InstancesQuerySchema,
    type BlacklistInput,
    type InstancesQueryInput,
} from './databaseSchemas';

export {
    RequestQuerySchema,
    type RequestQueryInput,
} from './querySchemas';

// Common/shared schemas
export {
    PaginationSchema,
    UuidParamSchema,
    IdParamSchema,
    RequestUuidParamSchema,
    InstanceIdParamSchema,
    type PaginationInput,
    type UuidParamInput,
    type IdParamInput,
    type RequestUuidParamInput,
    type InstanceIdParamInput,
} from './commonSchemas';
