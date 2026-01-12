/**
 * Additional Branch Coverage Tests
 * Targets specific remaining uncovered branches for 100% coverage
 */

describe('Additional Branch Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  // ============================================
  // logger.js - Meta object handling (line 15)
  // ============================================
  describe('logger meta object handling', () => {
    let logger;

    beforeEach(() => {
      logger = require('../src/utils/logger');
    });

    it('should handle log with populated meta object (true branch)', () => {
      expect(() => {
        logger.info('Test with meta', { userId: '123', action: 'test', timestamp: Date.now() });
      }).not.toThrow();
    });

    it('should handle log with empty meta object (false branch)', () => {
      expect(() => {
        logger.info('Test message', {});
      }).not.toThrow();
    });

    it('should handle log without any meta (false branch)', () => {
      expect(() => {
        logger.info('Simple message');
      }).not.toThrow();
    });

    it('should handle different log levels with and without meta', () => {
      expect(() => {
        logger.debug('Debug with meta', { key: 'value' });
        logger.debug('Debug without meta');
        logger.warn('Warning with meta', { warning: true });
        logger.warn('Warning without meta');
        logger.error('Error with meta', { error: 'test' });
        logger.error('Error without meta');
      }).not.toThrow();
    });
  });

  // ============================================
  // errorHandler - Default statusCode/code (lines 35-38)
  // ============================================
  describe('errorHandler defaults', () => {
    let errorHandler;
    let mockRes;

    beforeEach(() => {
      jest.resetModules();
      jest.doMock('../src/config', () => ({
        isDevelopment: true,
        isTest: true,
        isProduction: false,
        logging: { level: 'info' },
      }));
      errorHandler = require('../src/middleware/errorHandler').errorHandler;
      mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    });

    it('should default statusCode to 500 when not set on error', () => {
      const err = new Error('Test error');
      
      errorHandler(err, { path: '/', method: 'GET', body: {} }, mockRes, jest.fn());
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should default code to INTERNAL_ERROR when not set on error', () => {
      const err = new Error('Test error');
      err.statusCode = 400;

      errorHandler(err, { path: '/', method: 'GET', body: {} }, mockRes, jest.fn());

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
        })
      );
    });

    it('should preserve statusCode and code when already set', () => {
      const err = new Error('Test error');
      err.statusCode = 422;
      err.code = 'CUSTOM_CODE';

      errorHandler(err, { path: '/', method: 'GET', body: {} }, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CUSTOM_CODE',
        })
      );
    });
  });

  // ============================================
  // scriptExecutionService - Functions exist
  // ============================================
  describe('scriptExecutionService module', () => {
    it('should export executeScript function', () => {
      const scriptExecutionService = require('../src/services/scriptExecutionService');
      
      expect(scriptExecutionService.executeScript).toBeDefined();
      expect(typeof scriptExecutionService.executeScript).toBe('function');
    });
  });
});
