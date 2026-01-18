
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateQuery, validateParams } from '../src/validation/middleware';
import { ValidationError } from '../src/utils/errors';
import * as validationExports from '../src/validation';

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    mockNext = jest.fn() as NextFunction;
  });

  const TestSchema = z.object({
    name: z.string().min(3),
    age: z.number().min(18).optional(),
  });

  describe('validate (Body)', () => {
    it('should pass valid body', () => {
      mockReq.body = { name: 'Alice', age: 25 };
      const middleware = validate(TestSchema);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'Alice', age: 25 });
    });

    it('should fail invalid body', () => {
      mockReq.body = { name: 'Al' }; // Too short
      const middleware = validate(TestSchema);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should fail with unexpected type', () => {
      mockReq.body = { name: 123 }; // Wrong type
      const middleware = validate(TestSchema);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('validateQuery', () => {
    const QuerySchema = z.object({
      page: z.coerce.number().min(1),
      sort: z.string().optional(),
    });

    it('should pass valid query and coerce types', () => {
      mockReq.query = { page: '1', sort: 'desc' };
      const middleware = validateQuery(QuerySchema);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      const validated = (mockReq as any).validatedQuery;
      expect(validated.page).toBe(1); // Coerced to number
      expect(validated.sort).toBe('desc');
    });

    it('should fail invalid query', () => {
      mockReq.query = { page: '0' }; // Min 1
      const middleware = validateQuery(QuerySchema);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('validateParams', () => {
    const ParamsSchema = z.object({
      id: z.string().uuid(),
    });

    it('should pass valid params', () => {
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const middleware = validateParams(ParamsSchema);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).validatedParams.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should fail invalid params', () => {
      mockReq.params = { id: 'not-a-uuid' };
      const middleware = validateParams(ParamsSchema);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('Schema Exports', () => {
    it('should export all required schemas', () => {
      // Auth
      expect(validationExports.LoginSchema).toBeDefined();
      expect(validationExports.RegisterSchema).toBeDefined();
      expect(validationExports.RefreshTokenSchema).toBeDefined();

      // Query
      expect(validationExports.SubmitRequestSchema).toBeDefined();

      // User
      expect(validationExports.UpdateUserSchema).toBeDefined();

      // Common
      expect(validationExports.PaginationSchema).toBeDefined();
      expect(validationExports.UuidParamSchema).toBeDefined();
    });
  });
});
