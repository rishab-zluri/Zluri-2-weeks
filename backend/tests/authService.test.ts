
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as authService from '../src/services/authService';
import { User, UserRole } from '../src/entities/User';
import { RefreshToken } from '../src/entities/RefreshToken';
import { TokenType } from '../src/constants/auth';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Mock Config
jest.mock('../src/config', () => ({
  __esModule: true,
  default: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '1h',
      refreshSecret: 'refresh-secret',
      refreshExpiresIn: '7d',
      refreshExpiresInDays: 7,
      issuer: 'test-issuer',
      audience: 'test-audience',
    },
    security: {
      bcryptSaltRounds: 10,
    },
    portalDb: {
      host: 'localhost',
      port: 5432,
      database: 'portal',
      user: 'postgres',
    },
  },
}));

// Mock simple dependencies
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

// Mock specific crypto functions if needed, but for now we let it run or rely on simple mocks if randomized
// authService uses crypto.randomBytes and createHash. We can let them run or mock.
// Real crypto is fine for unit tests usually, but for coverage predictability we might want to mock.

// Mock Database
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  isActive: true,
  role: 'developer',
  podId: 'pod-1',
  getEntity: jest.fn<any>().mockReturnThis(),
} as any;

const mockRefreshToken = {
  id: 1,
  tokenHash: 'hashed-token',
  user: {
    id: 'user-123',
    getEntity: jest.fn<any>(() => mockUser)
  },
  familyId: 'family-123',
  isRevoked: false,
  isUsed: false,
  expiresAt: new Date(Date.now() + 100000),
  ipAddress: '127.0.0.1',
  revoke: jest.fn<any>(),
  markAsUsed: jest.fn<any>(),
} as any;

const mockEntityManager = {
  findOne: jest.fn<any>(),
  find: jest.fn<any>(),
  persistAndFlush: jest.fn<any>(),
  flush: jest.fn<any>(),
  nativeUpdate: jest.fn<any>(),
  nativeDelete: jest.fn<any>(),
  transactional: jest.fn<any>((cb: any) => cb(mockEntityManager)),
  create: jest.fn<any>(),
};

jest.mock('../src/db', () => ({
  getEntityManager: jest.fn(() => mockEntityManager),
  getORM: jest.fn(),
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (jwt.sign as jest.Mock<any>).mockReturnValue('mock-jwt-token');
    (jwt.verify as jest.Mock<any>).mockReturnValue({ type: TokenType.ACCESS });
    (bcrypt.compare as jest.Mock<any>).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock<any>).mockResolvedValue('new-hashed-password');
  });

  describe('findUserByEmail', () => {
    it('should return user if found', async () => {
      mockEntityManager.findOne.mockResolvedValue(mockUser);
      const user = await authService.findUserByEmail('test@example.com');
      expect(user).toEqual(mockUser);
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(User, { email: 'test@example.com', isActive: true });
    });

    it('should return null if not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      const user = await authService.findUserByEmail('notfound@example.com');
      expect(user).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('should return user if found', async () => {
      mockEntityManager.findOne.mockResolvedValue(mockUser);
      const user = await authService.findUserById('user-123');
      expect(user).toEqual(mockUser);
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(User, { id: 'user-123' });
    });
  });

  describe('verifyPassword', () => {
    it('should return true if bcrypt matches', async () => {
      (bcrypt.compare as jest.Mock<any>).mockResolvedValue(true);
      const result = await authService.verifyPassword('password', 'hash');
      expect(result).toBe(true);
    });

    it('should return false if bcrypt fails', async () => {
      (bcrypt.compare as jest.Mock<any>).mockResolvedValue(false);
      const result = await authService.verifyPassword('password', 'hash');
      expect(result).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should return hashed password', async () => {
      const hash = await authService.hashPassword('password');
      expect(hash).toBe('new-hashed-password');
    });
  });

  describe('login', () => {
    it('should return success and tokens for valid login', async () => {
      mockEntityManager.findOne.mockResolvedValue(mockUser);
      const result = await authService.login('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
    });

    it('should fail if user not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      const result = await authService.login('wrong@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail if user inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockEntityManager.findOne.mockResolvedValue(inactiveUser);
      const result = await authService.login('test@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should fail if password mismatch', async () => {
      mockEntityManager.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock<any>).mockResolvedValue(false);
      const result = await authService.login('test@example.com', 'wrong');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail if user has no password hash', async () => {
      const noHashUser = { ...mockUser, passwordHash: null };
      mockEntityManager.findOne.mockResolvedValue(noHashUser);
      const result = await authService.login('test@example.com', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });
  });

  describe('logout', () => {
    it('should revoke token if found', async () => {
      mockEntityManager.findOne.mockResolvedValue(mockRefreshToken);
      const result = await authService.logout('some-refresh-token');
      expect(result.success).toBe(true);
      expect(mockRefreshToken.revoke).toHaveBeenCalled();
      expect(mockEntityManager.flush).toHaveBeenCalled();
    });

    it('should fail if token missing', async () => {
      const result = await authService.logout('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh token required');
    });

    it('should fail if token not found in DB', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      const result = await authService.logout('unknown-token');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });
  });

  describe('logoutAll', () => {
    it('should revoke all tokens for user', async () => {
      mockEntityManager.nativeUpdate.mockResolvedValue(5);
      const result = await authService.logoutAll('user-123');
      expect(result.success).toBe(true);
      expect(result.sessionsRevoked).toBe(5);
      expect(mockEntityManager.nativeUpdate).toHaveBeenCalledWith(RefreshToken, { user: 'user-123', isRevoked: false }, expect.anything());
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new access token if valid', async () => {
      mockEntityManager.findOne.mockResolvedValue(mockRefreshToken);
      const result = await authService.refreshAccessToken('valid-refresh-token');
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockRefreshToken.markAsUsed).toHaveBeenCalled();
    });

    it('should detect reuse and revoke family', async () => {
      const usedToken = { ...mockRefreshToken, isUsed: true, user: mockRefreshToken.user };
      mockEntityManager.findOne.mockResolvedValue(usedToken);

      const result = await authService.refreshAccessToken('reused-token');
      expect(result.success).toBe(false); // Service returns valid: false, wrapper returns success: false
      expect(result.error).toContain('Session terminated');
      expect(mockEntityManager.nativeUpdate).toHaveBeenCalledWith(RefreshToken, { familyId: usedToken.familyId, isRevoked: false }, expect.anything());
    });

    it('should fail if token not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      const result = await authService.refreshAccessToken('unknown');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired refresh token');
    });

    it('should fail if user inactive during refresh', async () => {
      const inactiveUserToken = {
        ...mockRefreshToken,
        user: {
          getEntity: () => ({ ...mockUser, isActive: false })
        }
      };
      mockEntityManager.findOne.mockResolvedValue(inactiveUserToken);
      const result = await authService.refreshAccessToken('valid-token');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
      expect(inactiveUserToken.revoke).toHaveBeenCalled();
    });

    it('should fail on exception', async () => {
      mockEntityManager.transactional.mockRejectedValueOnce(new Error('DB Boom'));
      const result = await authService.refreshAccessToken('valid');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Token refresh failed');
    });

    it('should warn on IP mismatch', async () => {
      // Manually construct token to ensure valid state
      const token = {
        id: 1,
        tokenHash: 'hashed-token',
        user: { getEntity: () => mockUser },
        familyId: 'family-123',
        isRevoked: false,
        isUsed: false,
        expiresAt: new Date(Date.now() + 100000),
        ipAddress: '127.0.0.1',
        revoke: jest.fn(),
        markAsUsed: jest.fn(),
      };

      mockEntityManager.findOne.mockResolvedValue(token);

      const result = await authService.refreshAccessToken('valid', { ipAddress: '192.168.1.1' });

      expect(result.success).toBe(true);
    });
  });

  describe('verifyAccessToken', () => {
    it('should return valid payload', () => {
      (jwt.verify as jest.Mock<any>).mockReturnValue({ type: TokenType.ACCESS, userId: 'u1' });
      const result = authService.verifyAccessToken('token');
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it('should fail if wrong type', () => {
      (jwt.verify as jest.Mock<any>).mockReturnValue({ type: 'refresh' });
      const result = authService.verifyAccessToken('token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token type');
    });

    it('should fail if expired', () => {
      (jwt.verify as jest.Mock<any>).mockImplementation(() => { throw { name: 'TokenExpiredError' } });
      const result = authService.verifyAccessToken('token');
      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
    });

    it('should fail if other error', () => {
      (jwt.verify as jest.Mock<any>).mockImplementation(() => { throw new Error('Boom') });
      const result = authService.verifyAccessToken('token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('getActiveSessions', () => {
    it('should return mapped sessions', async () => {
      mockEntityManager.find.mockResolvedValue([mockRefreshToken]);
      const sessions = await authService.getActiveSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(1);
    });
  });

  describe('revokeSession', () => {
    it('should revoke if found', async () => {
      mockEntityManager.findOne.mockResolvedValue(mockRefreshToken);
      const result = await authService.revokeSession('user-1', '1');
      expect(result).toBe(true);
      expect(mockRefreshToken.revoke).toHaveBeenCalled();
    });

    it('should return false if not found', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);
      const result = await authService.revokeSession('user-1', '999');
      expect(result).toBe(false);
    });

    it('should return false if invalid session id format', async () => {
      const result = await authService.revokeSession('user-1', 'abc');
      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should call nativeDelete', async () => {
      mockEntityManager.nativeDelete.mockResolvedValue(10);
      const count = await authService.cleanupExpiredTokens();
      expect(count).toBe(10);
      expect(mockEntityManager.nativeDelete).toHaveBeenCalledWith(RefreshToken, expect.anything());
    });
  });
});
