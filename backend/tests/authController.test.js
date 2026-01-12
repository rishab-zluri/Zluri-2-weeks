/**
 * Auth Controller Tests
 * Tests for authentication endpoints
 */

// Mock dependencies
jest.mock('../src/models/User');
jest.mock('../src/middleware/auth', () => ({
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresIn: '15m',
  }),
  verifyRefreshToken: jest.fn().mockResolvedValue({ userId: 'user-123' }),
  logout: jest.fn().mockResolvedValue({ success: true }),
  logoutAll: jest.fn().mockResolvedValue({ success: true, sessionsRevoked: 1 }),
  blacklistAccessToken: jest.fn().mockResolvedValue(),
  getActiveSessions: jest.fn().mockResolvedValue([]),
  revokeSession: jest.fn().mockResolvedValue(true),
}));

const User = require('../src/models/User');
const { generateTokens, verifyRefreshToken, logout, logoutAll, blacklistAccessToken, getActiveSessions, revokeSession } = require('../src/middleware/auth');
const authController = require('../src/controllers/authController');

describe('Auth Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks to default resolved values
    generateTokens.mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: '15m',
    });
    verifyRefreshToken.mockResolvedValue({ userId: 'user-123' });
    logout.mockResolvedValue({ success: true });
    logoutAll.mockResolvedValue({ success: true, sessionsRevoked: 1, message: 'Logged out from all devices' });
    
    mockReq = {
      body: {},
      user: null,
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
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

      verifyRefreshToken.mockResolvedValueOnce({ userId: 'user-123' });
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

      verifyRefreshToken.mockResolvedValueOnce({ userId: 'nonexistent' });
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

      verifyRefreshToken.mockResolvedValueOnce({ userId: 'user-123' });
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

      verifyRefreshToken.mockRejectedValueOnce(new Error('Invalid token'));

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
          message: expect.stringContaining('Password changed successfully'),
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

describe('Auth Controller - Additional Coverage', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      body: {},
      user: null,
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('register - error handling', () => {
    it('should handle registration error', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Test@123',
        name: 'Test User',
      };

      User.findByEmail.mockRejectedValueOnce(new Error('Database error'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle missing connection remoteAddress', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Test@123',
        name: 'Test User',
      };
      mockReq.ip = null;
      mockReq.connection = null;

      User.findByEmail.mockResolvedValueOnce(null);
      User.create.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
      });
      User.UserRoles = { DEVELOPER: 'developer' };
      User.updateLastLogin.mockResolvedValueOnce();

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('login - validation', () => {
    it('should return error when email is missing', async () => {
      mockReq.body = { password: 'Test@123' };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('should return error when password is missing', async () => {
      mockReq.body = { email: 'test@example.com' };

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle login error', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Test@123',
      };

      User.findByEmail.mockRejectedValueOnce(new Error('Database error'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle missing connection info', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Test@123',
      };
      mockReq.ip = null;
      mockReq.connection = null;

      User.findByEmail.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        passwordHash: 'hash',
      });
      User.verifyPassword.mockResolvedValueOnce(true);
      User.updateLastLogin.mockResolvedValueOnce();

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('refreshToken - validation', () => {
    it('should return error when refresh token is missing', async () => {
      mockReq.body = {};

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('should handle AuthenticationError', async () => {
      const { AuthenticationError } = require('../src/utils/errors');
      mockReq.body = { refreshToken: 'invalid-token' };

      verifyRefreshToken.mockRejectedValueOnce(new AuthenticationError('Token expired'));

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Token expired',
        })
      );
    });
  });

  describe('getProfile - error handling', () => {
    it('should handle error', async () => {
      mockReq.user = null; // This will cause an error

      await authController.getProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateProfile - error handling', () => {
    it('should handle update error', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { name: 'New Name' };

      User.update.mockRejectedValueOnce(new Error('Database error'));

      await authController.updateProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle empty updates', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = {};

      User.update.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test',
        role: 'developer',
      });

      await authController.updateProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('changePassword - validation', () => {
    it('should return error when currentPassword is missing', async () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };
      mockReq.body = { newPassword: 'NewPassword@123' };

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('should return error when newPassword is missing', async () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };
      mockReq.body = { currentPassword: 'OldPassword@123' };

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return error when newPassword is too short', async () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };
      mockReq.body = { currentPassword: 'OldPassword@123', newPassword: 'short' };

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('8 characters'),
        })
      );
    });

    it('should handle change password error', async () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };
      mockReq.body = {
        currentPassword: 'OldPassword@123',
        newPassword: 'NewPassword@123',
      };

      User.findByEmail.mockRejectedValueOnce(new Error('Database error'));

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('logout - edge cases', () => {
    it('should handle logout without refresh token', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = {};

      await authController.logout(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logged out successfully',
        })
      );
    });

    it('should blacklist access token when no refresh token but access token exists', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.accessToken = 'valid-access-token';
      mockReq.body = {};

      await authController.logout(mockReq, mockRes);

      expect(blacklistAccessToken).toHaveBeenCalledWith('valid-access-token', 'user-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle logout with refresh token', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { refreshToken: 'valid-token' };

      logout.mockResolvedValueOnce({ success: true });

      await authController.logout(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle logout when token revocation fails', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { refreshToken: 'invalid-token' };

      logout.mockResolvedValueOnce({ success: false, error: 'Token not found' });

      await authController.logout(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle logout error gracefully', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { refreshToken: 'token' };

      logout.mockRejectedValueOnce(new Error('Database error'));

      await authController.logout(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      mockReq.user = { id: 'user-123' };

      logoutAll.mockResolvedValueOnce({ 
        success: true, 
        sessionsRevoked: 3,
        message: 'Logged out from all devices',
      });

      await authController.logoutAll(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionsRevoked: 3,
          }),
        })
      );
    });

    it('should handle logoutAll error', async () => {
      mockReq.user = { id: 'user-123' };

      logoutAll.mockRejectedValueOnce(new Error('Database error'));

      await authController.logoutAll(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSessions', () => {
    const auth = require('../src/middleware/auth');
    
    it('should get active sessions', async () => {
      mockReq.user = { id: 'user-123' };

      auth.getActiveSessions = jest.fn().mockResolvedValueOnce([
        { sessionId: '1', createdAt: new Date() },
        { sessionId: '2', createdAt: new Date() },
      ]);

      await authController.getSessions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            count: 2,
          }),
        })
      );
    });

    it('should handle getSessions error', async () => {
      mockReq.user = { id: 'user-123' };

      auth.getActiveSessions = jest.fn().mockRejectedValueOnce(new Error('Database error'));

      await authController.getSessions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('revokeSession', () => {
    const auth = require('../src/middleware/auth');
    
    it('should revoke session successfully', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { sessionId: 'session-1' };

      auth.revokeSession = jest.fn().mockResolvedValueOnce(true);

      await authController.revokeSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when session not found', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { sessionId: 'invalid-session' };

      auth.revokeSession = jest.fn().mockResolvedValueOnce(false);

      await authController.revokeSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle revokeSession error', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { sessionId: 'session-1' };

      auth.revokeSession = jest.fn().mockRejectedValueOnce(new Error('Database error'));

      await authController.revokeSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
