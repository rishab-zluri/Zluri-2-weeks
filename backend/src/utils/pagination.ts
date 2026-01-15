/**
 * Pagination Utilities
 * 
 * Utilities for generating HATEOAS pagination links and metadata.
 * Follows RFC 8288 (Web Linking) standards.
 * 
 * WHY THIS EXISTS:
 * - Provides discoverability via hypermedia links
 * - Standardizes pagination across all endpoints
 * - Improves API client implementation
 */

/**
 * Pagination metadata
 */
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * HATEOAS pagination links (RFC 8288)
 */
export interface PaginationLinks {
    self: string;
    next: string | null;
    prev: string | null;
    first: string;
    last: string;
}

/**
 * Complete paginated response structure
 */
export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: PaginationMeta;
    links?: PaginationLinks;
}

/**
 * Generate pagination metadata
 * 
 * @param total - Total number of items
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @returns Pagination metadata object
 */
export function generatePaginationMeta(
    total: number,
    page: number,
    limit: number
): PaginationMeta {
    const totalPages = Math.ceil(total / limit);

    return {
        total,
        page,
        limit,
        totalPages: totalPages > 0 ? totalPages : 1
    };
}

/**
 * Generate HATEOAS pagination links
 * 
 * Creates RFC 8288 compliant pagination links for API discoverability.
 * 
 * @param baseUrl - Base URL for the resource (e.g., '/api/v1/queries/my-requests')
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param total - Total number of items
 * @param queryParams - Additional query parameters to preserve
 * @returns HATEOAS pagination links object
 * 
 * @example
 * ```typescript
 * const links = generatePaginationLinks('/api/v1/users', 2, 10, 95);
 * // {
 * //   self: '/api/v1/users?page=2&limit=10',
 * //   next: '/api/v1/users?page=3&limit=10',
 * //   prev: '/api/v1/users?page=1&limit=10',
 * //   first: '/api/v1/users?page=1&limit=10',
 * //   last: '/api/v1/users?page=10&limit=10'
 * // }
 * ```
 */
export function generatePaginationLinks(
    baseUrl: string,
    page: number,
    limit: number,
    total: number,
    queryParams: Record<string, string | number | boolean> = {}
): PaginationLinks {
    const totalPages = Math.ceil(total / limit);

    // Helper to build query string
    const buildUrl = (pageNum: number): string => {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', limit.toString());

        // Preserve additional query parameters (e.g., filters)
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.set(key, value.toString());
            }
        });

        return `${baseUrl}?${params.toString()}`;
    };

    return {
        self: buildUrl(page),
        next: page < totalPages ? buildUrl(page + 1) : null,
        prev: page > 1 ? buildUrl(page - 1) : null,
        first: buildUrl(1),
        last: buildUrl(totalPages > 0 ? totalPages : 1)
    };
}

/**
 * Create a complete paginated response
 * 
 * Combines data, pagination metadata, and HATEOAS links into a standard response.
 * 
 * @param data - Array of items for current page
 * @param total - Total number of items across all pages
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param baseUrl - Base URL for HATEOAS links (optional)
 * @param queryParams - Additional query parameters (optional)
 * @returns Complete paginated response object
 * 
 * @example
 * ```typescript
 * const response = createPaginatedResponse(
 *   users,
 *   95,
 *   2,
 *   10,
 *   '/api/v1/users',
 *   { role: 'developer' }
 * );
 * ```
 */
export function createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    baseUrl?: string,
    queryParams?: Record<string, string | number | boolean>
): PaginatedResponse<T> {
    const pagination = generatePaginationMeta(total, page, limit);

    const response: PaginatedResponse<T> = {
        success: true,
        data,
        pagination
    };

    // Add HATEOAS links if baseUrl provided
    if (baseUrl) {
        response.links = generatePaginationLinks(baseUrl, page, limit, total, queryParams);
    }

    return response;
}
