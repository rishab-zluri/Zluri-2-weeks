/**
 * Custom Errors Tests
 */

const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  QueryExecutionError,
  ScriptExecutionError,
} = require('../src/utils/errors');

describe('Custom Errors', () => {
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Test error', 400, 'CUSTOM_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.status).toBe('fail');
    });

    it('should set status based on status code', () => {
      const clientError = new AppError('Client error', 400);
      expect(clientError.status).toBe('fail');

      const serverError = new AppError('Server error', 500);
      expect(serverError.status).toBe('error');
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should create with default message', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should store validation errors', () => {
      const errors = [{ field: 'email', message: 'Invalid email' }];
      const error = new ValidationError('Invalid input', errors);
      expect(error.errors).toEqual(errors);
    });
  });

  describe('AuthenticationError', () => {
    it('should create with default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should allow custom message', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError', () => {
    it('should create with default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should create with default message', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should allow custom resource message', () => {
      const error = new NotFoundError('User not found');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should create with default message', () => {
      const error = new ConflictError();
      expect(error.message).toBe('Resource conflict');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('RateLimitError', () => {
    it('should create with default message', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('DatabaseError', () => {
    it('should create with default message', () => {
      const error = new DatabaseError();
      expect(error.message).toBe('Database operation failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('ExternalServiceError', () => {
    it('should create with default values', () => {
      const error = new ExternalServiceError();
      expect(error.message).toBe('External service error');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('unknown');
    });

    it('should store service name', () => {
      const error = new ExternalServiceError('Slack API failed', 'slack');
      expect(error.service).toBe('slack');
    });
  });

  describe('QueryExecutionError', () => {
    it('should create with default message', () => {
      const error = new QueryExecutionError();
      expect(error.message).toBe('Query execution failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('QUERY_EXECUTION_ERROR');
    });

    it('should store execution details', () => {
      const details = { query: 'SELECT *', error: 'Timeout' };
      const error = new QueryExecutionError('Timeout', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('ScriptExecutionError', () => {
    it('should create with default message', () => {
      const error = new ScriptExecutionError();
      expect(error.message).toBe('Script execution failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('SCRIPT_EXECUTION_ERROR');
    });

    it('should store execution details', () => {
      const details = { script: 'test.js', error: 'Syntax error' };
      const error = new ScriptExecutionError('Syntax error', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('Error inheritance', () => {
    it('all errors should be instances of AppError', () => {
      expect(new ValidationError()).toBeInstanceOf(AppError);
      expect(new AuthenticationError()).toBeInstanceOf(AppError);
      expect(new AuthorizationError()).toBeInstanceOf(AppError);
      expect(new NotFoundError()).toBeInstanceOf(AppError);
      expect(new ConflictError()).toBeInstanceOf(AppError);
      expect(new RateLimitError()).toBeInstanceOf(AppError);
      expect(new DatabaseError()).toBeInstanceOf(AppError);
      expect(new ExternalServiceError()).toBeInstanceOf(AppError);
      expect(new QueryExecutionError()).toBeInstanceOf(AppError);
      expect(new ScriptExecutionError()).toBeInstanceOf(AppError);
    });

    it('all errors should have stack trace', () => {
      const error = new ValidationError('Test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Test');
    });
  });
});
