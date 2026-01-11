/**
 * Auth Controller Tests
 * Tests for authentication endpoints
 */

// Mock dependencies
jest.mock('../src/models/User');
jest.mock('../src/middleware/auth', () => ({
  generateTokens: jest.fn().mockReturnValue({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(),
    tokenType: 'Bearer',
  }),
  verifyRefreshToken: jest.fn(),
}));

const User = require('../src/models/User');
const { generateTokens, verifyRefreshToken } = require('../src/middleware/auth');
const authController = require('../src/controllers/authController');

describe('Auth Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      user: null,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Test@123',
        name: 'Test User',
        podId: 'pod-1',
      };
      mockReq.body = userData;

      User.findByEmail.mockResolvedValueOnce(null);
      User.create.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
        podId: 'pod-1',
      });
      User.UserRoles = { DEVELOPER: 'developer' };
      User.updateLastLogin.mockResolvedValueOnce();

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              email: 'test@example.com',
            }),
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

      User.findByEmail.mockResolvedValueOnce({
        id: 'existing-user',
        email: 'existing@example.com',
      });

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'CONFLICT',
        })
      );
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Test@123',
      };

      User.findByEmail.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
        podId: 'pod-1',
        slackUserId: null,
        isActive: true,
        passwordHash: 'hashed_password',
      });
      User.verifyPassword.mockResolvedValueOnce(true);
      User.updateLastLogin.mockResolvedValueOnce();

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              email: 'test@example.com',
            }),
            accessToken: 'test-access-token',
          }),
        })
      );
    });

    it('should return error for non-existent user', async () => {
      mockReq.body = {
        email: 'nonexistent@example.com',
        password: 'Test@123',
      };

      User.findByEmail.mockResolvedValueOnce(null);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_CREDENTIALS',
        })
      );
    });

    it('should return error for deactivated account', async () => {
      mockReq.body = {
        email: 'deactivated@example.com',
        password: 'Test@123',
      };

      User.findByEmail.mockResolvedValueOnce({
        id: 'user-123',
        email: 'deactivated@example.com',
        isActive: false,
        passwordHash: 'hashed_password',
      });

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
        })
      );
    });

    it('should return error for wrong password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      User.findByEmail.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        passwordHash: 'hashed_password',
      });
      User.verifyPassword.mockResolvedValueOnce(false);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_CREDENTIALS',
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockReq.body = {
        refreshToken: 'valid-refresh-token',
      };

      verifyRefreshToken.mockReturnValueOnce({ userId: 'user-123' });
      User.findById.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
      });

      await authController.refreshToken(mockReq, mockRes);

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

    it('should return error for non-existent user', async () => {
      mockReq.body = {
        refreshToken: 'valid-refresh-token',
      };

      verifyRefreshToken.mockReturnValueOnce({ userId: 'nonexistent' });
      User.findById.mockResolvedValueOnce(null);

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'USER_NOT_FOUND',
        })
      );
    });

    it('should return error for deactivated user', async () => {
      mockReq.body = {
        refreshToken: 'valid-refresh-token',
      };

      verifyRefreshToken.mockReturnValueOnce({ userId: 'user-123' });
      User.findById.mockResolvedValueOnce({
        id: 'user-123',
        isActive: false,
      });

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
        })
      );
    });

    it('should return error for invalid refresh token', async () => {
      mockReq.body = {
        refreshToken: 'invalid-token',
      };

      verifyRefreshToken.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_TOKEN',
        })
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
        podId: 'pod-1',
        slackUserId: null,
        lastLogin: new Date(),
        createdAt: new Date(),
      };

      await authController.getProfile(mockReq, mockRes);

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

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { name: 'Updated Name', slackUserId: 'U12345' };

      User.update.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        role: 'developer',
        podId: 'pod-1',
        slackUserId: 'U12345',
      });

      await authController.updateProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: 'Updated Name',
          }),
        })
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };
      mockReq.body = {
        currentPassword: 'OldPassword@123',
        newPassword: 'NewPassword@123',
      };

      User.findByEmail.mockResolvedValueOnce({
        id: 'user-123',
        passwordHash: 'old_hash',
      });
      User.verifyPassword.mockResolvedValueOnce(true);
      User.updatePassword.mockResolvedValueOnce(true);

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully',
        })
      );
    });

    it('should return error for incorrect current password', async () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };
      mockReq.body = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword@123',
      };

      User.findByEmail.mockResolvedValueOnce({
        id: 'user-123',
        passwordHash: 'hash',
      });
      User.verifyPassword.mockResolvedValueOnce(false);

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_PASSWORD',
        })
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockReq.user = { id: 'user-123' };

      await authController.logout(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully',
        })
      );
    });
  });
});
