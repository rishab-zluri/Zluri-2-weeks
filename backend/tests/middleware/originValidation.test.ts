/**
 * Origin Validation Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import { validateOrigin } from '../../src/middleware/originValidation';

describe('Origin Validation Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        mockReq = {
            headers: {},
            method: 'GET',
            path: '/api/test'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Production Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOWED_ORIGINS = 'https://app.example.com,https://admin.example.com';
        });

        it('should allow requests from allowed origins', () => {
            mockReq.headers = { origin: 'https://app.example.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should allow requests from second allowed origin', () => {
            mockReq.headers = { origin: 'https://admin.example.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should block requests from disallowed origins', () => {
            mockReq.headers = { origin: 'https://malicious-site.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.stringContaining('Origin not allowed')
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should allow requests without origin header (same-origin)', () => {
            mockReq.headers = {};
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should be case-sensitive for origins', () => {
            mockReq.headers = { origin: 'https://APP.EXAMPLE.COM' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            // Should block if case doesn't match
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle trailing slashes in origin', () => {
            mockReq.headers = { origin: 'https://app.example.com/' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            // Behavior depends on implementation
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Development Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('should allow localhost origins', () => {
            mockReq.headers = { origin: 'http://localhost:3000' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow 127.0.0.1 origins', () => {
            mockReq.headers = { origin: 'http://127.0.0.1:3000' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow any origin in development', () => {
            mockReq.headers = { origin: 'http://random-dev-server:8080' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('CORS Preflight Requests', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOWED_ORIGINS = 'https://app.example.com';
            mockReq.method = 'OPTIONS';
        });

        it('should handle OPTIONS requests', () => {
            mockReq.headers = { origin: 'https://app.example.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should block OPTIONS from disallowed origins', () => {
            mockReq.headers = { origin: 'https://malicious-site.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOWED_ORIGINS = 'https://app.example.com';
        });

        it('should handle null origin', () => {
            mockReq.headers = { origin: 'null' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            // null origin should be blocked in production
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle empty origin', () => {
            mockReq.headers = { origin: '' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle malformed origin', () => {
            mockReq.headers = { origin: 'not-a-valid-url' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle origin with port', () => {
            process.env.ALLOWED_ORIGINS = 'https://app.example.com:8443';
            mockReq.headers = { origin: 'https://app.example.com:8443' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle subdomain variations', () => {
            mockReq.headers = { origin: 'https://subdomain.app.example.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            // Should block if subdomain not explicitly allowed
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Configuration', () => {
        it('should handle missing ALLOWED_ORIGINS env var', () => {
            process.env.NODE_ENV = 'production';
            delete process.env.ALLOWED_ORIGINS;
            mockReq.headers = { origin: 'https://any-site.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            // Should block all origins if not configured
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle empty ALLOWED_ORIGINS', () => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOWED_ORIGINS = '';
            mockReq.headers = { origin: 'https://any-site.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should handle whitespace in ALLOWED_ORIGINS', () => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOWED_ORIGINS = ' https://app.example.com , https://admin.example.com ';
            mockReq.headers = { origin: 'https://app.example.com' };
            
            validateOrigin(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
