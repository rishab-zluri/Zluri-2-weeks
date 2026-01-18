import {
    generatePaginationMeta,
    generatePaginationLinks,
    createPaginatedResponse
} from '../../src/utils/pagination';

describe('Pagination Utilities', () => {
    describe('generatePaginationMeta', () => {
        it('should calculate total pages correctly', () => {
            expect(generatePaginationMeta(100, 1, 10)).toEqual({
                total: 100,
                page: 1,
                limit: 10,
                totalPages: 10
            });
        });

        it('should handle partial pages', () => {
            expect(generatePaginationMeta(101, 1, 10)).toEqual({
                total: 101,
                page: 1,
                limit: 10,
                totalPages: 11
            });
        });

        it('should handle zero total', () => {
            expect(generatePaginationMeta(0, 1, 10)).toEqual({
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 1 // Assuming at least 1 page for empty results
            });
        });
    });

    describe('generatePaginationLinks', () => {
        const baseUrl = '/api/items';

        it('should generate accurate links for first page', () => {
            const links = generatePaginationLinks(baseUrl, 1, 10, 50);
            expect(links.self).toContain('page=1');
            expect(links.first).toContain('page=1');
            expect(links.prev).toBeNull();
            expect(links.next).toContain('page=2');
            expect(links.last).toContain('page=5');
        });

        it('should generate accurate links for middle page', () => {
            const links = generatePaginationLinks(baseUrl, 3, 10, 50);
            expect(links.self).toContain('page=3');
            expect(links.prev).toContain('page=2');
            expect(links.next).toContain('page=4');
        });

        it('should generate accurate links for last page', () => {
            const links = generatePaginationLinks(baseUrl, 5, 10, 50);
            expect(links.self).toContain('page=5');
            expect(links.next).toBeNull();
            expect(links.last).toContain('page=5');
        });

        it('should preserve query parameters', () => {
            const links = generatePaginationLinks(baseUrl, 1, 10, 20, { type: 'active', sort: 'desc' });
            expect(links.self).toContain('type=active');
            expect(links.self).toContain('sort=desc');
            expect(links.next).toContain('type=active');
            expect(links.next).toContain('sort=desc');
        });

        it('should ignore empty query parameters', () => {
            const links = generatePaginationLinks(baseUrl, 1, 10, 20, { empty: '', nullVal: null as any, valid: 'yes' });
            expect(links.self).toContain('valid=yes');
            expect(links.self).not.toContain('empty=');
            expect(links.self).not.toContain('nullVal=');
        });
    });

    describe('createPaginatedResponse', () => {
        it('should structure response correctly without links', () => {
            const data = [{ id: 1 }, { id: 2 }];
            const response = createPaginatedResponse(data, 2, 1, 10);

            expect(response.success).toBe(true);
            expect(response.data).toEqual(data);
            expect(response.pagination).toBeDefined();
            expect(response.links).toBeUndefined();
        });

        it('should include links when baseUrl provided', () => {
            const data = [{ id: 1 }];
            const response = createPaginatedResponse(data, 1, 1, 10, '/api/test');

            expect(response.links).toBeDefined();
            expect(response.links?.self).toContain('/api/test');
        });
    });
});
