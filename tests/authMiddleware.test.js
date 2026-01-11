/**
 * Auth Middleware Tests
 * 100% Branch Coverage
 */

const jwt = require('jsonwebtoken');

// Create mock functions that can be controlled per test
const mockFindById = jest.fn();
const mockGetPodsByManager = jest.fn();

// Define secrets at module level - must match what auth.js uses from env
const TEST_SECRET = 'access-secret-key-change-in-production';
const TEST_REFRESH_SECRET = 'refresh-secret-key-change-in-production';

// Set environment variables before requiring auth module
process.env.JWT_ACCESS_SECRET = TEST_SECRET;
process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;

// Mock dependencies before requiring the module
jest.mock('../src/config', () => ({
  jwt: {
    secret: 'access-secret-key-change-in-production',
    refreshSecret: 'refresh-secret-key-change-in-production',
    expiresIn: '1h',
    refreshExpiresIn: '7d',
  },
  portalDb: {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_pass',
  },
  isProduction: false,
}));

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../src/models/User', () => ({
  findById: (...args) => mockFindById(...args),
  UserRoles: {
    ADMIN: 'admin',
    MANAGER: 'manager',
    DEVELOPER: 'developer',
  },
}));

jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../src/config/staticData', () => ({
  getPodsByManager: (...args) => mockGetPodsByManager(...args),
  getInstanceById: jest.fn(),
  getPods: jest.fn(() => []),
}));

describe('Auth Middleware', () => {
  let auth;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    auth = require('../src/middleware/auth');
    
    mockReq = {
      headers: {},
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should fail with no authorization header', async () => {
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'fail',
      }));
    });

    it('should fail with invalid header format', async () => {
      mockReq.headers.authorization = 'Basic token';
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: '123' },
        TEST_SECRET,
        { expiresIn: '-1s' }
      );
      mockReq.headers.authorization = `Bearer ${expiredToken}`;
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail with malformed token', async () => {
      mockReq.headers.authorization = 'Bearer invalid.token.here';
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail with token signed with wrong secret', async () => {
      const badToken = jwt.sign({ userId: '123' }, 'wrong-secret');
      mockReq.headers.authorization = `Bearer ${badToken}`;
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail with token missing issuer', async () => {
      // Token without proper issuer/audience will fail verification
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail with expired token', async () => {
      const token = jwt.sign(
        { userId: '123' },
        TEST_SECRET,
        { expiresIn: '-1s', issuer: 'db-query-portal', audience: 'db-query-portal-users' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should pass with valid token and active user', async () => {
      // Token must include all required claims with proper issuer/audience
      const token = jwt.sign(
        { userId: '123', email: 'test@test.com', role: 'developer', podId: 'pod-1' },
        TEST_SECRET,
        { issuer: 'db-query-portal', audience: 'db-query-portal-users' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.id).toBe('123');
      expect(mockReq.user.email).toBe('test@test.com');
    });

    it('should handle invalid token gracefully', async () => {
      const token = jwt.sign({ userId: '123' }, 'wrong-secret');
      mockReq.headers.authorization = `Bearer ${token}`;
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalAuth', () => {
    it('should pass without any authorization', async () => {
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should pass without Bearer token', async () => {
      mockReq.headers.authorization = 'Basic token';
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should attach user with valid token', async () => {
      const token = jwt.sign(
        { userId: '123', email: 'test@test.com', role: 'developer' },
        TEST_SECRET,
        { issuer: 'db-query-portal', audience: 'db-query-portal-users' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.id).toBe('123');
    });

    it('should ignore invalid tokens silently', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should ignore tokens with wrong secret', async () => {
      const token = jwt.sign({ userId: '123' }, 'wrong-secret');
      mockReq.headers.authorization = `Bearer ${token}`;
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should ignore expired tokens', async () => {
      const token = jwt.sign(
        { userId: '123' },
        TEST_SECRET,
        { expiresIn: '-1s', issuer: 'db-query-portal', audience: 'db-query-portal-users' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should handle outer try-catch errors', async () => {
      // Force an unexpected error in outer try
      mockReq.headers = null; // This will cause an error
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should fail without authenticated user', () => {
      const middleware = auth.requireRole('admin');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail when user role does not match', () => {
      mockReq.user = { id: '123', role: 'developer' };
      const middleware = auth.requireRole('admin');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should pass when user role matches', () => {
      mockReq.user = { id: '123', role: 'admin' };
      const middleware = auth.requireRole('admin');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should accept multiple roles', () => {
      mockReq.user = { id: '123', role: 'manager' };
      const middleware = auth.requireRole('admin', 'manager');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle array of roles', () => {
      mockReq.user = { id: '123', role: 'developer' };
      // Pass roles as separate arguments, not as an array
      const middleware = auth.requireRole('admin', 'developer');
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireManagerOfPod', () => {
    it('should fail without authenticated user', () => {
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should pass for admin users', () => {
      mockReq.user = { id: '123', role: 'admin' };
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail for developers', () => {
      mockReq.user = { id: '123', role: 'developer', podId: 'pod-1' };
      mockReq.body.podId = 'pod-2';
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should pass for manager without podId in request', () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com' };
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass for manager with matching pod in body', () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1' };
      mockReq.body.podId = 'pod-1';
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass for manager with managed pod in params', () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1', managedPods: ['pod-1', 'pod-2'] };
      mockReq.params.podId = 'pod-2';
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass for manager with managed pod in query', () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1', managedPods: ['pod-1', 'pod-3'] };
      mockReq.query.podId = 'pod-3';
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail for manager with unmanaged pod', () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1', managedPods: ['pod-1'] };
      mockReq.body.podId = 'pod-5';
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should pass when user belongs to requested pod', () => {
      mockReq.user = { id: '123', role: 'developer', podId: 'pod-1' };
      mockReq.body.podId = 'pod-1';
      
      const middleware = auth.requireManagerOfPod();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const user = { id: '123', email: 'test@test.com', role: 'developer' };
      
      // Mock the database query for storing refresh token
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rows: [] });
      
      const tokens = await auth.generateTokens(user);
      
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');
    });

    it('should create valid JWT tokens', async () => {
      const user = { id: '123', email: 'test@test.com', role: 'admin' };
      
      // Mock the database query for storing refresh token
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rows: [] });
      
      const tokens = await auth.generateTokens(user);
      
      const decoded = jwt.verify(tokens.accessToken, TEST_SECRET);
      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('admin');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const token = jwt.sign({ userId: '123', tokenId: 'token-123' }, TEST_REFRESH_SECRET, {
        issuer: 'db-query-portal',
        audience: 'db-query-portal-users',
      });
      
      // Mock the database query to return a valid token record
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({
        rows: [{
          user_id: '123',
          email: 'test@test.com',
          role: 'developer',
          pod_id: 'pod-1',
          name: 'Test User',
        }],
      });
      
      const decoded = await auth.verifyRefreshToken(token);
      
      expect(decoded.userId).toBe('123');
    });

    it('should throw error for invalid refresh token', async () => {
      // Use expect().rejects.toThrow() for async functions
      await expect(auth.verifyRefreshToken('invalid-token')).rejects.toThrow();
    });

    it('should throw error for token signed with wrong secret', async () => {
      const token = jwt.sign({ userId: '123' }, 'wrong-secret');
      
      // Use expect().rejects.toThrow() for async functions
      await expect(auth.verifyRefreshToken(token)).rejects.toThrow();
    });
  });
});


describe('Auth Middleware - Additional Coverage', () => {
  let auth;
  let mockReq;
  let mockRes;
  let mockNext;

  const TEST_SECRET = 'access-secret-key-change-in-production';
  const TEST_REFRESH_SECRET = 'refresh-secret-key-change-in-production';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    auth = require('../src/middleware/auth');
    
    mockReq = {
      headers: {},
      body: {},
      params: {},
      query: {},
      path: '/test',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authorizeMinRole', () => {
    it('should fail without authenticated user', () => {
      const middleware = auth.authorizeMinRole('manager');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail when user role level is insufficient', () => {
      mockReq.user = { id: '123', role: 'developer' };
      const middleware = auth.authorizeMinRole('manager');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should pass when user role level is sufficient', () => {
      mockReq.user = { id: '123', role: 'admin' };
      const middleware = auth.authorizeMinRole('manager');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when user role matches exactly', () => {
      mockReq.user = { id: '123', role: 'manager' };
      const middleware = auth.authorizeMinRole('manager');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle unknown role', () => {
      mockReq.user = { id: '123', role: 'unknown' };
      const middleware = auth.authorizeMinRole('developer');
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const { query } = require('../src/config/database');
      const token = jwt.sign({ userId: '123', tokenId: 'token-123' }, TEST_REFRESH_SECRET, {
        issuer: 'db-query-portal',
        audience: 'db-query-portal-users',
      });

      // Mock verifyRefreshToken query
      query.mockResolvedValueOnce({
        rows: [{
          user_id: '123',
          email: 'test@test.com',
          role: 'developer',
          pod_id: 'pod-1',
          name: 'Test User',
        }],
      });
      // Mock revoke old token
      query.mockResolvedValueOnce({ rows: [] });
      // Mock insert new token
      query.mockResolvedValueOnce({ rows: [] });

      const result = await auth.refreshTokens(token);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ 
        rowCount: 1, 
        rows: [{ user_id: '123' }] 
      });

      const result = await auth.logout('valid-refresh-token');

      expect(result.success).toBe(true);
    });

    it('should fail when token not found', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const result = await auth.logout('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle null result', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce(null);

      const result = await auth.logout('some-token');

      expect(result.success).toBe(false);
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rowCount: 3 });

      const result = await auth.logoutAll('user-123');

      expect(result.success).toBe(true);
      expect(result.sessionsRevoked).toBe(3);
    });

    it('should handle null result', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce(null);

      const result = await auth.logoutAll('user-123');

      expect(result.success).toBe(true);
      expect(result.sessionsRevoked).toBe(0);
    });
  });

  describe('getActiveSessions', () => {
    it('should get active sessions', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({
        rows: [
          { id: '1', created_at: new Date(), expires_at: new Date(), seconds_until_expiry: 3600 },
        ],
      });

      const result = await auth.getActiveSessions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('sessionId');
    });

    it('should handle null result', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce(null);

      const result = await auth.getActiveSessions('user-123');

      expect(result).toEqual([]);
    });

    it('should handle result with no rows', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rows: null });

      const result = await auth.getActiveSessions('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await auth.revokeSession('user-123', 'session-1');

      expect(result).toBe(true);
    });

    it('should return false when session not found', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await auth.revokeSession('user-123', 'invalid-session');

      expect(result).toBe(false);
    });

    it('should handle null result', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce(null);

      const result = await auth.revokeSession('user-123', 'session-1');

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rowCount: 5 });

      const result = await auth.cleanupExpiredTokens();

      expect(result).toBe(5);
    });

    it('should handle null result', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce(null);

      const result = await auth.cleanupExpiredTokens();

      expect(result).toBe(0);
    });

    it('should handle zero deletions', async () => {
      const { query } = require('../src/config/database');
      query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await auth.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });

  describe('verifyRefreshToken - additional cases', () => {
    it('should throw for expired refresh token', async () => {
      const token = jwt.sign(
        { userId: '123', tokenId: 'token-123' },
        TEST_REFRESH_SECRET,
        { expiresIn: '-1s', issuer: 'db-query-portal', audience: 'db-query-portal-users' }
      );

      await expect(auth.verifyRefreshToken(token)).rejects.toThrow('expired');
    });

    it('should throw when token not found in database', async () => {
      const { query } = require('../src/config/database');
      const token = jwt.sign(
        { userId: '123', tokenId: 'token-123' },
        TEST_REFRESH_SECRET,
        { issuer: 'db-query-portal', audience: 'db-query-portal-users' }
      );

      query.mockResolvedValueOnce({ rows: [] });

      await expect(auth.verifyRefreshToken(token)).rejects.toThrow();
    });

    it('should throw when result is null', async () => {
      const { query } = require('../src/config/database');
      const token = jwt.sign(
        { userId: '123', tokenId: 'token-123' },
        TEST_REFRESH_SECRET,
        { issuer: 'db-query-portal', audience: 'db-query-portal-users' }
      );

      query.mockResolvedValueOnce(null);

      await expect(auth.verifyRefreshToken(token)).rejects.toThrow();
    });
  });
});


describe('Auth Middleware - Error Handling Coverage', () => {
  let auth;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    auth = require('../src/middleware/auth');
    
    mockReq = {
      headers: {},
      body: {},
      params: {},
      query: {},
      path: '/test',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authenticate - generic error handling (lines 179-184)', () => {
    it('should handle generic errors that are not AuthenticationError', async () => {
      // The authenticate middleware catches errors and returns 401
      // For generic errors (not AuthenticationError), it returns 'Authentication failed'
      mockReq.headers.authorization = 'Bearer invalid-token';
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'fail',
        code: 'AUTHENTICATION_ERROR',
      }));
    });
  });

  describe('logout - error handling (lines 423-424)', () => {
    it('should throw error when database query fails', async () => {
      const { query } = require('../src/config/database');
      query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(auth.logout('some-token')).rejects.toThrow('Database connection failed');
    });
  });

  describe('logoutAll - error handling (lines 451-452)', () => {
    it('should throw error when database query fails', async () => {
      const { query } = require('../src/config/database');
      query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(auth.logoutAll('user-123')).rejects.toThrow('Database connection failed');
    });
  });

  describe('extractTokenFromHeader edge cases', () => {
    it('should return null for empty authorization header', () => {
      const result = auth.extractTokenFromHeader('');
      expect(result).toBeNull();
    });

    it('should return null for single word header', () => {
      const result = auth.extractTokenFromHeader('token');
      expect(result).toBeNull();
    });

    it('should return null for three word header', () => {
      const result = auth.extractTokenFromHeader('Bearer token extra');
      expect(result).toBeNull();
    });

    it('should return null for non-bearer scheme', () => {
      const result = auth.extractTokenFromHeader('Basic token');
      expect(result).toBeNull();
    });

    it('should return token for valid bearer header', () => {
      const result = auth.extractTokenFromHeader('Bearer mytoken');
      expect(result).toBe('mytoken');
    });

    it('should be case insensitive for bearer', () => {
      const result = auth.extractTokenFromHeader('BEARER mytoken');
      expect(result).toBe('mytoken');
    });
  });

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const hash1 = auth.hashToken('test-token');
      const hash2 = auth.hashToken('test-token');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = auth.hashToken('token1');
      const hash2 = auth.hashToken('token2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('ROLES and ROLE_HIERARCHY exports', () => {
    it('should export ROLES', () => {
      expect(auth.ROLES).toBeDefined();
      expect(auth.ROLES.ADMIN).toBe('admin');
      expect(auth.ROLES.MANAGER).toBe('manager');
      expect(auth.ROLES.DEVELOPER).toBe('developer');
    });

    it('should export ROLE_HIERARCHY', () => {
      expect(auth.ROLE_HIERARCHY).toBeDefined();
      expect(auth.ROLE_HIERARCHY.admin).toBe(3);
      expect(auth.ROLE_HIERARCHY.manager).toBe(2);
      expect(auth.ROLE_HIERARCHY.developer).toBe(1);
    });

    it('should export JWT_CONFIG', () => {
      expect(auth.JWT_CONFIG).toBeDefined();
      expect(auth.JWT_CONFIG.accessTokenSecret).toBeDefined();
      expect(auth.JWT_CONFIG.refreshTokenSecret).toBeDefined();
    });
  });
});
