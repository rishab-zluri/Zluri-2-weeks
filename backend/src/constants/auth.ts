/**
 * Authentication Constants
 * Centralized enums and constants for authentication
 */

/**
 * Token types for JWT tokens
 */
export const TokenType = {
    ACCESS: 'access',
    REFRESH: 'refresh',
} as const;

export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];

/**
 * User roles for RBAC
 */
export const UserRole = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    DEVELOPER: 'developer',
} as const;

export type UserRoleValue = (typeof UserRole)[keyof typeof UserRole];

/**
 * Session status
 */
export const SessionStatus = {
    ACTIVE: 'active',
    REVOKED: 'revoked',
    EXPIRED: 'expired',
} as const;

export type SessionStatusValue = (typeof SessionStatus)[keyof typeof SessionStatus];

/**
 * Role hierarchy levels (higher = more permissions)
 */
export const ROLE_HIERARCHY: Record<UserRoleValue, number> = {
    [UserRole.ADMIN]: 3,
    [UserRole.MANAGER]: 2,
    [UserRole.DEVELOPER]: 1,
};

/**
 * Check if a role has at least the minimum required level
 */
export function hasMinimumRole(
    userRole: UserRoleValue,
    requiredRole: UserRoleValue
): boolean {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Type guard for UserRole
 */
export function isValidUserRole(role: unknown): role is UserRoleValue {
    return (
        typeof role === 'string' &&
        Object.values(UserRole).includes(role as UserRoleValue)
    );
}

/**
 * Default export for CommonJS compatibility
 */
export default {
    TokenType,
    UserRole,
    SessionStatus,
    ROLE_HIERARCHY,
    hasMinimumRole,
    isValidUserRole,
};
