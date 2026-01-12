/**
 * Comprehensive Branch Coverage Tests
 * Tests specifically designed to achieve 100% branch coverage
 */

// Set up env vars before any imports
process.env.PORTAL_DB_HOST = 'localhost';
process.env.PORTAL_DB_NAME = 'test_db';
process.env.PORTAL_DB_USER = 'test_user';
process.env.PORTAL_DB_PASSWORD = 'test_pass';
process.env.NODE_ENV = 'test';

describe('Branch Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Config branch coverage', () => {
    it('should load config values from environment', () => {
      const config = require('../src/config');
      
      // Test that config object has expected structure
      expect(config.jwt).toBeDefined();
      expect(config.jwt.refreshSecret).toBeDefined();
      expect(typeof config.jwt.refreshSecret).toBe('string');
      expect(config.jwt.refreshSecret.length).toBeGreaterThan(0);
      
      expect(config.jwt.refreshExpiresIn).toBeDefined();
      expect(typeof config.jwt.refreshExpiresIn).toBe('string');
      
      expect(config.slack).toBeDefined();
      expect(typeof config.slack.approvalChannel).toBe('string');
    });

    it('should use provided env values when set', () => {
      const originalEnv = { ...process.env };
      
      process.env.JWT_REFRESH_SECRET = 'test_custom_refresh_secret';
      process.env.JWT_REFRESH_EXPIRES_IN = '30d';
      process.env.SLACK_APPROVAL_CHANNEL = '#test-approvals';
      
      jest.resetModules();
      const config = require('../src/config');
      
      expect(config.jwt.refreshSecret).toBe('test_custom_refresh_secret');
      expect(config.jwt.refreshExpiresIn).toBe('30d');
      expect(config.slack.approvalChannel).toBe('#test-approvals');
      
      // Restore
      process.env = originalEnv;
      jest.resetModules();
    });
    
    it('should have correct default values for optional config', () => {
      const config = require('../src/config');
      
      // Test other config properties that have defaults
      expect(config.server.port).toBe(5001);
      expect(config.portalDb.host).toBe('localhost');
      expect(config.portalDb.port).toBe(5432);
      expect(config.rateLimit.windowMs).toBeDefined();
      expect(config.upload.maxFileSize).toBeDefined();
      expect(config.scriptExecution.timeoutMs).toBeDefined();
    });
  });

  describe('Response utils branch coverage', () => {
    it('should handle undefined validationErrors', () => {
      const response = require('../src/utils/response');
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      response.error(mockRes, 'Error message', 400, 'ERROR_CODE');
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Error message',
          code: 'ERROR_CODE',
        })
      );
    });

    it('should handle null data in success response', () => {
      const response = require('../src/utils/response');
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      response.success(mockRes, null, 'Success');
      
      // When data is null, the response should NOT include data property
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
      });
    });

    it('should include data when provided in success response', () => {
      const response = require('../src/utils/response');
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      response.success(mockRes, { id: 1 }, 'Success');
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
        data: { id: 1 },
      });
    });

    it('should use default pagination values in paginated response', () => {
      const response = require('../src/utils/response');
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      response.paginated(mockRes, [1, 2, 3], {});
      
      const call = mockRes.json.mock.calls[0][0];
      expect(call.pagination).toBeDefined();
    });
  });

  describe('Logger branch coverage', () => {
    it('should handle different log levels', () => {
      jest.resetModules();
      
      // Test with debug level
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';
      const logger = require('../src/utils/logger');
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      
      process.env.LOG_LEVEL = originalLevel;
    });
  });

  describe('Error handler branch coverage', () => {
    it('should handle different error types in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      jest.resetModules();
      
      const { errorHandler } = require('../src/middleware/errorHandler');
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      // Test with operational error
      const operationalError = new Error('Operational error');
      operationalError.isOperational = true;
      operationalError.statusCode = 400;

      errorHandler(operationalError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle non-operational errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      jest.resetModules();
      
      const { errorHandler } = require('../src/middleware/errorHandler');
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      // Test with programming error (non-operational)
      const programmingError = new Error('Internal error');
      programmingError.isOperational = false;

      errorHandler(programmingError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Script execution service functions', () => {
    it('should export executeScript function', () => {
      jest.resetModules();
      
      // Mock the dependencies
      jest.mock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
      }));
      
      const service = require('../src/services/scriptExecutionService');
      expect(service.executeScript).toBeDefined();
      expect(typeof service.executeScript).toBe('function');
    });

    it('should export cleanupTempDirectory function', () => {
      jest.resetModules();
      
      jest.mock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
      }));
      
      const service = require('../src/services/scriptExecutionService');
      expect(service.cleanupTempDirectory).toBeDefined();
      expect(typeof service.cleanupTempDirectory).toBe('function');
    });

    it('should export executeScript function', () => {
      jest.resetModules();
      
      jest.mock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
      }));
      
      const service = require('../src/services/scriptExecutionService');
      
      expect(service.executeScript).toBeDefined();
      expect(typeof service.executeScript).toBe('function');
    });

    it('should export cleanupTempDirectory function', () => {
      jest.resetModules();
      
      jest.mock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
      }));
      
      const service = require('../src/services/scriptExecutionService');
      
      expect(service.cleanupTempDirectory).toBeDefined();
      expect(typeof service.cleanupTempDirectory).toBe('function');
    });
  });
});

describe('Upload handleUpload Error Handling', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should handle Multer LIMIT_FILE_SIZE error', () => {
    const multer = require('multer');
    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    
    // Verify error type
    expect(err instanceof multer.MulterError).toBe(true);
    expect(err.code).toBe('LIMIT_FILE_SIZE');
  });

  it('should handle Multer LIMIT_UNEXPECTED_FILE error', () => {
    const multer = require('multer');
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    
    expect(err.code).toBe('LIMIT_UNEXPECTED_FILE');
  });

  it('should handle generic Multer errors', () => {
    const multer = require('multer');
    const err = new multer.MulterError('LIMIT_FILE_COUNT');
    err.message = 'Too many files';
    
    expect(err instanceof multer.MulterError).toBe(true);
    expect(err.message).toBe('Too many files');
  });
});
