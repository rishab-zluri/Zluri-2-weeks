/**
 * Auth Middleware Tests
 * 100% Branch Coverage
 */

const jwt = require('jsonwebtoken');

// Create mock functions that can be controlled per test
const mockFindById = jest.fn();
const mockGetPodsByManager = jest.fn();

// Define secrets at module level
const TEST_SECRET = 'test-secret-key-for-testing-purposes-only';
const TEST_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';

// Mock dependencies before requiring the module
jest.mock('../src/config', () => ({
  jwt: {
    secret: 'test-secret-key-for-testing-purposes-only',
    refreshSecret: 'test-refresh-secret-key-for-testing',
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
        success: false,
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

    it('should fail when user not found', async () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      mockFindById.mockResolvedValue(null);
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should fail when account is deactivated', async () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      mockFindById.mockResolvedValue({ id: '123', isActive: false });
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should pass with valid token and active user', async () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      const mockUser = { id: '123', email: 'test@test.com', isActive: true };
      mockFindById.mockResolvedValue(mockUser);
      
      await auth.authenticate(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.token).toBe(token);
    });

    it('should handle database errors gracefully', async () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      mockFindById.mockRejectedValue(new Error('DB error'));
      
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
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      const mockUser = { id: '123', isActive: true };
      mockFindById.mockResolvedValue(mockUser);
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual(mockUser);
    });

    it('should ignore invalid tokens silently', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should ignore user not found', async () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      mockFindById.mockResolvedValue(null);
      
      await auth.optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should ignore inactive user', async () => {
      const token = jwt.sign({ userId: '123' }, TEST_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;
      mockFindById.mockResolvedValue({ id: '123', isActive: false });
      
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
      const middleware = auth.requireRole(['admin', 'developer']);
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireManagerOfPod', () => {
    it('should fail without authenticated user', async () => {
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should pass for admin users', async () => {
      mockReq.user = { id: '123', role: 'admin' };
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail for developers', async () => {
      mockReq.user = { id: '123', role: 'developer' };
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should pass for manager without podId in request', async () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com' };
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass for manager with matching pod in body', async () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1' };
      mockReq.body.podId = 'pod-1';
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass for manager with managed pod in params', async () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1' };
      mockReq.params.podId = 'pod-2';
      mockGetPodsByManager.mockReturnValue([{ id: 'pod-1' }, { id: 'pod-2' }]);
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass for manager with managed pod in query', async () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1' };
      mockReq.query.podId = 'pod-3';
      mockGetPodsByManager.mockReturnValue([{ id: 'pod-1' }, { id: 'pod-3' }]);
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail for manager with unmanaged pod', async () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1' };
      mockReq.body.podId = 'pod-5';
      mockGetPodsByManager.mockReturnValue([{ id: 'pod-1' }]);
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle errors gracefully', async () => {
      mockReq.user = { id: '123', role: 'manager', email: 'manager@test.com', podId: 'pod-1' };
      mockReq.body.podId = 'pod-2';
      mockGetPodsByManager.mockImplementation(() => {
        throw new Error('DB error');
      });
      
      await auth.requireManagerOfPod(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const user = { id: '123', email: 'test@test.com', role: 'developer' };
      
      const tokens = auth.generateTokens(user);
      
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresAt');
      expect(tokens.tokenType).toBe('Bearer');
    });

    it('should create valid JWT tokens', () => {
      const user = { id: '123', email: 'test@test.com', role: 'admin' };
      
      const tokens = auth.generateTokens(user);
      
      const decoded = jwt.verify(tokens.accessToken, TEST_SECRET);
      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('admin');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = jwt.sign({ userId: '123' }, TEST_REFRESH_SECRET);
      
      const decoded = auth.verifyRefreshToken(token);
      
      expect(decoded.userId).toBe('123');
    });

    it('should throw error for invalid refresh token', () => {
      // Use expect().toThrow() with a function wrapper
      expect(() => {
        auth.verifyRefreshToken('invalid-token');
      }).toThrow();
    });

    it('should throw error for token signed with wrong secret', () => {
      const token = jwt.sign({ userId: '123' }, 'wrong-secret');
      
      // Use expect().toThrow() with a function wrapper
      expect(() => {
        auth.verifyRefreshToken(token);
      }).toThrow();
    });
  });
});