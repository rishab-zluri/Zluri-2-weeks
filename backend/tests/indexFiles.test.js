/**
 * Index Files Tests
 * Tests for module exports in index files
 * 100% Branch Coverage
 */

describe('Index Files Exports', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('middleware/index.js', () => {
    it('should export all middleware modules', () => {
      const middleware = require('../src/middleware');
      
      expect(middleware).toBeDefined();
      // Auth middleware exports
      expect(middleware.authenticate).toBeDefined();
      expect(middleware.optionalAuth).toBeDefined();
      expect(middleware.requireRole).toBeDefined();
      // Error handler exports
      expect(middleware.errorHandler).toBeDefined();
      expect(middleware.asyncHandler).toBeDefined();
      // Validation exports
      expect(middleware.validate).toBeDefined();
      expect(middleware.authValidations).toBeDefined();
      expect(middleware.queryRequestValidations).toBeDefined();
      expect(middleware.sanitizeInput).toBeDefined();
      // Upload exports
      expect(middleware.uploadScript).toBeDefined();
    });
  });

  describe('models/index.js', () => {
    it('should export all model modules', () => {
      const models = require('../src/models');
      
      expect(models).toBeDefined();
      expect(models.User).toBeDefined();
      expect(models.QueryRequest).toBeDefined();
    });
  });

  describe('services/index.js', () => {
    it('should export all service modules', () => {
      const services = require('../src/services');
      
      expect(services).toBeDefined();
      expect(services.queryExecutionService).toBeDefined();
      expect(services.scriptExecutionService).toBeDefined();
      expect(services.slackService).toBeDefined();
    });
  });

  describe('routes/index.js', () => {
    it('should export all route modules', () => {
      const routes = require('../src/routes');
      
      expect(routes).toBeDefined();
      expect(routes.authRoutes).toBeDefined();
      expect(routes.queryRoutes).toBeDefined();
    });
  });

  describe('config/index.js', () => {
    it('should export all configuration', () => {
      const config = require('../src/config');
      
      expect(config).toBeDefined();
      expect(config.env).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.portalDb).toBeDefined();
      expect(config.jwt).toBeDefined();
      expect(config.slack).toBeDefined();
      expect(config.rateLimit).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.upload).toBeDefined();
      expect(config.scriptExecution).toBeDefined();
      expect(config.cors).toBeDefined();
    });

    it('should freeze configuration object', () => {
      const config = require('../src/config');
      
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('should freeze nested configuration objects', () => {
      const config = require('../src/config');
      
      expect(Object.isFrozen(config.server)).toBe(true);
      expect(Object.isFrozen(config.jwt)).toBe(true);
      expect(Object.isFrozen(config.portalDb)).toBe(true);
    });
  });
});
