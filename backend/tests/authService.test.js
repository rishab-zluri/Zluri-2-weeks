/**
 * Auth Service Tests
 * 100% Branch Coverage
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock database
jest.mock('../src/config/database', () => ({
  portalQuery: jest.fn(),
  query: jest.fn(),
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { portalQuery } = require('../src/config/database');
const authService = require('../src/services/authService');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = { id: '1', email: 'test@test.com', is_active: true };
      portalQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await authService.findUserByEmail('test@test.com');

      expect(result).toEqual(mockUser);
      expect(portalQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        ['test@test.com']
      );
    });

    it('should return null when user not found', async () => {
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.findUserByEmail('notfound@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('should find user by ID', async () => {
      const mockUser = { id: '1', email: 'test@test.com' };
      portalQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await authService.findUserById('1');

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.findUserById('999');

      expect(result).toBeNull();
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const result = await authService.verifyPassword('password123', hash);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const result = await authService.verifyPassword('wrongpassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password', async () => {
      const hash = await authService.hashPassword('password123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('password123');
      
      // Verify the hash works
      const isValid = await bcrypt.compare('password123', hash);
      expect(isValid).toBe(true);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'developer',
        pod_id: 'pod-1',
        password_hash: passwordHash,
        is_active: true,
      };

      portalQuery
        .mockResolvedValueOnce({ rows: [mockUser] }) // findUserByEmail
        .mockResolvedValueOnce({ rows: [] }) // insert refresh token
        .mockResolvedValueOnce({ rows: [] }); // update last login

      const result = await authService.login('test@test.com', 'password123', 'Chrome', '127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@test.com');
    });

    it('should fail when user not found', async () => {
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.login('notfound@test.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail when user is inactive', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        is_active: false,
      };
      portalQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await authService.login('test@test.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should fail with invalid password', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        password_hash: passwordHash,
        is_active: true,
      };
      portalQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await authService.login('test@test.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should login without device info', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        role: 'developer',
        pod_id: null,
        password_hash: passwordHash,
        is_active: true,
      };

      portalQuery
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await authService.login('test@test.com', 'password123');

      expect(result.success).toBe(true);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      portalQuery.mockResolvedValueOnce({ 
        rowCount: 1, 
        rows: [{ user_id: '1' }] 
      });

      const result = await authService.logout('valid-refresh-token');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');
    });

    it('should fail without refresh token', async () => {
      const result = await authService.logout(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh token required');
    });

    it('should fail with invalid token', async () => {
      portalQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const result = await authService.logout('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      portalQuery.mockResolvedValueOnce({ 
        rowCount: 3, 
        rows: [{ id: '1' }, { id: '2' }, { id: '3' }] 
      });

      const result = await authService.logoutAll('user-1');

      expect(result.success).toBe(true);
      expect(result.sessionsRevoked).toBe(3);
    });

    it('should handle no active sessions', async () => {
      portalQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const result = await authService.logoutAll('user-1');

      expect(result.success).toBe(true);
      expect(result.sessionsRevoked).toBe(0);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockTokenData = {
        user_id: '1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'developer',
        pod_id: 'pod-1',
        is_active: true,
      };
      portalQuery.mockResolvedValueOnce({ rows: [mockTokenData] });

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
    });

    it('should fail without refresh token', async () => {
      const result = await authService.refreshAccessToken(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh token required');
    });

    it('should fail with invalid token', async () => {
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.refreshAccessToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired refresh token');
    });

    it('should fail when user is disabled', async () => {
      const mockTokenData = {
        user_id: '1',
        email: 'test@test.com',
        is_active: false,
      };
      portalQuery
        .mockResolvedValueOnce({ rows: [mockTokenData] })
        .mockResolvedValueOnce({ rows: [] }); // revoke token

      const result = await authService.refreshAccessToken('valid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = jwt.sign(
        { userId: '1', email: 'test@test.com', type: 'access' },
        authService.AUTH_CONFIG.accessToken.secret,
        { expiresIn: '30m' }
      );

      const result = authService.verifyAccessToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload.userId).toBe('1');
    });

    it('should reject expired token', () => {
      const token = jwt.sign(
        { userId: '1', type: 'access' },
        authService.AUTH_CONFIG.accessToken.secret,
        { expiresIn: '-1s' }
      );

      const result = authService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.expired).toBe(true);
    });

    it('should reject invalid token', () => {
      const result = authService.verifyAccessToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject token with wrong type', () => {
      const token = jwt.sign(
        { userId: '1', type: 'refresh' },
        authService.AUTH_CONFIG.accessToken.secret,
        { expiresIn: '30m' }
      );

      const result = authService.verifyAccessToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token type');
    });
  });

  describe('getActiveSessions', () => {
    it('should get active sessions', async () => {
      const mockSessions = [
        { id: '1', device_info: 'Chrome', ip_address: '127.0.0.1' },
        { id: '2', device_info: 'Firefox', ip_address: '127.0.0.2' },
      ];
      portalQuery.mockResolvedValueOnce({ rows: mockSessions });

      const result = await authService.getActiveSessions('user-1');

      expect(result).toEqual(mockSessions);
    });

    it('should return empty array when no sessions', async () => {
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await authService.getActiveSessions('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      portalQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await authService.revokeSession('user-1', 'session-1');

      expect(result).toBe(true);
    });

    it('should return false when session not found', async () => {
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await authService.revokeSession('user-1', 'invalid-session');

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      portalQuery.mockResolvedValueOnce({ rowCount: 5 });

      const result = await authService.cleanupExpiredTokens();

      expect(result).toBe(5);
    });

    it('should handle no tokens to cleanup', async () => {
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await authService.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });

  describe('AUTH_CONFIG', () => {
    it('should export AUTH_CONFIG', () => {
      expect(authService.AUTH_CONFIG).toBeDefined();
      expect(authService.AUTH_CONFIG.accessToken).toBeDefined();
      expect(authService.AUTH_CONFIG.refreshToken).toBeDefined();
    });
  });
});
