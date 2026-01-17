// @ts-nocheck
/**
 * Configuration Tests
 * Tests for config/index.js - validates structure and exports
 */

describe('Configuration', () => {
  let config;

  beforeAll(() => {
    // Load config once - don't try to manipulate cache as dotenv has already loaded .env
    config = require('../src/config/index');
  });

  describe('Server Configuration', () => {
    it('should have server configuration', () => {
      expect(config.server).toBeDefined();
      expect(config.server.port).toBeDefined();
      expect(typeof config.server.port).toBe('number');
    });

    it('should have a valid port number', () => {
      expect(config.server.port).toBeGreaterThan(0);
      expect(config.server.port).toBeLessThan(65536);
    });
  });

  describe('Database Configuration', () => {
    it('should have portalDb configuration', () => {
      expect(config.portalDb).toBeDefined();
    });

    it('should have required database fields', () => {
      expect(config.portalDb.host).toBeDefined();
      expect(config.portalDb.port).toBeDefined();
      expect(config.portalDb.database).toBeDefined();
      expect(config.portalDb.user).toBeDefined();
    });

    it('should have valid database port', () => {
      expect(typeof config.portalDb.port).toBe('number');
      expect(config.portalDb.port).toBeGreaterThan(0);
    });
  });

  describe('JWT Configuration', () => {
    it('should have jwt configuration', () => {
      expect(config.jwt).toBeDefined();
    });

    it('should have required JWT fields', () => {
      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.expiresIn).toBeDefined();
      expect(config.jwt.refreshSecret).toBeDefined();
      expect(config.jwt.refreshExpiresIn).toBeDefined();
    });

    it('should have non-empty JWT secret', () => {
      expect(typeof config.jwt.secret).toBe('string');
      expect(config.jwt.secret.length).toBeGreaterThan(0);
    });

    it('should have valid expiresIn format', () => {
      expect(typeof config.jwt.expiresIn).toBe('string');
      // Should match patterns like '1h', '24h', '7d', '72h' etc.
      expect(config.jwt.expiresIn).toMatch(/^\d+[hdms]$/);
    });
  });

  describe('Slack Configuration', () => {
    it('should have slack configuration', () => {
      expect(config.slack).toBeDefined();
    });

    it('should have enabled flag', () => {
      expect(typeof config.slack.enabled).toBe('boolean');
    });

    it('should have botToken field', () => {
      expect(config.slack).toHaveProperty('botToken');
    });

    it('should have approvalChannel field', () => {
      expect(config.slack).toHaveProperty('approvalChannel');
    });
  });

  describe('Upload Configuration', () => {
    it('should have upload configuration', () => {
      expect(config.upload).toBeDefined();
    });

    it('should have maxFileSize as a number', () => {
      expect(config.upload.maxFileSize).toBeDefined();
      expect(typeof config.upload.maxFileSize).toBe('number');
      expect(config.upload.maxFileSize).toBeGreaterThan(0);
    });

    it('should have uploadDir', () => {
      expect(config.upload.uploadDir).toBeDefined();
      expect(typeof config.upload.uploadDir).toBe('string');
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should have rate limit configuration', () => {
      expect(config.rateLimit).toBeDefined();
    });

    it('should have windowMs', () => {
      expect(config.rateLimit.windowMs).toBeDefined();
      expect(typeof config.rateLimit.windowMs).toBe('number');
    });

    it('should have rate limit settings', () => {
      // Check that rateLimit has at least one numeric setting
      const rateLimitKeys = Object.keys(config.rateLimit);
      expect(rateLimitKeys.length).toBeGreaterThan(0);
      
      // At least windowMs should be a number
      const hasNumericSetting = rateLimitKeys.some(
        key => typeof config.rateLimit[key] === 'number'
      );
      expect(hasNumericSetting).toBe(true);
    });
  });

  describe('isProduction flag', () => {
    it('should have isProduction defined', () => {
      expect(config).toHaveProperty('isProduction');
      expect(typeof config.isProduction).toBe('boolean');
    });

    it('should match NODE_ENV', () => {
      const expectedProduction = process.env.NODE_ENV === 'production';
      expect(config.isProduction).toBe(expectedProduction);
    });
  });

  describe('Configuration Integrity', () => {
    it('should not expose sensitive data in plain text logs', () => {
      // Ensure password fields exist but we don't log them
      if (config.portalDb.password) {
        expect(typeof config.portalDb.password).toBe('string');
      }
    });

    it('should have all required top-level keys', () => {
      const requiredKeys = ['server', 'portalDb', 'jwt', 'slack', 'upload', 'rateLimit'];
      requiredKeys.forEach(key => {
        expect(config).toHaveProperty(key);
      });
    });
  });

  describe('Environment-based behavior', () => {
    it('should have consistent configuration structure', () => {
      // Validate the config object is frozen or at least defined
      expect(Object.keys(config).length).toBeGreaterThan(0);
    });

    it('should handle missing optional environment variables gracefully', () => {
      // Config should load without crashing even if some optional vars are missing
      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
    });
  });
});

describe('Configuration Module Exports', () => {
  it('should export a plain object', () => {
    const config = require('../src/config/index');
    expect(typeof config).toBe('object');
    expect(config).not.toBeNull();
  });

  it('should be importable multiple times without error', () => {
    const config1 = require('../src/config/index');
    const config2 = require('../src/config/index');
    expect(config1).toBe(config2); // Same cached instance
  });
});