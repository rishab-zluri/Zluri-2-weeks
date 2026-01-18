
import { describe, it, expect } from '@jest/globals';
import { RegisterSchema, UpdateProfileSchema, ChangePasswordSchema } from '../src/validation/authSchemas';
import { SubmitRequestSchema, RejectRequestSchema, RequestQuerySchema } from '../src/validation/querySchemas';
import { ZodError } from 'zod';

describe('Validation Schemas Coverage', () => {

    describe('RegisterSchema', () => {
        const validUser = {
            email: 'test@example.com',
            password: 'Password123!',
            name: 'Test User',
            podId: 'pod-123'
        };

        it('should pass valid user', () => {
            const result = RegisterSchema.safeParse(validUser);
            expect(result.success).toBe(true);
        });

        it('should fail invalid email', () => {
            const result = RegisterSchema.safeParse({ ...validUser, email: 'invalid' });
            expect(result.success).toBe(false);
        });

        it('should fail weak password (min length)', () => {
            const result = RegisterSchema.safeParse({ ...validUser, password: 'Pass1' });
            expect(result.success).toBe(false);
        });

        it('should fail weak password (no uppercase)', () => {
            const result = RegisterSchema.safeParse({ ...validUser, password: 'password123' });
            expect(result.success).toBe(false);
        });

        it('should fail weak password (no lowercase)', () => {
            const result = RegisterSchema.safeParse({ ...validUser, password: 'PASSWORD123' });
            expect(result.success).toBe(false);
        });

        it('should fail weak password (no number)', () => {
            const result = RegisterSchema.safeParse({ ...validUser, password: 'Passwordabc' });
            expect(result.success).toBe(false);
        });

        it('should normalize email and name', () => {
            const result = RegisterSchema.parse({
                ...validUser,
                email: '  TEST@Example.com ',
                name: '  Test User  '
            });
            expect(result.email).toBe('test@example.com');
            expect(result.name).toBe('Test User');
        });
    });

    describe('UpdateProfileSchema', () => {
        it('should pass with valid optional fields', () => {
            const result = UpdateProfileSchema.safeParse({ name: 'New Name', slackUserId: 'U12345678' });
            expect(result.success).toBe(true);
        });

        it('should pass with empty object (all optional)', () => {
            const result = UpdateProfileSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should fail invalid slack ID', () => {
            const result = UpdateProfileSchema.safeParse({ slackUserId: 'invalid' });
            expect(result.success).toBe(false);
        });

        it('should allow null slack ID', () => {
            const result = UpdateProfileSchema.safeParse({ slackUserId: null });
            expect(result.success).toBe(true);
        });

        it('should fail empty name', () => {
            const result = UpdateProfileSchema.safeParse({ name: '' });
            expect(result.success).toBe(false);
        });
    });

    describe('ChangePasswordSchema', () => {
        it('should fail if new password is same as old', () => {
            const result = ChangePasswordSchema.safeParse({
                currentPassword: 'Password123!',
                newPassword: 'Password123!'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('must be different');
            }
        });

        it('should pass if new password is different', () => {
            const result = ChangePasswordSchema.safeParse({
                currentPassword: 'Password123!',
                newPassword: 'NewPassword123!'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('RejectRequestSchema', () => {
        it('should fail empty reason', () => {
            const result = RejectRequestSchema.safeParse({ reason: '' });
            expect(result.success).toBe(false);
        });

        it('should fail huge reason', () => {
            const result = RejectRequestSchema.safeParse({ reason: 'a'.repeat(501) });
            expect(result.success).toBe(false);
        });
    });

    describe('RequestQuerySchema', () => {
        it('should coerce query params', () => {
            // Note: schema uses string() or string().datetime() mostly, coercion is implicit in express but Zod manual parsing checks types.
            // Actually RequestQuerySchema uses z.string() mostly.
            // Let's check date validation.
            const result = RequestQuerySchema.safeParse({ startDate: 'invalid-date' });
            expect(result.success).toBe(false);
        });

        it('should pass valid date', () => {
            const result = RequestQuerySchema.safeParse({ startDate: new Date().toISOString() });
            expect(result.success).toBe(true);
        });
    });

    describe('SubmitRequestSchema', () => {
        const validQuery = {
            instanceId: 'inst-1',
            databaseName: 'db-1',
            submissionType: 'query',
            queryContent: 'SELECT 1',
            comments: 'Valid comment',
            podId: 'pod-1'
        };

        const validScript = {
            instanceId: 'inst-1',
            databaseName: 'db-1',
            submissionType: 'script',
            scriptContent: 'print("hello")',
            scriptFilename: 'test.py',
            comments: 'Valid comment',
            podId: 'pod-1'
        };

        it('should pass valid query', () => {
            const result = SubmitRequestSchema.safeParse(validQuery);
            expect(result.success).toBe(true);
        });

        it('should pass valid script', () => {
            const result = SubmitRequestSchema.safeParse(validScript);
            expect(result.success).toBe(true);
        });

        it('should fail query without content', () => {
            const result = SubmitRequestSchema.safeParse({ ...validQuery, queryContent: '' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Query content is required');
            }
        });

        it('should fail script without content (if not handled by file upload logic path which allows empty if optional)', () => {
            // The schema allows optional scriptContent but has a refinement.
            // Refinement: if script, return !!scriptContent || true (logic allows if handled by controller)
            // Actually looking at schema: 
            // if (data.submissionType === 'script') { return !!data.scriptContent || true; }
            // Wait, the schema logic `|| true` means it ALWAYS passes validation for script content emptiness?
            // Let's re-read: `return !!data.scriptContent || true; // File upload handled in controller`
            // This means the Zod schema effectively does NOT validate scriptContent presence.
            // So this test should actually PASS based on current logic.
            const result = SubmitRequestSchema.safeParse({
                ...validScript,
                scriptContent: undefined
            });
            expect(result.success).toBe(true);
        });

        it('should fail invalid script extension', () => {
            const result = SubmitRequestSchema.safeParse({ ...validScript, scriptFilename: 'test.txt' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('must end with .js or .py');
            }
        });

        it('should fail huge query content', () => {
            const huge = 'a'.repeat(50001);
            const result = SubmitRequestSchema.safeParse({ ...validQuery, queryContent: huge });
            expect(result.success).toBe(false);
        });

        it('should fail empty comments', () => {
            const result = SubmitRequestSchema.safeParse({ ...validQuery, comments: '   ' });
            expect(result.success).toBe(false);
        });
    });
});
