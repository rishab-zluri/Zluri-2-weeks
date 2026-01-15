/**
 * Auth Controller Tests (TypeScript)
 * Tests for authentication endpoints
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { User, UserRole } from '../src/entities/User';
import * as authController from '../src/controllers/authController';

// Mock dependencies
const mockEntityManager = {
    findOne: jest.fn<any>(),
    persistAndFlush: jest.fn<any>(),
    flush: jest.fn<any>(),
};

jest.mock('../src/db', () => ({
    getEntityManager: jest.fn(() => mockEntityManager),
}));

jest.mock('../src/middleware/auth', () => ({
    generateTokens: jest.fn(),
    verifyRefreshToken: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    blacklistAccessToken: jest.fn(),
    getActiveSessions: jest.fn(),
    revokeSession: jest.fn(),
}));

jest.mock('../src/services/authService', () => ({
    hashPassword: jest.fn<any>(),
    verifyPassword: jest.fn<any>(),
    createSession: jest.fn<any>(),
    login: jest.fn<any>(),
    refreshAccessToken: jest.fn<any>(),
    logout: jest.fn<any>(),
    logoutAll: jest.fn<any>(),
}));

// Import mocks to configure return values
import * as authMiddleware from '../src/middleware/auth';
import * as authService from '../src/services/authService';

describe('Auth Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            body: {},
            user: undefined as any,
            headers: { 'user-agent': 'test-agent' },
            ip: '127.0.0.1',
            connection: { remoteAddress: '127.0.0.1' } as any,
        };

        mockRes = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn().mockReturnThis() as any,
        };
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'Test@123',
                name: 'Test User',
                podId: 'pod-1',
            };

            // Mock User not found
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(null);

            // Mock hashPassword
            (authService.hashPassword as jest.Mock<any>).mockResolvedValue('hashed_password');

            // Mock createSession
            (authService.createSession as jest.Mock<any>).mockResolvedValue({
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token',
                expiresIn: '15m',
            });

            await authController.register(mockReq as Request, mockRes as Response);

            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        accessToken: 'test-access-token',
                    }),
                })
            );
        });

        it('should return error for duplicate email', async () => {
            mockReq.body = {
                email: 'existing@example.com',
                password: 'Test@123',
                name: 'Test User',
            };

            // Mock User found
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue({ id: 'existing-user' });

            await authController.register(mockReq as Request, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(409);
        });
    });

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'Test@123',
            };

            const mockUser = new User();
            mockUser.id = 'user-123';
            mockUser.email = 'test@example.com';
            mockUser.passwordHash = 'hashed_password';

            (authService.login as jest.Mock<any>).mockResolvedValue({
                success: true,
                user: mockUser,
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token',
                expiresIn: '15m',
            });

            await authController.login(mockReq as Request, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        accessToken: 'test-access-token',
                    }),
                })
            );
        });

        it('should return error when login service fails', async () => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'WrongPassword',
            };

            (authService.login as jest.Mock<any>).mockResolvedValue({
                success: false,
                error: 'Invalid credentials',
            });

            await authController.login(mockReq as Request, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });
    });

    describe('getProfile', () => {
        it('should return user profile', async () => {
            mockReq.user = { id: 'user-123' } as any;

            const mockUser = new User();
            mockUser.id = 'user-123';
            mockUser.email = 'test@example.com';
            mockUser.name = 'Test User';
            mockUser.role = UserRole.DEVELOPER;

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockUser);

            await authController.getProfile(mockReq as Request, mockRes as Response);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        email: 'test@example.com',
                    }),
                })
            );
        });
    });
});
