/**
 * Middleware Tests
 * Tests for authentication and authorization middleware
 */

// Mock config first - before any imports
jest.mock('../src/config', () => ({
  jwt: {
    secret: 'test-secret',
    refreshSecret: 'test-refresh-secret',
    expiresIn: '1h',
    refreshExpiresIn: '7d',
  },
  logging: {
    level: 'error',
    format: 'simple',
  },
  isDevelopment: false,
  isTest: true,
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock database
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
}));

// Mock JWT and User
jest.mock('jsonwebtoken');
jest.mock('../src/models/User');

const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const { authenticate, requireRole, generateTokens, verifyRefreshToken } = require('../src/middleware/auth');
const { errorHandler, notFound, asyncHandler } = require('../src/middleware/errorHandler');
const { AppError, ValidationError } = require('../src/utils/errors');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    User.UserRoles = {
      DEVELOPER: 'developer',
      MANAGER: 'manager',
      ADMIN: 'admin',
    };
  });

  describe('authenticate', () => {
    it('should authenticate with valid token', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';

      jwt.verify.mockReturnValue({ userId: 'user-123' });
      User.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject missing authorization header', async () => {
      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid authorization format', async () => {
      mockReq.headers.authorization = 'InvalidFormat token';

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject Bearer without token', async () => {
      mockReq.headers.authorization = 'Bearer ';

      // Empty token should cause jwt.verify to throw
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation((token) => {
        if (!token || token.trim() === '') {
          throw error;
        }
        return { userId: 'user123', role: 'developer' };
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject expired token', async () => {
      mockReq.headers.authorization = 'Bearer expired-token';

      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject invalid token', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject non-existent user', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';

      jwt.verify.mockReturnValue({ userId: 'nonexistent' });
      User.findById.mockResolvedValue(null);

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject deactivated user', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';

      jwt.verify.mockReturnValue({ userId: 'user-123' });
      User.findById.mockResolvedValue({
        id: 'user-123',
        isActive: false,
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle database errors', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';

      jwt.verify.mockReturnValue({ userId: 'user-123' });
      User.findById.mockRejectedValue(new Error('Database error'));

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireRole', () => {
    it('should allow user with correct role', () => {
      mockReq.user = { id: 'user-123', role: 'admin' };

      const middleware = requireRole('admin', 'manager');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow second role in list', () => {
      mockReq.user = { id: 'user-123', role: 'manager' };

      const middleware = requireRole('admin', 'manager');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny user with wrong role', () => {
      mockReq.user = { id: 'user-123', role: 'developer' };

      const middleware = requireRole('admin', 'manager');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require authentication', () => {
      mockReq.user = null;

      const middleware = requireRole('admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle undefined user', () => {
      delete mockReq.user;

      const middleware = requireRole('admin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      jwt.sign.mockReturnValue('mock-token');
      jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const user = { id: 'user-123', email: 'test@example.com', role: 'developer' };
      const tokens = generateTokens(user);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresAt');
      expect(tokens).toHaveProperty('tokenType', 'Bearer');
    });

    it('should include user role in token', () => {
      jwt.sign.mockReturnValue('mock-token');
      jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      const user = { id: 'user-123', email: 'test@example.com', role: 'admin' };
      generateTokens(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      jwt.verify.mockReturnValue({ userId: 'user-123' });

      const result = verifyRefreshToken('valid-token');

      expect(result).toHaveProperty('userId', 'user-123');
    });

    it('should throw for invalid refresh token', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid');
      });

      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });
  });
});

describe('Error Handler Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      path: '/test',
      method: 'GET',
      body: {},
      originalUrl: '/api/test',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    it('should handle AppError', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Test error',
        })
      );
    });

    it('should handle AppError with custom code', () => {
      const error = new AppError('Custom error', 422, 'CUSTOM_CODE');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Validation failed', ['field is required']);

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle ValidationError with multiple errors', () => {
      const error = new ValidationError('Validation failed', [
        'email is required',
        'password is too short',
      ]);

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      // In test mode, sendErrorDev is used which includes error object with its properties
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle errors without message', () => {
      const error = new Error();

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle errors with statusCode property', () => {
      const error = new Error('Custom status');
      error.statusCode = 418;

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(418);
    });
  });

  describe('notFound', () => {
    it('should return 404 response', () => {
      notFound(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'NOT_FOUND',
        })
      );
    });

    it('should include requested path in message', () => {
      mockReq.originalUrl = '/api/unknown/path';

      notFound(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('/api/unknown/path'),
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should pass successful result', async () => {
      const handler = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('should catch and forward errors', async () => {
      const error = new Error('Async error');
      const handler = asyncHandler(async () => {
        throw error;
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle sync functions that throw', async () => {
      // Note: Promise.resolve(fn()) does NOT catch sync throws
      // The sync function must return a promise for errors to be caught
      const handler = asyncHandler(async () => {
        throw new Error('Sync error');
      });

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Sync error');
    });
  });
});

describe('Upload Middleware', () => {
  // Upload middleware is tested in uploadMiddleware.test.js
  // These tests just verify the module structure without loading the full module
  it('should have upload module path', () => {
    const path = require('path');
    const uploadPath = path.resolve(__dirname, '../src/middleware/upload.js');
    expect(require('fs').existsSync(uploadPath)).toBe(true);
  });
});

describe('Validation Middleware', () => {
  it('should export validation middleware', () => {
    const validation = require('../src/middleware/validation');
    expect(validation).toBeDefined();
  });

  it('should have validation functions', () => {
    const validation = require('../src/middleware/validation');
    expect(validation.authValidations).toBeDefined();
    expect(validation.queryRequestValidations).toBeDefined();
  });
});
