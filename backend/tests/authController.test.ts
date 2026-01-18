import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as authController from '../src/controllers/authController';
import * as authService from '../src/services/authService';
import * as authMiddleware from '../src/middleware/auth';
import * as response from '../src/utils/response';
import * as cookies from '../src/utils/cookies';
import { User, UserRole } from '../src/entities/User';
import { ValidationError } from '../src/utils/errors';

// Mock dependencies
jest.mock('../src/db', () => ({
    getEntityManager: jest.fn(),
    getORM: jest.fn()
}));
jest.mock('../src/services/authService');
jest.mock('../src/middleware/auth');
jest.mock('../src/utils/response');
jest.mock('../src/utils/cookies');
jest.mock('../src/utils/logger');

// Import mocked db to set implementations
import { getEntityManager } from '../src/db';

describe('Auth Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;
    let mockEm: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockRes = {
            status: mockStatus,
            json: mockJson,
            cookie: jest.fn(),
            clearCookie: jest.fn(),
        } as any;
        mockReq = {
            body: {},
            headers: {},
            params: {},
            ip: '127.0.0.1'
        };

        mockEm = {
            findOne: jest.fn(),
            persistAndFlush: jest.fn(),
            flush: jest.fn(),
            nativeUpdate: jest.fn(),
        };
        (getEntityManager as jest.Mock).mockReturnValue(mockEm);
    });

    describe('register', () => {
        const registerBody = {
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
            podId: 'pod-1'
        };

        it('should register a new user successfully', async () => {
            mockReq.body = registerBody;
            mockEm.findOne.mockResolvedValue(null); // No existing user
            jest.mocked(authService.hashPassword).mockResolvedValue('hashed_pwd');
            jest.mocked(authService.createSession).mockResolvedValue({
                accessToken: 'access_token',
                refreshToken: 'refresh_token',
                expiresIn: '15m'
            } as any);

            await authController.register(mockReq as Request, mockRes as Response);

            expect(mockEm.persistAndFlush).toHaveBeenCalled();
            expect(cookies.setAuthCookies).toHaveBeenCalledWith(mockRes, 'access_token', 'refresh_token');
            expect(response.created).toHaveBeenCalled();
        });

        it('should fail if user already exists', async () => {
            mockReq.body = registerBody;
            mockEm.findOne.mockResolvedValue({ id: 'existing' }); // User exists

            await authController.register(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'User with this email already exists', 409, 'CONFLICT');
            expect(mockEm.persistAndFlush).not.toHaveBeenCalled();
        });

        it('should handle registration errors', async () => {
            mockReq.body = registerBody;
            mockEm.findOne.mockRejectedValue(new Error('DB Error'));

            await authController.register(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'DB Error', 500);
        });
    });

    describe('login', () => {
        const loginBody = { email: 'test@example.com', password: 'password123' };

        it('should login successfully', async () => {
            mockReq.body = loginBody;
            const loginResult = {
                success: true,
                accessToken: 'access_token',
                refreshToken: 'refresh_token',
                user: { id: 'user-1', email: 'test@example.com' },
                expiresIn: '15m'
            };
            jest.mocked(authService.login).mockResolvedValue(loginResult as any);

            await authController.login(mockReq as Request, mockRes as Response);

            expect(cookies.setAuthCookies).toHaveBeenCalledWith(mockRes, 'access_token', 'refresh_token');
            expect(response.success).toHaveBeenCalledWith(mockRes, expect.objectContaining({ user: loginResult.user }), 'Login successful');
        });

        it('should fail validation on missing fields', async () => {
            mockReq.body = { email: 'test@example.com' }; // Missing password

            await authController.login(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, expect.stringContaining('are required'), 400, 'VALIDATION_ERROR', expect.any(Array));
        });

        it('should handle failed login attempts', async () => {
            mockReq.body = loginBody;
            jest.mocked(authService.login).mockResolvedValue({ success: false, error: 'Invalid creds' });

            await authController.login(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Invalid creds', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle unexpected errors', async () => {
            mockReq.body = loginBody;
            jest.mocked(authService.login).mockRejectedValue(new Error('System failure'));

            await authController.login(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Login failed', 500);
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue('valid_refresh_token');
            jest.mocked(authService.refreshAccessToken).mockResolvedValue({
                success: true,
                accessToken: 'new_access_token',
                expiresIn: '15m'
            });

            await authController.refreshToken(mockReq as Request, mockRes as Response);

            expect(cookies.setAccessTokenCookie).toHaveBeenCalledWith(mockRes, 'new_access_token');
            expect(response.success).toHaveBeenCalled();
        });

        it('should fail if no refresh token provided', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue(null);

            await authController.refreshToken(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Refresh token is required', 400, 'VALIDATION_ERROR');
        });

        it('should fail if invalid token', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue('invalid_token');
            jest.mocked(authService.refreshAccessToken).mockResolvedValue({ success: false, error: 'Expired' });

            await authController.refreshToken(mockReq as Request, mockRes as Response);

            expect(cookies.clearAuthCookies).toHaveBeenCalledWith(mockRes);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Expired', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle service errors', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue('token');
            jest.mocked(authService.refreshAccessToken).mockRejectedValue(new Error('Service Error'));

            await authController.refreshToken(mockReq as Request, mockRes as Response);

            expect(cookies.clearAuthCookies).toHaveBeenCalledWith(mockRes);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Invalid refresh token', 401, 'AUTHENTICATION_ERROR');
        });
    });

    describe('getProfile', () => {
        it('should return user profile', async () => {
            mockReq.user = { id: 'user-1' } as any;
            const mockUser = { id: 'user-1', email: 'test@example.com' };
            mockEm.findOne.mockResolvedValue(mockUser);

            await authController.getProfile(mockReq as Request, mockRes as Response);

            expect(response.success).toHaveBeenCalledWith(mockRes, expect.objectContaining({ id: 'user-1' }));
        });

        it('should fail if user not attached to request', async () => {
            mockReq.user = undefined;

            await authController.getProfile(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 401, 'AUTHENTICATION_ERROR');
        });

        it('should fail if user not found in DB', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockEm.findOne.mockResolvedValue(null);

            await authController.getProfile(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 404, 'NOT_FOUND');
        });

        it('should handle DB errors', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockEm.findOne.mockRejectedValue(new Error('DB fail'));

            await authController.getProfile(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to get profile', 500);
        });
    });

    describe('updateProfile', () => {
        const updateBody = { name: 'New Name', slackUserId: 'U12345' };

        it('should update profile successfully', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockReq.body = updateBody;
            const mockUser = { id: 'user-1', name: 'Old', slackUserId: null };
            mockEm.findOne.mockResolvedValue(mockUser);

            await authController.updateProfile(mockReq as Request, mockRes as Response);

            expect(mockUser.name).toBe('New Name');
            expect(mockUser.slackUserId).toBe('U12345');
            expect(mockEm.flush).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalled();
        });

        it('should fail if user not found', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockEm.findOne.mockResolvedValue(null);

            await authController.updateProfile(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 404, 'NOT_FOUND');
        });

        it('should handle auth error', async () => {
            mockReq.user = undefined;
            await authController.updateProfile(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle DB error', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockEm.findOne.mockRejectedValue(new Error('Fail'));

            await authController.updateProfile(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to update profile', 500);
        });
    });

    describe('changePassword', () => {
        const pwdBody = { currentPassword: 'old', newPassword: 'newPassword123' };

        it('should change password successfully', async () => {
            mockReq.user = { id: 'user-1', email: 'test@example.com' } as any;
            mockReq.body = pwdBody;
            const mockUser = { id: 'user-1', passwordHash: 'hash' };
            mockEm.findOne.mockResolvedValue(mockUser);
            jest.mocked(authService.verifyPassword).mockResolvedValue(true);
            jest.mocked(authService.hashPassword).mockResolvedValue('newhash');

            await authController.changePassword(mockReq as Request, mockRes as Response);

            expect(authService.hashPassword).toHaveBeenCalledWith('newPassword123');
            expect(mockEm.flush).toHaveBeenCalled();
            expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
            expect(response.success).toHaveBeenCalled();
        });

        it('should fail validation (short password)', async () => {
            mockReq.user = { id: 'user-1', email: 'test@example.com' } as any;
            mockReq.body = { currentPassword: 'old', newPassword: 'short' };

            await authController.changePassword(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, expect.stringContaining('at least 8 characters'), 400, 'VALIDATION_ERROR');
        });

        it('should fail if current password incorrect', async () => {
            mockReq.user = { id: 'user-1', email: 'test@example.com' } as any;
            mockReq.body = pwdBody;
            mockEm.findOne.mockResolvedValue({ id: 'user-1', passwordHash: 'hash' });
            jest.mocked(authService.verifyPassword).mockResolvedValue(false);

            await authController.changePassword(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Current password is incorrect', 400, 'VALIDATION_ERROR');
        });

        it('should handle missing user', async () => {
            mockReq.user = undefined;
            await authController.changePassword(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle missing fields', async () => {
            mockReq.user = { id: 'user-1', email: 'test@test.com' } as any;
            mockReq.body = {} as any;
            await authController.changePassword(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, expect.stringContaining('required'), 400, 'VALIDATION_ERROR');
        });

        it('should handle DB missing user', async () => {
            mockReq.user = { id: 'user-1', email: 't' } as any;
            mockReq.body = pwdBody;
            mockEm.findOne.mockResolvedValue(null);

            await authController.changePassword(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle errors', async () => {
            mockReq.user = { id: 'user-1', email: 't' } as any;
            mockReq.body = pwdBody;
            mockEm.findOne.mockRejectedValue(new Error('Err'));

            await authController.changePassword(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to change password', 500);
        });
    });

    describe('logout', () => {
        it('should logout successfully with token', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue('token');
            jest.mocked(authService.logout).mockResolvedValue({ success: true });

            await authController.logout(mockReq as Request, mockRes as Response);

            expect(authService.logout).toHaveBeenCalledWith('token');
            expect(cookies.clearAuthCookies).toHaveBeenCalledWith(mockRes);
            expect(response.success).toHaveBeenCalled();
        });

        it('should blacklist access token if present', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue('token');
            jest.mocked(authService.logout).mockResolvedValue({ success: true });
            mockReq.accessToken = 'access';
            mockReq.user = { id: 'u1' } as any;

            await authController.logout(mockReq as Request, mockRes as Response);

            expect(authMiddleware.blacklistAccessToken).toHaveBeenCalledWith('access', 'u1');
        });

        it('should handle no refresh token (still clears cookies)', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue(null);

            await authController.logout(mockReq as Request, mockRes as Response);

            expect(authService.logout).not.toHaveBeenCalled();
            expect(cookies.clearAuthCookies).toHaveBeenCalledWith(mockRes);
        });

        it('should handle logout errors gracefully', async () => {
            jest.mocked(cookies.extractRefreshToken).mockReturnValue('token');
            jest.mocked(authService.logout).mockRejectedValue(new Error('fail'));

            await authController.logout(mockReq as Request, mockRes as Response);

            // Should still clear cookies
            expect(cookies.clearAuthCookies).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalled();
        });
    });

    describe('logoutAll', () => {
        it('should logout all sessions', async () => {
            mockReq.user = { id: 'user-1' } as any;
            jest.mocked(authService.logoutAll).mockResolvedValue({ success: true, sessionsRevoked: 5, message: 'Done' });

            await authController.logoutAll(mockReq as Request, mockRes as Response);

            expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
            expect(response.success).toHaveBeenCalled();
        });

        it('should fail if no user context', async () => {
            mockReq.user = undefined;
            await authController.logoutAll(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle errors', async () => {
            mockReq.user = { id: 'user-1' } as any;
            jest.mocked(authService.logoutAll).mockRejectedValue(new Error('Fail'));

            await authController.logoutAll(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to logout from all devices', 500);
        });
    });

    describe('getSessions', () => {
        it('should return sessions', async () => {
            mockReq.user = { id: 'user-1' } as any;
            const sessions = [{ id: 1 }, { id: 2 }];
            jest.mocked(authMiddleware.getActiveSessions).mockResolvedValue(sessions as any);

            await authController.getSessions(mockReq as Request, mockRes as Response);

            expect(response.success).toHaveBeenCalledWith(mockRes, { sessions, count: 2 });
        });

        it('should fail if no user', async () => {
            mockReq.user = undefined;
            await authController.getSessions(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle errors', async () => {
            mockReq.user = { id: 'user-1' } as any;
            jest.mocked(authMiddleware.getActiveSessions).mockRejectedValue(new Error('Fail'));
            await authController.getSessions(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to get sessions', 500);
        });
    });

    describe('revokeSession', () => {
        it('should revoke session', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockReq.params = { sessionId: '123' };
            jest.mocked(authMiddleware.revokeSession).mockResolvedValue(true);

            await authController.revokeSession(mockReq as Request, mockRes as Response);

            expect(authMiddleware.revokeSession).toHaveBeenCalledWith('user-1', '123');
            expect(response.success).toHaveBeenCalled();
        });

        it('should fail if session not found', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockReq.params = { sessionId: '123' };
            jest.mocked(authMiddleware.revokeSession).mockResolvedValue(false);

            await authController.revokeSession(mockReq as Request, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Session not found or already revoked', 404, 'NOT_FOUND');
        });

        it('should fail if no user', async () => {
            mockReq.user = undefined;
            await authController.revokeSession(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'User not found', 401, 'AUTHENTICATION_ERROR');
        });

        it('should handle errors', async () => {
            mockReq.user = { id: 'user-1' } as any;
            mockReq.params = { sessionId: '123' };
            jest.mocked(authMiddleware.revokeSession).mockRejectedValue(new Error('Fail'));

            await authController.revokeSession(mockReq as Request, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to revoke session', 500);
        });
    });
});
