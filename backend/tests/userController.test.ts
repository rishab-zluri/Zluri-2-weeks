/**
 * User Controller Tests
 * Tests for user management endpoints
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as userController from '../src/controllers/userController';
import { User, UserRole } from '../src/entities/User';
import * as response from '../src/utils/response';
import bcrypt from 'bcryptjs';

// Mock dependencies
const mockEntityManager = {
    findOne: jest.fn<any>(),
    findAndCount: jest.fn<any>(),
    flush: jest.fn<any>(),
};

jest.mock('../src/db', () => ({
    getEntityManager: jest.fn(() => mockEntityManager),
}));

jest.mock('../src/utils/response', () => ({
    success: jest.fn(),
    created: jest.fn(),
    error: jest.fn(),
    paginated: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
    genSalt: jest.fn().mockResolvedValue('salt' as never),
    hash: jest.fn().mockResolvedValue('hashedPassword' as never),
}));

describe('User Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            params: {},
            query: {},
            body: {},
            user: { id: 'admin-123', role: UserRole.ADMIN } as any,
        };

        mockRes = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn().mockReturnThis() as any,
        };

        mockNext = jest.fn() as NextFunction;
    });

    describe('getUsers', () => {
        it('should return paginated users', async () => {
            mockReq.query = { page: '1', limit: '10' };
            const mockUsers = [{ id: '1', name: 'User 1' }, { id: '2', name: 'User 2' }];
            (mockEntityManager.findAndCount as jest.Mock<any>).mockResolvedValue([mockUsers, 2]);

            await userController.getUsers(mockReq as Request, mockRes as Response, mockNext);

            expect(response.paginated).toHaveBeenCalledWith(mockRes, mockUsers, expect.objectContaining({ total: 2 }));
        });

        it('should filter users', async () => {
            mockReq.query = { role: UserRole.DEVELOPER };
            (mockEntityManager.findAndCount as jest.Mock<any>).mockResolvedValue([[], 0]);

            await userController.getUsers(mockReq as Request, mockRes as Response, mockNext);

            expect(mockEntityManager.findAndCount).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ role: UserRole.DEVELOPER }),
                expect.anything()
            );
        });
    });

    describe('getUserById', () => {
        it('should return user by id', async () => {
            mockReq.params = { id: 'user-1' };
            const mockUser = { id: 'user-1', name: 'User 1' };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockUser);

            await userController.getUserById(mockReq as any, mockRes as Response, mockNext);

            expect(response.success).toHaveBeenCalledWith(mockRes, mockUser);
        });

        it('should handle not found', async () => {
            mockReq.params = { id: 'non-existent' };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(null);

            await userController.getUserById(mockReq as any, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('updateUser', () => {
        it('should update user fields', async () => {
            mockReq.params = { id: 'user-1' };
            mockReq.body = { name: 'New Name', role: UserRole.MANAGER };
            const mockUser = { id: 'user-1', name: 'Old Name', role: UserRole.DEVELOPER };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockUser);

            await userController.updateUser(mockReq as any, mockRes as Response, mockNext);

            expect(mockUser.name).toBe('New Name');
            expect(mockUser.role).toBe(UserRole.MANAGER);
            expect(mockEntityManager.flush).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalledWith(mockRes, mockUser, expect.any(String));
        });
    });

    describe('deleteUser', () => {
        it('should soft delete user', async () => {
            mockReq.params = { id: 'user-1' };
            const mockUser = { id: 'user-1', isActive: true };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockUser);

            await userController.deleteUser(mockReq as any, mockRes as Response, mockNext);

            expect(mockUser.isActive).toBe(false);
            expect(mockEntityManager.flush).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalled();
        });

        it('should prevent self-deletion', async () => {
            mockReq.params = { id: 'admin-123' };
            mockReq.user = { id: 'admin-123', role: UserRole.ADMIN } as any;

            await userController.deleteUser(mockReq as any, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Cannot delete your own account') }));
        });
    });

    describe('resetPassword', () => {
        it('should reset password', async () => {
            mockReq.params = { id: 'user-1' };
            mockReq.body = { newPassword: 'new-password' };
            const mockUser = { id: 'user-1', passwordHash: 'old-hash' };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockUser);

            await userController.resetPassword(mockReq as any, mockRes as Response, mockNext);

            expect(bcrypt.hash).toHaveBeenCalled();
            expect(mockUser.passwordHash).toBe('hashedPassword'); // as mocked
            expect(mockEntityManager.flush).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalled();
        });
    });
});
