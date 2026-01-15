/**
 * API Response Helpers
 * Standardized response format for all API endpoints
 */

import { Response } from 'express';
import { ErrorCode, ValidationErrorDetail } from './errors';

/**
 * Base API response structure
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    code?: ErrorCode;
    errors?: ValidationErrorDetail[];
}

/**
 * Pagination info returned to client
 */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
    pagination: PaginationInfo;
}

/**
 * Input pagination parameters
 */
export interface PaginationParams {
    page: number;
    limit: number;
    total: number;
}

/**
 * Success response
 * @param res - Express response object
 * @param data - Response data
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 */
export function success<T>(
    res: Response,
    data: T | null = null,
    message: string = 'Success',
    statusCode: number = 200
): Response {
    const response: ApiResponse<T> = {
        success: true,
        message,
        ...(data !== null && { data }),
    };

    return res.status(statusCode).json(response);
}

/**
 * Created response - 201
 * @param res - Express response object
 * @param data - Created resource data
 * @param message - Success message
 */
export function created<T>(
    res: Response,
    data: T | null = null,
    message: string = 'Resource created successfully'
): Response {
    return success(res, data, message, 201);
}

/**
 * No content response - 204
 * @param res - Express response object
 */
export function noContent(res: Response): Response {
    return res.status(204).send();
}

/**
 * Error response
 * @param res - Express response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 500)
 * @param code - Error code
 * @param errors - Validation errors array
 */
export function error(
    res: Response,
    message: string = 'An error occurred',
    statusCode: number = 500,
    code: ErrorCode = 'INTERNAL_ERROR',
    errors: ValidationErrorDetail[] | null = null
): Response {
    const response: ApiResponse = {
        success: false,
        message,
        code,
        ...(errors && { errors }),
    };

    return res.status(statusCode).json(response);
}

/**
 * Paginated response
 * @param res - Express response object
 * @param data - Array of items
 * @param pagination - Pagination parameters
 * @param message - Success message
 */
export function paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationParams,
    message: string = 'Success'
): Response {
    const totalPages = Math.ceil(pagination.total / pagination.limit);

    const response: PaginatedResponse<T> = {
        success: true,
        message,
        data,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages,
            hasNext: pagination.page < totalPages,
            hasPrev: pagination.page > 1,
        },
    };

    return res.status(200).json(response);
}

/**
 * Default export as object for CommonJS compatibility
 */
export default {
    success,
    created,
    noContent,
    error,
    paginated,
};
