/**
 * Common Schemas Validation Tests
 * Target: 100% branch coverage for validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import {
    PaginationSchema,
    getOffset,
    UuidParamSchema,
    IdParamSchema,
    RequestUuidParamSchema,
    InstanceIdParamSchema,
    SearchSchema,
    DateRangeSchema,
} from '../../src/validation/commonSchemas';

describe('Common Schemas - Complete Coverage', () => {
    describe('PaginationSchema', () => {
        it('should accept valid pagination with defaults', () => {
            const result = PaginationSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.limit).toBe(10);
                expect(result.data.sortOrder).toBe('asc');
            }
        });

        it('should accept valid page and limit', () => {
            const result = PaginationSchema.safeParse({ page: '5', limit: '20' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(5);
                expect(result.data.limit).toBe(20);
            }
        });

        it('should coerce string numbers to numbers', () => {
            const result = PaginationSchema.safeParse({ page: '10', limit: '50' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(typeof result.data.page).toBe('number');
                expect(typeof result.data.limit).toBe('number');
            }
        });

        it('should reject page less than 1', () => {
            const result = PaginationSchema.safeParse({ page: 0 });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at least 1');
            }
        });

        it('should reject negative page', () => {
            const result = PaginationSchema.safeParse({ page: -1 });
            expect(result.success).toBe(false);
        });

        it('should reject limit less than 1', () => {
            const result = PaginationSchema.safeParse({ limit: 0 });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at least 1');
            }
        });

        it('should reject limit greater than 100', () => {
            const result = PaginationSchema.safeParse({ limit: 101 });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('at most 100');
            }
        });

        it('should accept optional sortBy', () => {
            const result = PaginationSchema.safeParse({ sortBy: 'name' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.sortBy).toBe('name');
            }
        });

        it('should reject sortBy longer than 50 chars', () => {
            const result = PaginationSchema.safeParse({ sortBy: 'a'.repeat(51) });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('too long');
            }
        });

        it('should accept sortOrder asc', () => {
            const result = PaginationSchema.safeParse({ sortOrder: 'asc' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.sortOrder).toBe('asc');
            }
        });

        it('should accept sortOrder desc', () => {
            const result = PaginationSchema.safeParse({ sortOrder: 'desc' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.sortOrder).toBe('desc');
            }
        });

        it('should reject invalid sortOrder', () => {
            const result = PaginationSchema.safeParse({ sortOrder: 'invalid' });
            expect(result.success).toBe(false);
        });

        it('should default sortOrder to asc', () => {
            const result = PaginationSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.sortOrder).toBe('asc');
            }
        });
    });

    describe('getOffset', () => {
        it('should calculate offset for page 1', () => {
            const offset = getOffset({ page: 1, limit: 10, sortOrder: 'asc' });
            expect(offset).toBe(0);
        });

        it('should calculate offset for page 2', () => {
            const offset = getOffset({ page: 2, limit: 10, sortOrder: 'asc' });
            expect(offset).toBe(10);
        });

        it('should calculate offset for page 5 with limit 20', () => {
            const offset = getOffset({ page: 5, limit: 20, sortOrder: 'asc' });
            expect(offset).toBe(80);
        });

        it('should calculate offset for page 1 with limit 50', () => {
            const offset = getOffset({ page: 1, limit: 50, sortOrder: 'asc' });
            expect(offset).toBe(0);
        });
    });

    describe('UuidParamSchema', () => {
        it('should accept valid UUID v4', () => {
            const result = UuidParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID format', () => {
            const result = UuidParamSchema.safeParse({ id: 'not-a-uuid' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Invalid UUID');
            }
        });

        it('should reject empty string', () => {
            const result = UuidParamSchema.safeParse({ id: '' });
            expect(result.success).toBe(false);
        });

        it('should reject numeric ID', () => {
            const result = UuidParamSchema.safeParse({ id: '123' });
            expect(result.success).toBe(false);
        });
    });

    describe('IdParamSchema', () => {
        it('should accept valid positive integer', () => {
            const result = IdParamSchema.safeParse({ id: '123' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe(123);
            }
        });

        it('should coerce string to number', () => {
            const result = IdParamSchema.safeParse({ id: '456' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(typeof result.data.id).toBe('number');
            }
        });

        it('should reject zero', () => {
            const result = IdParamSchema.safeParse({ id: 0 });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('positive');
            }
        });

        it('should reject negative number', () => {
            const result = IdParamSchema.safeParse({ id: -1 });
            expect(result.success).toBe(false);
        });

        it('should reject decimal number', () => {
            const result = IdParamSchema.safeParse({ id: 1.5 });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('integer');
            }
        });

        it('should reject non-numeric string', () => {
            const result = IdParamSchema.safeParse({ id: 'abc' });
            expect(result.success).toBe(false);
        });
    });

    describe('RequestUuidParamSchema', () => {
        it('should accept valid UUID', () => {
            const result = RequestUuidParamSchema.safeParse({ uuid: '550e8400-e29b-41d4-a716-446655440000' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID', () => {
            const result = RequestUuidParamSchema.safeParse({ uuid: 'invalid' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Invalid request UUID');
            }
        });
    });

    describe('InstanceIdParamSchema', () => {
        it('should accept valid instance ID', () => {
            const result = InstanceIdParamSchema.safeParse({ instanceId: 'database-1' });
            expect(result.success).toBe(true);
        });

        it('should accept instance ID with special chars', () => {
            const result = InstanceIdParamSchema.safeParse({ instanceId: 'mongo-zluri-prod-2' });
            expect(result.success).toBe(true);
        });

        it('should reject empty instance ID', () => {
            const result = InstanceIdParamSchema.safeParse({ instanceId: '' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('required');
            }
        });

        it('should reject instance ID longer than 100 chars', () => {
            const result = InstanceIdParamSchema.safeParse({ instanceId: 'a'.repeat(101) });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('too long');
            }
        });

        it('should accept instance ID at max length', () => {
            const result = InstanceIdParamSchema.safeParse({ instanceId: 'a'.repeat(100) });
            expect(result.success).toBe(true);
        });
    });

    describe('SearchSchema', () => {
        it('should accept search with q parameter', () => {
            const result = SearchSchema.safeParse({ q: 'test query' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.q).toBe('test query');
            }
        });

        it('should accept search with search parameter', () => {
            const result = SearchSchema.safeParse({ search: 'test query' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.search).toBe('test query');
            }
        });

        it('should trim whitespace from q', () => {
            const result = SearchSchema.safeParse({ q: '  test query  ' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.q).toBe('test query');
            }
        });

        it('should trim whitespace from search', () => {
            const result = SearchSchema.safeParse({ search: '  test query  ' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.search).toBe('test query');
            }
        });

        it('should reject q longer than 255 chars', () => {
            const result = SearchSchema.safeParse({ q: 'a'.repeat(256) });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('too long');
            }
        });

        it('should reject search longer than 255 chars', () => {
            const result = SearchSchema.safeParse({ search: 'a'.repeat(256) });
            expect(result.success).toBe(false);
        });

        it('should accept empty object (optional fields)', () => {
            const result = SearchSchema.safeParse({});
            expect(result.success).toBe(true);
        });
    });

    describe('DateRangeSchema', () => {
        it('should accept valid date range', () => {
            const result = DateRangeSchema.safeParse({
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-12-31T23:59:59Z'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBeInstanceOf(Date);
                expect(result.data.endDate).toBeInstanceOf(Date);
            }
        });

        it('should transform ISO strings to Date objects', () => {
            const result = DateRangeSchema.safeParse({
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-12-31T23:59:59Z'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBeInstanceOf(Date);
                expect(result.data.endDate).toBeInstanceOf(Date);
            }
        });

        it('should accept only startDate', () => {
            const result = DateRangeSchema.safeParse({
                startDate: '2024-01-01T00:00:00Z'
            });
            expect(result.success).toBe(true);
        });

        it('should accept only endDate', () => {
            const result = DateRangeSchema.safeParse({
                endDate: '2024-12-31T23:59:59Z'
            });
            expect(result.success).toBe(true);
        });

        it('should accept empty object (optional dates)', () => {
            const result = DateRangeSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should reject startDate after endDate', () => {
            const result = DateRangeSchema.safeParse({
                startDate: '2024-12-31T23:59:59Z',
                endDate: '2024-01-01T00:00:00Z'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('before or equal');
            }
        });

        it('should accept startDate equal to endDate', () => {
            const result = DateRangeSchema.safeParse({
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-01-01T00:00:00Z'
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid startDate format', () => {
            const result = DateRangeSchema.safeParse({
                startDate: 'invalid-date'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain('Invalid');
            }
        });

        it('should reject invalid endDate format', () => {
            const result = DateRangeSchema.safeParse({
                endDate: 'not-a-date'
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-ISO datetime format', () => {
            const result = DateRangeSchema.safeParse({
                startDate: '01/01/2024'
            });
            expect(result.success).toBe(false);
        });
    });
});
