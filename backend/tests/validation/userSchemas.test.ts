/**
 * User Schemas Validation Tests
 * Target: 100% branch coverage
 */

import { describe, it, expect } from '@jest/globals';
import {
    UserRoleEnum,
    UpdateUserSchema,
    ResetPasswordSchema,
    UserQuerySchema,
    ActivateUserSchema,
} from '../../src/validation/userSchemas';

describe('User Schemas - Complete Coverage', () => {
    describe('UserRoleEnum', () => {
        it('should accept developer', () => {
            const result = UserRoleEnum.safeParse('developer');
            expect(result.success).toBe(true);
        });

        it('should accept manager', () => {
            const result = UserRoleEnum.safeParse('manager');
            expect(result.success).toBe(true);
        });

        it('should accept admin', () => {
            const result = UserRoleEnum.safeParse('admin');
            expect(result.success).toBe(true);
        });

        it('should reject invalid role', () => {
            const result = UserRoleEnum.safeParse('superadmin');
            expect(result.success).toBe(false);
        });
    });

    describe('UpdateUserSchema', () => {
        it('should accept valid name', () => {
            const result = UpdateUserSchema.safeParse({ name: 'John Doe' });
            expect(result.success).toBe(true);
        });

        it('should trim name whitespace', () => {
            const result = UpdateUserSchema.safeParse({ name: '  John Doe  ' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('John Doe');
            }
        });

        it('should reject empty name', () => {
            const result = UpdateUserSchema.safeParse({ name: '' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('cannot be empty');
            }
        });

        it('should reject name longer than 100 chars', () => {
            const result = UpdateUserSchema.safeParse({ name: 'a'.repeat(101) });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at most 100');
            }
        });

        it('should accept valid role', () => {
            const result = UpdateUserSchema.safeParse({ role: 'manager' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid role', () => {
            const result = UpdateUserSchema.safeParse({ role: 'invalid' });
            expect(result.success).toBe(false);
        });

        it('should accept valid podId', () => {
            const result = UpdateUserSchema.safeParse({ podId: 'pod-1' });
            expect(result.success).toBe(true);
        });

        it('should accept null podId', () => {
            const result = UpdateUserSchema.safeParse({ podId: null });
            expect(result.success).toBe(true);
        });

        it('should reject empty podId', () => {
            const result = UpdateUserSchema.safeParse({ podId: '' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('cannot be empty');
            }
        });

        it('should accept valid Slack user ID', () => {
            const result = UpdateUserSchema.safeParse({ slackUserId: 'U01ABC23DEF' });
            expect(result.success).toBe(true);
        });

        it('should accept null slackUserId', () => {
            const result = UpdateUserSchema.safeParse({ slackUserId: null });
            expect(result.success).toBe(true);
        });

        it('should reject invalid Slack user ID format', () => {
            const result = UpdateUserSchema.safeParse({ slackUserId: 'invalid' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Invalid Slack user ID');
            }
        });

        it('should reject Slack user ID not starting with U', () => {
            const result = UpdateUserSchema.safeParse({ slackUserId: 'A01ABC23DEF' });
            expect(result.success).toBe(false);
        });

        it('should reject Slack user ID too short', () => {
            const result = UpdateUserSchema.safeParse({ slackUserId: 'U123' });
            expect(result.success).toBe(false);
        });

        it('should accept isActive true', () => {
            const result = UpdateUserSchema.safeParse({ isActive: true });
            expect(result.success).toBe(true);
        });

        it('should accept isActive false', () => {
            const result = UpdateUserSchema.safeParse({ isActive: false });
            expect(result.success).toBe(true);
        });

        it('should accept empty object (all optional)', () => {
            const result = UpdateUserSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should accept multiple fields', () => {
            const result = UpdateUserSchema.safeParse({
                name: 'John Doe',
                role: 'manager',
                podId: 'pod-1',
                isActive: true
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ResetPasswordSchema', () => {
        it('should accept valid password', () => {
            const result = ResetPasswordSchema.safeParse({ newPassword: 'Password123' });
            expect(result.success).toBe(true);
        });

        it('should reject password shorter than 8 chars', () => {
            const result = ResetPasswordSchema.safeParse({ newPassword: 'Pass1' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at least 8');
            }
        });

        it('should reject password without uppercase', () => {
            const result = ResetPasswordSchema.safeParse({ newPassword: 'password123' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.message.includes('uppercase'))).toBe(true);
            }
        });

        it('should reject password without lowercase', () => {
            const result = ResetPasswordSchema.safeParse({ newPassword: 'PASSWORD123' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.message.includes('lowercase'))).toBe(true);
            }
        });

        it('should reject password without number', () => {
            const result = ResetPasswordSchema.safeParse({ newPassword: 'Password' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.message.includes('number'))).toBe(true);
            }
        });

        it('should accept password with all requirements', () => {
            const result = ResetPasswordSchema.safeParse({ newPassword: 'MyP@ssw0rd123' });
            expect(result.success).toBe(true);
        });

        it('should accept password at minimum length with requirements', () => {
            const result = ResetPasswordSchema.safeParse({ newPassword: 'Pass123w' });
            expect(result.success).toBe(true);
        });
    });

    describe('UserQuerySchema', () => {
        it('should accept role filter', () => {
            const result = UserQuerySchema.safeParse({ role: 'developer' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid role', () => {
            const result = UserQuerySchema.safeParse({ role: 'invalid' });
            expect(result.success).toBe(false);
        });

        it('should accept podId filter', () => {
            const result = UserQuerySchema.safeParse({ podId: 'pod-1' });
            expect(result.success).toBe(true);
        });

        it('should accept search term', () => {
            const result = UserQuerySchema.safeParse({ search: 'john' });
            expect(result.success).toBe(true);
        });

        it('should reject search term longer than 100 chars', () => {
            const result = UserQuerySchema.safeParse({ search: 'a'.repeat(101) });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('too long');
            }
        });

        it('should transform isActive "true" to boolean true', () => {
            const result = UserQuerySchema.safeParse({ isActive: 'true' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should transform isActive "false" to boolean false', () => {
            const result = UserQuerySchema.safeParse({ isActive: 'false' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(false);
            }
        });

        it('should transform isActive other values to undefined', () => {
            const result = UserQuerySchema.safeParse({ isActive: 'maybe' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBeUndefined();
            }
        });

        it('should accept pagination params', () => {
            const result = UserQuerySchema.safeParse({ page: '2', limit: '20' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.limit).toBe(20);
            }
        });

        it('should reject page less than 1', () => {
            const result = UserQuerySchema.safeParse({ page: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject limit less than 1', () => {
            const result = UserQuerySchema.safeParse({ limit: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject limit greater than 100', () => {
            const result = UserQuerySchema.safeParse({ limit: 101 });
            expect(result.success).toBe(false);
        });

        it('should accept empty object (all optional)', () => {
            const result = UserQuerySchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should accept multiple filters', () => {
            const result = UserQuerySchema.safeParse({
                role: 'manager',
                podId: 'pod-1',
                search: 'john',
                isActive: 'true',
                page: '1',
                limit: '10'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ActivateUserSchema', () => {
        it('should accept empty object', () => {
            const result = ActivateUserSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should reject object with extra fields', () => {
            const result = ActivateUserSchema.safeParse({ extra: 'field' });
            expect(result.success).toBe(false);
        });
    });
});
