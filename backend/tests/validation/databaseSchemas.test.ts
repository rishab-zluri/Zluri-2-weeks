/**
 * Database Schemas Validation Tests
 * Target: 100% branch coverage
 */

import { describe, it, expect } from '@jest/globals';
import {
    DatabaseTypeEnum,
    PatternTypeEnum,
    InstancesQuerySchema,
    BlacklistSchema,
    DatabasesQuerySchema,
    SyncRequestSchema,
} from '../../src/validation/databaseSchemas';

describe('Database Schemas - Complete Coverage', () => {
    describe('DatabaseTypeEnum', () => {
        it('should accept postgresql', () => {
            const result = DatabaseTypeEnum.safeParse('postgresql');
            expect(result.success).toBe(true);
        });

        it('should accept mongodb', () => {
            const result = DatabaseTypeEnum.safeParse('mongodb');
            expect(result.success).toBe(true);
        });

        it('should reject invalid type', () => {
            const result = DatabaseTypeEnum.safeParse('mysql');
            expect(result.success).toBe(false);
        });
    });

    describe('PatternTypeEnum', () => {
        it('should accept exact', () => {
            const result = PatternTypeEnum.safeParse('exact');
            expect(result.success).toBe(true);
        });

        it('should accept prefix', () => {
            const result = PatternTypeEnum.safeParse('prefix');
            expect(result.success).toBe(true);
        });

        it('should accept regex', () => {
            const result = PatternTypeEnum.safeParse('regex');
            expect(result.success).toBe(true);
        });

        it('should reject invalid pattern type', () => {
            const result = PatternTypeEnum.safeParse('invalid');
            expect(result.success).toBe(false);
        });
    });

    describe('InstancesQuerySchema', () => {
        it('should accept postgresql type', () => {
            const result = InstancesQuerySchema.safeParse({ type: 'postgresql' });
            expect(result.success).toBe(true);
        });

        it('should accept mongodb type', () => {
            const result = InstancesQuerySchema.safeParse({ type: 'mongodb' });
            expect(result.success).toBe(true);
        });

        it('should accept empty object (optional type)', () => {
            const result = InstancesQuerySchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should reject invalid type', () => {
            const result = InstancesQuerySchema.safeParse({ type: 'invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('BlacklistSchema', () => {
        it('should accept valid exact pattern', () => {
            const result = BlacklistSchema.safeParse({
                pattern: 'test_db',
                patternType: 'exact',
                reason: 'Test database'
            });
            expect(result.success).toBe(true);
        });

        it('should accept valid prefix pattern', () => {
            const result = BlacklistSchema.safeParse({
                pattern: 'temp_',
                patternType: 'prefix',
                reason: 'Temporary databases'
            });
            expect(result.success).toBe(true);
        });

        it('should accept valid regex pattern', () => {
            const result = BlacklistSchema.safeParse({
                pattern: '^test_.*$',
                patternType: 'regex',
                reason: 'Test databases'
            });
            expect(result.success).toBe(true);
        });

        it('should default patternType to exact', () => {
            const result = BlacklistSchema.safeParse({
                pattern: 'test_db'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.patternType).toBe('exact');
            }
        });

        it('should default reason to empty string', () => {
            const result = BlacklistSchema.safeParse({
                pattern: 'test_db'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.reason).toBe('');
            }
        });

        it('should reject empty pattern', () => {
            const result = BlacklistSchema.safeParse({
                pattern: ''
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('required');
            }
        });

        it('should reject pattern longer than 255 chars', () => {
            const result = BlacklistSchema.safeParse({
                pattern: 'a'.repeat(256)
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at most 255');
            }
        });

        it('should reject reason longer than 500 chars', () => {
            const result = BlacklistSchema.safeParse({
                pattern: 'test',
                reason: 'a'.repeat(501)
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at most 500');
            }
        });

        it('should reject invalid regex pattern', () => {
            const result = BlacklistSchema.safeParse({
                pattern: '[invalid(regex',
                patternType: 'regex'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Invalid regular expression');
            }
        });

        it('should accept complex valid regex', () => {
            const result = BlacklistSchema.safeParse({
                pattern: '^(test|temp)_[0-9]+$',
                patternType: 'regex'
            });
            expect(result.success).toBe(true);
        });

        it('should not validate regex for exact pattern type', () => {
            const result = BlacklistSchema.safeParse({
                pattern: '[invalid(regex',
                patternType: 'exact'
            });
            expect(result.success).toBe(true);
        });

        it('should not validate regex for prefix pattern type', () => {
            const result = BlacklistSchema.safeParse({
                pattern: '[invalid(regex',
                patternType: 'prefix'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('DatabasesQuerySchema', () => {
        it('should accept valid search term', () => {
            const result = DatabasesQuerySchema.safeParse({ search: 'test' });
            expect(result.success).toBe(true);
        });

        it('should accept pagination params', () => {
            const result = DatabasesQuerySchema.safeParse({ page: '2', limit: '20' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.limit).toBe(20);
            }
        });

        it('should accept empty object (all optional)', () => {
            const result = DatabasesQuerySchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should reject search term longer than 100 chars', () => {
            const result = DatabasesQuerySchema.safeParse({ search: 'a'.repeat(101) });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('too long');
            }
        });

        it('should reject page less than 1', () => {
            const result = DatabasesQuerySchema.safeParse({ page: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject limit less than 1', () => {
            const result = DatabasesQuerySchema.safeParse({ limit: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject limit greater than 100', () => {
            const result = DatabasesQuerySchema.safeParse({ limit: 101 });
            expect(result.success).toBe(false);
        });
    });

    describe('SyncRequestSchema', () => {
        it('should accept instanceId', () => {
            const result = SyncRequestSchema.safeParse({ instanceId: 'database-1' });
            expect(result.success).toBe(true);
        });

        it('should accept empty object (optional instanceId)', () => {
            const result = SyncRequestSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should accept undefined instanceId', () => {
            const result = SyncRequestSchema.safeParse({ instanceId: undefined });
            expect(result.success).toBe(true);
        });
    });
});
