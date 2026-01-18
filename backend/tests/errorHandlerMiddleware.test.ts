/**
 * Error Handler Middleware Tests (TypeScript)
 * 100% Branch Coverage
 */
// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

describe('Error Handler Default Values Branch Coverage', () => {
    let errorHandler: any;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        jest.resetModules();
        jest.doMock('../src/config', () => ({
            isDevelopment: true,
            isTest: true,
            isProduction: false,
            logging: { level: 'info' },
        }));
        errorHandler = require('../src/middleware/errorHandler').errorHandler;
        mockRes = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn() as any,
        };
    });

    it('should default to statusCode 500 when err.statusCode is undefined', () => {
        const err: any = new Error('Test error without statusCode');
        err.code = 'TEST_CODE';

        const mockReq = { path: '/test', method: 'GET', body: {} };

        errorHandler(err, mockReq, mockRes, jest.fn());

        expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should default to statusCode 500 when err.statusCode is 0', () => {
        const err: any = new Error('Test error with statusCode 0');
        err.statusCode = 0;
        err.code = 'TEST_CODE';

        const mockReq = { path: '/test', method: 'GET', body: {} };

        errorHandler(err, mockReq, mockRes, jest.fn());

        expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should default to code INTERNAL_ERROR when err.code is undefined', () => {
        const err: any = new Error('Test error without code');
        err.statusCode = 400;

        const mockReq = { path: '/test', method: 'GET', body: {} };

        errorHandler(err, mockReq, mockRes, jest.fn());

        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'INTERNAL_ERROR',
            })
        );
    });

    it('should default to code INTERNAL_ERROR when err.code is empty string', () => {
        const err: any = new Error('Test error with empty code');
        err.statusCode = 400;
        err.code = '';

        const mockReq = { path: '/test', method: 'GET', body: {} };

        errorHandler(err, mockReq, mockRes, jest.fn());

        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'INTERNAL_ERROR',
            })
        );
    });

    it('should use both defaults when neither statusCode nor code is set', () => {
        const err = new Error('Test error with no statusCode or code');

        const mockReq = { path: '/test', method: 'GET', body: {} };

        errorHandler(err, mockReq, mockRes, jest.fn());

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'INTERNAL_ERROR',
            })
        );
    });
});

describe('Error Handler Middleware', () => {
    let errorHandler: any;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
        jest.resetModules();

        mockReq = {
            originalUrl: '/test',
            path: '/test',
            method: 'GET',
            body: {},
            user: null as any,
        };
        mockRes = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn().mockReturnThis() as any,
        };
        mockNext = jest.fn() as jest.Mock;
    });

    describe('notFound', () => {
        it('should return 404 with route info', () => {
            jest.doMock('../src/config', () => ({
                isDevelopment: true,
                isTest: true,
                isProduction: false,
                logging: { level: 'info' },
            }));

            errorHandler = require('../src/middleware/errorHandler');

            errorHandler.notFound(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Route /test not found',
                code: 'NOT_FOUND',
            });
        });
    });

    describe('asyncHandler', () => {
        it('should pass result of async function', async () => {
            jest.doMock('../src/config', () => ({
                isDevelopment: true,
                isTest: true,
                isProduction: false,
                logging: { level: 'info' },
            }));

            errorHandler = require('../src/middleware/errorHandler');

            const asyncFn = jest.fn().mockResolvedValue('result');
            const wrapped = errorHandler.asyncHandler(asyncFn);

            await wrapped(mockReq, mockRes, mockNext);

            expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
        });

        it('should catch async errors and pass to next', async () => {
            jest.doMock('../src/config', () => ({
                isDevelopment: true,
                isTest: true,
                isProduction: false,
                logging: { level: 'info' },
            }));

            errorHandler = require('../src/middleware/errorHandler');

            const error = new Error('Async error');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrapped = errorHandler.asyncHandler(asyncFn);

            await wrapped(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle sync functions that return promises', async () => {
            jest.doMock('../src/config', () => ({
                isDevelopment: true,
                isTest: true,
                isProduction: false,
                logging: { level: 'info' },
            }));

            errorHandler = require('../src/middleware/errorHandler');

            const syncFn = jest.fn().mockReturnValue(Promise.resolve());
            const wrapped = errorHandler.asyncHandler(syncFn);

            await wrapped(mockReq, mockRes, mockNext);

            expect(syncFn).toHaveBeenCalled();
        });
    });

    describe('errorHandler - Development Mode', () => {
        beforeEach(() => {
            jest.resetModules();
            jest.doMock('../src/config', () => ({
                isDevelopment: true,
                isTest: true,
                isProduction: false,
                logging: { level: 'info' },
            }));
            jest.doMock('../src/utils/logger', () => ({
                error: jest.fn(),
                warn: jest.fn(),
            }));
            errorHandler = require('../src/middleware/errorHandler');
        });

        it('should return full error details in development', () => {
            const error: any = new Error('Test error');
            error.statusCode = 400;
            error.code = 'TEST_ERROR';

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'Test error',
                code: 'TEST_ERROR',
                stack: expect.any(String),
            }));
        });

        it('should use default status code 500', () => {
            const error = new Error('Test error');

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });

        it('should use default code INTERNAL_ERROR', () => {
            const error = new Error('Test error');

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'INTERNAL_ERROR',
            }));
        });

        it('should log server errors (status >= 500)', () => {
            const logger = require('../src/utils/logger');
            const error: any = new Error('Server error');
            error.statusCode = 500;
            mockReq.user = { id: '123' } as any;

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(logger.error).toHaveBeenCalled();
        });

        it('should log client errors (status < 500) as warnings', () => {
            const logger = require('../src/utils/logger');
            const error: any = new Error('Client error');
            error.statusCode = 400;

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(logger.warn).toHaveBeenCalled();
        });
    });

    describe('errorHandler - Production Mode', () => {
        beforeEach(() => {
            jest.resetModules();
            jest.doMock('../src/config', () => ({
                isDevelopment: false,
                isTest: false,
                isProduction: true,
                logging: { level: 'info' },
            }));
            jest.doMock('../src/utils/logger', () => ({
                error: jest.fn(),
                warn: jest.fn(),
            }));
            errorHandler = require('../src/middleware/errorHandler');
        });

        it('should return minimal error for operational errors', () => {
            const { AppError } = require('../src/utils/errors');
            const error = new AppError('Operational error', 400, 'OP_ERROR');

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Operational error',
                code: 'OP_ERROR',
            });
        });

        it('should include errors array for validation errors', () => {
            const { AppError } = require('../src/utils/errors');
            const error: any = new AppError('Validation error', 400, 'VALIDATION');
            error.errors = [{ field: 'email', message: 'invalid' }];
            error.isOperational = true;

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                errors: [{ field: 'email', message: 'invalid' }],
            }));
        });

        it('should hide details for non-operational errors', () => {
            const error: any = new Error('Programming error');
            error.statusCode = 500;

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                message: 'Something went wrong',
                code: 'INTERNAL_ERROR',
            });
        });

        it('should handle CastError', () => {
            const error: any = new Error('Cast error');
            error.name = 'CastError';
            error.path = 'id';
            error.value = 'invalid';

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should handle duplicate key error (23505)', () => {
            const error: any = new Error('Duplicate key error "test@test.com"');
            error.code = '23505';

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(409);
        });

        it('should handle duplicate key error without match', () => {
            const error: any = new Error('Duplicate key error');
            error.code = '23505';

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(409);
        });

        it('should handle ValidationError from mongoose', () => {
            const error: any = new Error('Validation failed');
            error.name = 'ValidationError';
            error.errors = {
                field1: { message: 'Field1 is required' },
                field2: { message: 'Field2 is invalid' },
            };

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should handle JsonWebTokenError', () => {
            const error: any = new Error('jwt malformed');
            error.name = 'JsonWebTokenError';

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should handle TokenExpiredError', () => {
            const error: any = new Error('jwt expired');
            error.name = 'TokenExpiredError';

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should default to INTERNAL_ERROR for operational error without code', () => {
            const { AppError } = require('../src/utils/errors');
            const error = new AppError('Op error', 400);
            delete error.code; // Remove code to trigger default

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'INTERNAL_ERROR',
                message: 'Op error'
            }));
        });

        it('should default to 500 for operational error without statusCode', () => {
            const { AppError } = require('../src/utils/errors');
            const error = new AppError('Op error', undefined, 'OP_ERR');
            // AppError constructor might set default statusCode, so explicitly unset it if possible or mock it
            // However, errorHandler checks err.statusCode || 500. 
            // Let's force it undefined.
            const err: any = { isOperational: true, message: 'Op error' };

            errorHandler.errorHandler(err, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });

        it('should handle empty validation errors object map', () => {
            const { AppError } = require('../src/utils/errors');
            const error: any = new AppError('Validation error', 400, 'VALIDATION');
            error.name = 'ValidationError'; // Required to trigger handleValidationError
            error.errors = { field: { noMessage: true } };
            error.isOperational = true;

            errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid input data',
                code: 'VALIDATION_ERROR'
            }));
        });
    });
});
