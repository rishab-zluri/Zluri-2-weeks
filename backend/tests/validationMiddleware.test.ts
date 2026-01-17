// @ts-nocheck
/**
 * Validation Middleware Tests
 * Tests for request validation functions
 */

const { validationResult } = require('express-validator');

// Import validation middleware
const {
  validate,
  authValidations,
  queryRequestValidations,
  userValidations,
  instanceValidations,
  sanitizeInput,
} = require('../src/middleware/validation');

// Helper to run validations and get errors
const runValidation = async (validations, mockReq) => {
  for (const validation of validations) {
    await validation.run(mockReq);
  }
  return validationResult(mockReq);
};

describe('Validation Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('validate function', () => {
    it('should call next when no errors', () => {
      // Mock empty errors
      mockReq._validationErrors = [];
      
      validate(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authValidations.login', () => {
    it('should pass with valid email and password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await runValidation(authValidations.login, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid email', async () => {
      mockReq.body = {
        email: 'invalid-email',
        password: 'password123',
      };

      const result = await runValidation(authValidations.login, mockReq);

      expect(result.isEmpty()).toBe(false);
      expect(result.array().some(e => e.path === 'email')).toBe(true);
    });

    it('should fail with missing password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: '',
      };

      const result = await runValidation(authValidations.login, mockReq);

      expect(result.isEmpty()).toBe(false);
      expect(result.array().some(e => e.path === 'password')).toBe(true);
    });

    it('should fail with missing email', async () => {
      mockReq.body = {
        password: 'password123',
      };

      const result = await runValidation(authValidations.login, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('authValidations.register', () => {
    it('should pass with valid registration data', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with short password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'short',
        name: 'Test User',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(false);
      expect(result.array().some(e => e.path === 'password')).toBe(true);
    });

    it('should fail without uppercase in password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail without lowercase in password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'PASSWORD123',
        name: 'Test User',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail without number in password', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'PasswordABC',
        name: 'Test User',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with short name', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'A',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(false);
      expect(result.array().some(e => e.path === 'name')).toBe(true);
    });

    it('should fail with missing name', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Password123',
        name: '',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should allow optional podId', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
        podId: 'pod-1',
      };

      const result = await runValidation(authValidations.register, mockReq);

      expect(result.isEmpty()).toBe(true);
    });
  });

  describe('authValidations.refreshToken', () => {
    it('should pass with refresh token', async () => {
      mockReq.body = {
        refreshToken: 'valid-token',
      };

      const result = await runValidation(authValidations.refreshToken, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail without refresh token', async () => {
      mockReq.body = {};

      const result = await runValidation(authValidations.refreshToken, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('queryRequestValidations.create', () => {
    it('should pass with valid query submission', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'query',
        queryContent: 'SELECT * FROM users',
        comments: 'This is a test query for fetching users',
        podId: 'pod-1',
      };

      const result = await runValidation(queryRequestValidations.create, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with valid script submission', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'script',
        comments: 'This is a test script submission comment',
        podId: 'pod-1',
      };

      const result = await runValidation(queryRequestValidations.create, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with missing instanceId', async () => {
      mockReq.body = {
        databaseName: 'test_db',
        submissionType: 'query',
        queryContent: 'SELECT * FROM users',
        comments: 'This is a test query',
        podId: 'pod-1',
      };

      const result = await runValidation(queryRequestValidations.create, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with invalid submissionType', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'invalid',
        queryContent: 'SELECT * FROM users',
        comments: 'This is a test query for testing',
        podId: 'pod-1',
      };

      const result = await runValidation(queryRequestValidations.create, mockReq);

      expect(result.isEmpty()).toBe(false);
      expect(result.array().some(e => e.path === 'submissionType')).toBe(true);
    });

    it('should fail with short comments', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'query',
        queryContent: 'SELECT * FROM users',
        comments: 'Too short',
        podId: 'pod-1',
      };

      const result = await runValidation(queryRequestValidations.create, mockReq);

      expect(result.isEmpty()).toBe(false);
      expect(result.array().some(e => e.path === 'comments')).toBe(true);
    });

    it('should fail with missing podId', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'query',
        queryContent: 'SELECT * FROM users',
        comments: 'This is a test query for testing',
        podId: '',
      };

      const result = await runValidation(queryRequestValidations.create, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('queryRequestValidations.approve', () => {
    it('should pass with valid uuid', async () => {
      const mockReq = { params: { uuid: 'c4e7169b-0aac-4c61-88a2-34a2259f2f43' } };

      const result = await runValidation(queryRequestValidations.approve, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid uuid', async () => {
      mockReq.params = { uuid: 'invalid-uuid' };

      const result = await runValidation(queryRequestValidations.approve, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with missing uuid', async () => {
      mockReq.params = {};

      const result = await runValidation(queryRequestValidations.approve, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('queryRequestValidations.reject', () => {
    it('should pass with valid uuid and reason', async () => {
      mockReq.params = { uuid: 'c4e7169b-0aac-4c61-88a2-34a2259f2f43' };
      mockReq.body = { reason: 'Not approved' };

      const result = await runValidation(queryRequestValidations.reject, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with valid uuid and no reason', async () => {
      mockReq.params = { uuid: 'c4e7169b-0aac-4c61-88a2-34a2259f2f43' };
      mockReq.body = {};

      const result = await runValidation(queryRequestValidations.reject, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid uuid', async () => {
      mockReq.params = { uuid: 'not-a-valid-uuid' };
      mockReq.body = {};

      const result = await runValidation(queryRequestValidations.reject, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('queryRequestValidations.list', () => {
    it('should pass with valid query params', async () => {
      mockReq.query = {
        page: '1',
        limit: '10',
        status: 'pending',
      };

      const result = await runValidation(queryRequestValidations.list, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with no params', async () => {
      mockReq.query = {};

      const result = await runValidation(queryRequestValidations.list, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid status', async () => {
      mockReq.query = {
        status: 'invalid',
      };

      const result = await runValidation(queryRequestValidations.list, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with page less than 1', async () => {
      mockReq.query = {
        page: '0',
      };

      const result = await runValidation(queryRequestValidations.list, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with limit over 100', async () => {
      mockReq.query = {
        limit: '150',
      };

      const result = await runValidation(queryRequestValidations.list, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('userValidations.updateProfile', () => {
    it('should pass with valid name', async () => {
      mockReq.body = {
        name: 'New Name',
      };

      const result = await runValidation(userValidations.updateProfile, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with valid slackUserId', async () => {
      mockReq.body = {
        slackUserId: 'U12345',
      };

      const result = await runValidation(userValidations.updateProfile, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with empty body', async () => {
      mockReq.body = {};

      const result = await runValidation(userValidations.updateProfile, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with short name', async () => {
      mockReq.body = {
        name: 'A',
      };

      const result = await runValidation(userValidations.updateProfile, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('userValidations.changePassword', () => {
    it('should pass with valid password change', async () => {
      mockReq.body = {
        currentPassword: 'oldpass',
        newPassword: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      };

      const result = await runValidation(userValidations.changePassword, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with mismatched passwords', async () => {
      mockReq.body = {
        currentPassword: 'oldpass',
        newPassword: 'NewPassword123',
        confirmPassword: 'DifferentPassword123',
      };

      const result = await runValidation(userValidations.changePassword, mockReq);

      expect(result.isEmpty()).toBe(false);
      expect(result.array().some(e => e.path === 'confirmPassword')).toBe(true);
    });

    it('should fail with weak new password', async () => {
      mockReq.body = {
        currentPassword: 'oldpass',
        newPassword: 'weak',
        confirmPassword: 'weak',
      };

      const result = await runValidation(userValidations.changePassword, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('userValidations.adminUpdate', () => {
    it('should pass with valid update data', async () => {
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      mockReq.body = {
        role: 'manager',
        isActive: true,
      };

      const result = await runValidation(userValidations.adminUpdate, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid UUID', async () => {
      mockReq.params = { id: 'invalid-uuid' };
      mockReq.body = {};

      const result = await runValidation(userValidations.adminUpdate, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should fail with invalid role', async () => {
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      mockReq.body = {
        role: 'superadmin',
      };

      const result = await runValidation(userValidations.adminUpdate, mockReq);

      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('instanceValidations', () => {
    it('should pass with valid type', async () => {
      mockReq.query = { type: 'postgresql' };

      const result = await runValidation(instanceValidations.getByType, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should pass with mongodb type', async () => {
      mockReq.query = { type: 'mongodb' };

      const result = await runValidation(instanceValidations.getByType, mockReq);

      expect(result.isEmpty()).toBe(true);
    });

    it('should fail with invalid type', async () => {
      mockReq.query = { type: 'mysql' };

      const result = await runValidation(instanceValidations.getByType, mockReq);

      expect(result.isEmpty()).toBe(false);
    });

    it('should pass getDatabases with instanceId', async () => {
      mockReq.params = { instanceId: 'database-1' };

      const result = await runValidation(instanceValidations.getDatabases, mockReq);

      expect(result.isEmpty()).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize XSS in body', () => {
      mockReq.body = {
        name: '<script>alert("xss")</script>Test',
        description: 'Normal text',
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.name).not.toContain('<script>');
      expect(mockReq.body.description).toBe('Normal text');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize javascript: urls', () => {
      mockReq.body = {
        link: 'javascript:alert(1)',
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.link).not.toContain('javascript:');
    });

    it('should sanitize onclick handlers', () => {
      mockReq.body = {
        text: '<div onclick=alert(1)>test</div>',
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.text).not.toContain('onclick=');
    });

    it('should not sanitize queryContent', () => {
      const queryContent = 'SELECT * FROM users WHERE name = "<script>test</script>"';
      mockReq.body = {
        queryContent,
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.queryContent).toBe(queryContent);
    });

    it('should not sanitize password fields', () => {
      const password = '<script>password123';
      mockReq.body = {
        password,
        currentPassword: password,
        newPassword: password,
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.password).toBe(password);
      expect(mockReq.body.currentPassword).toBe(password);
      expect(mockReq.body.newPassword).toBe(password);
    });

    it('should sanitize query params', () => {
      mockReq.query = {
        search: '<script>xss</script>',
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.query.search).not.toContain('<script>');
    });

    it('should sanitize params', () => {
      mockReq.params = {
        id: '<script>xss</script>',
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.params.id).not.toContain('<script>');
    });

    it('should handle arrays', () => {
      mockReq.body = {
        items: ['<script>xss</script>', 'normal'],
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.items[0]).not.toContain('<script>');
      expect(mockReq.body.items[1]).toBe('normal');
    });

    it('should handle nested objects', () => {
      mockReq.body = {
        nested: {
          deep: {
            value: '<script>xss</script>',
          },
        },
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.nested.deep.value).not.toContain('<script>');
    });

    it('should handle null and undefined', () => {
      mockReq.body = {
        nullVal: null,
        undefinedVal: undefined,
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.nullVal).toBeNull();
      expect(mockReq.body.undefinedVal).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle numbers and booleans', () => {
      mockReq.body = {
        num: 123,
        bool: true,
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.num).toBe(123);
      expect(mockReq.body.bool).toBe(true);
    });
  });
});
