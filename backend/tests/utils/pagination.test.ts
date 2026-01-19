/**
 * Pagination Utilities Tests
 */

import {
    generatePaginationMeta,
    generatePaginationLinks,
    createPaginatedResponse
} from '../../src/utils/pagination';

describe('Pagination Utilities', () => {
    describe('generatePaginationMeta', () => {
        it('should generate correct metadata for first page', () => {
            const meta = generatePaginationMeta(100, 1, 10);

            expect(meta).toEqual({
                total: 100,
                page: 1,
                limit: 10,
                totalPages: 10
            });
        });

        it('should generate correct metadata for middle page', () => {
            const meta = generatePaginationMeta(100, 5, 10);

            expect(meta).toEqual({
                total: 100,
                page: 5,
                limit: 10,
                totalPages: 10
            });
        });

        it('should generate correct metadata for last page', () => {
            const meta = generatePaginationMeta(100, 10, 10);

            expect(meta).toEqual({
                total: 100,
                page: 10,
                limit: 10,
                totalPages: 10
            });
        });

        it('should handle partial last page', () => {
            const meta = generatePaginationMeta(95, 10, 10);

            expect(meta).toEqual({
                total: 95,
                page: 10,
                limit: 10,
                totalPages: 10
            });
        });

        it('should handle zero total', () => {
            const meta = generatePaginationMeta(0, 1, 10);

            expect(meta).toEqual({
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 1
            });
        });

        it('should handle single item', () => {
            const meta = generatePaginationMeta(1, 1, 10);

            expect(meta).toEqual({
                total: 1,
                page: 1,
                limit: 10,
                totalPages: 1
            });
        });

        it('should calculate totalPages correctly with different limits', () => {
            expect(generatePaginationMeta(100, 1, 20).totalPages).toBe(5);
            expect(generatePaginationMeta(100, 1, 25).totalPages).toBe(4);
            expect(generatePaginationMeta(100, 1, 50).totalPages).toBe(2);
        });
    });

    describe('generatePaginationLinks', () => {
        const baseUrl = '/api/users';

        it('should generate all links for middle page', () => {
            const links = generatePaginationLinks(baseUrl, 5, 10, 100);

            expect(links.self).toBe('/api/users?page=5&limit=10');
            expect(links.next).toBe('/api/users?page=6&limit=10');
            expect(links.prev).toBe('/api/users?page=4&limit=10');
            expect(links.first).toBe('/api/users?page=1&limit=10');
            expect(links.last).toBe('/api/users?page=10&limit=10');
        });

        it('should not include prev link on first page', () => {
            const links = generatePaginationLinks(baseUrl, 1, 10, 100);

            expect(links.prev).toBeNull();
            expect(links.next).toBe('/api/users?page=2&limit=10');
        });

        it('should not include next link on last page', () => {
            const links = generatePaginationLinks(baseUrl, 10, 10, 100);

            expect(links.next).toBeNull();
            expect(links.prev).toBe('/api/users?page=9&limit=10');
        });

        it('should handle single page', () => {
            const links = generatePaginationLinks(baseUrl, 1, 10, 5);

            expect(links.prev).toBeNull();
            expect(links.next).toBeNull();
            expect(links.first).toBe('/api/users?page=1&limit=10');
            expect(links.last).toBe('/api/users?page=1&limit=10');
        });

        it('should preserve query parameters', () => {
            const queryParams = {
                status: 'active',
                role: 'developer'
            };

            const links = generatePaginationLinks(baseUrl, 2, 10, 100, queryParams);

            expect(links.self).toContain('status=active');
            expect(links.self).toContain('role=developer');
            expect(links.next).toContain('status=active');
            expect(links.next).toContain('role=developer');
        });

        it('should handle numeric query parameters', () => {
            const queryParams = {
                minAge: 18,
                maxAge: 65
            };

            const links = generatePaginationLinks(baseUrl, 1, 10, 100, queryParams);

            expect(links.self).toContain('minAge=18');
            expect(links.self).toContain('maxAge=65');
        });

        it('should handle boolean query parameters', () => {
            const queryParams = {
                isActive: true,
                isVerified: false
            };

            const links = generatePaginationLinks(baseUrl, 1, 10, 100, queryParams);

            expect(links.self).toContain('isActive=true');
            expect(links.self).toContain('isVerified=false');
        });

        it('should skip undefined query parameters', () => {
            const queryParams = {
                status: 'active',
                role: undefined as any
            };

            const links = generatePaginationLinks(baseUrl, 1, 10, 100, queryParams);

            expect(links.self).toContain('status=active');
            expect(links.self).not.toContain('role');
        });

        it('should skip null query parameters', () => {
            const queryParams = {
                status: 'active',
                role: null as any
            };

            const links = generatePaginationLinks(baseUrl, 1, 10, 100, queryParams);

            expect(links.self).toContain('status=active');
            expect(links.self).not.toContain('role');
        });

        it('should skip empty string query parameters', () => {
            const queryParams = {
                status: 'active',
                role: ''
            };

            const links = generatePaginationLinks(baseUrl, 1, 10, 100, queryParams);

            expect(links.self).toContain('status=active');
            expect(links.self).not.toContain('role');
        });

        it('should handle zero total items', () => {
            const links = generatePaginationLinks(baseUrl, 1, 10, 0);

            expect(links.prev).toBeNull();
            expect(links.next).toBeNull();
            expect(links.first).toBe('/api/users?page=1&limit=10');
            expect(links.last).toBe('/api/users?page=1&limit=10');
        });
    });

    describe('createPaginatedResponse', () => {
        const sampleData = [
            { id: 1, name: 'User 1' },
            { id: 2, name: 'User 2' },
            { id: 3, name: 'User 3' }
        ];

        it('should create response with data and pagination', () => {
            const response = createPaginatedResponse(sampleData, 30, 1, 10);

            expect(response.success).toBe(true);
            expect(response.data).toEqual(sampleData);
            expect(response.pagination).toEqual({
                total: 30,
                page: 1,
                limit: 10,
                totalPages: 3
            });
            expect(response.links).toBeUndefined();
        });

        it('should include HATEOAS links when baseUrl provided', () => {
            const response = createPaginatedResponse(
                sampleData,
                30,
                2,
                10,
                '/api/users'
            );

            expect(response.links).toBeDefined();
            expect(response.links?.self).toBe('/api/users?page=2&limit=10');
            expect(response.links?.next).toBe('/api/users?page=3&limit=10');
            expect(response.links?.prev).toBe('/api/users?page=1&limit=10');
        });

        it('should preserve query parameters in links', () => {
            const response = createPaginatedResponse(
                sampleData,
                30,
                1,
                10,
                '/api/users',
                { role: 'developer', status: 'active' }
            );

            expect(response.links?.self).toContain('role=developer');
            expect(response.links?.self).toContain('status=active');
        });

        it('should handle empty data array', () => {
            const response = createPaginatedResponse([], 0, 1, 10);

            expect(response.success).toBe(true);
            expect(response.data).toEqual([]);
            expect(response.pagination.total).toBe(0);
            expect(response.pagination.totalPages).toBe(1);
        });

        it('should handle single page of data', () => {
            const response = createPaginatedResponse(sampleData, 3, 1, 10);

            expect(response.pagination.totalPages).toBe(1);
        });

        it('should work with different data types', () => {
            const stringData = ['a', 'b', 'c'];
            const response = createPaginatedResponse(stringData, 30, 1, 10);

            expect(response.data).toEqual(stringData);
        });

        it('should work with complex objects', () => {
            const complexData = [
                { id: 1, user: { name: 'John', email: 'john@example.com' }, metadata: { key: 'value' } }
            ];
            const response = createPaginatedResponse(complexData, 1, 1, 10);

            expect(response.data).toEqual(complexData);
        });
    });
});
