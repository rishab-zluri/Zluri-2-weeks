import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as auth from '../src/middleware/auth';
import * as upload from '../src/middleware/upload';
import { query } from '../src/config/database';

jest.mock('jsonwebtoken');
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../src/utils/logger');
jest.mock('multer', () => {
  const multerMock: any = jest.fn(() => ({
    single: jest.fn(() => (req: any, res: any, next: any) => next()),
  }));
  multerMock.diskStorage = jest.fn();
  multerMock.memoryStorage = jest.fn();
  multerMock.MulterError = class MulterError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  };
  return multerMock;
});

describe('Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRes = {
      status: mockStatus,
      json: mockJson,
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
    mockNext = jest.fn();
    mockReq = {
      headers: {},
      body: {},
      params: {},
      query: {},
      cookies: {},
    } as unknown as Request;
  });

  describe('Auth Middleware', () => {
    describe('generateAccessToken', () => {
      it('should generate token', () => {
        (jwt.sign as unknown as jest.Mock).mockReturnValue('token');
        const user = { id: '1', email: 'test@test.com', role: 'admin' as any };
        const token = auth.generateAccessToken(user);
        expect(token).toBe('token');
        expect(jwt.sign).toHaveBeenCalled();
      });
    });

    describe('authenticate', () => {
      it('should authenticate valid token', async () => {
        mockReq.cookies = { access_token: 'valid_token' };
        (jwt.verify as unknown as jest.Mock).mockReturnValue({
          userId: '1',
          role: 'admin',
          type: 'access'
        });
        // Mock blacklist check check
        jest.mocked(query).mockResolvedValue({ rows: [] } as any);

        await auth.authenticate(mockReq as Request, mockRes as Response, mockNext);
        expect(mockReq.user).toBeDefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('should fail with no token', async () => {
        await auth.authenticate(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(401);
      });

      it('should fail with invalid token', async () => {
        mockReq.headers = { authorization: 'Bearer invalid' };
        (jwt.verify as unknown as jest.Mock).mockImplementation(() => { throw new Error('Invalid'); });
        await auth.authenticate(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(401);
      });

      it('should fail if token is blacklisted', async () => {
        mockReq.cookies = { access_token: 'revoked_token' };
        (jwt.verify as unknown as jest.Mock).mockReturnValue({ userId: '1', type: 'access' });
        jest.mocked(query).mockResolvedValue({ rows: [{ 1: 1 }] } as any); // Found in blacklist

        await auth.authenticate(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(401);
        expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('revoked') }));
      });
    });

    describe('authorize', () => {
      it('should allow valid role', () => {
        mockReq.user = { role: 'admin' } as any;
        const middleware = auth.authorize('admin');
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should deny invalid role', () => {
        mockReq.user = { role: 'dev' } as any;
        const middleware = auth.authorize('admin');
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(403);
      });

      it('should fail if no user', () => {
        mockReq.user = undefined;
        const middleware = auth.authorize('admin');
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(401);
      });
    });

    describe('authorizeMinRole', () => {
      it('should allow higher role', () => {
        mockReq.user = { role: 'admin' } as any; // level 3
        const middleware = auth.authorizeMinRole('manager'); // level 2
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should deny lower role', () => {
        mockReq.user = { role: 'developer' } as any; // level 1
        const middleware = auth.authorizeMinRole('manager'); // level 2
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(403);
      });
    });

    describe('authorizePodAccess', () => {
      it('should allow matching podId', () => {
        mockReq.user = { role: 'developer', podId: 'pod1' } as any;
        mockReq.params = { podId: 'pod1' };
        const middleware = auth.authorizePodAccess();
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should allow admin', () => {
        mockReq.user = { role: 'admin', podId: 'pod1' } as any;
        mockReq.params = { podId: 'pod2' };
        const middleware = auth.authorizePodAccess();
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should deny mismatch', () => {
        mockReq.user = { role: 'developer', podId: 'pod1' } as any;
        mockReq.params = { podId: 'pod2' };
        const middleware = auth.authorizePodAccess();
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(403);
      });
    });
  });

  describe('Upload Middleware', () => {
    describe('validateScriptContent', () => {
      const buffer = Buffer.from('console.log("hello")');

      it('should skip if no file and optional', () => {
        mockReq.file = undefined;
        // Should fail if script type but no content
        mockReq.body = { submissionType: 'script' };
        upload.validateScriptContent(mockReq as Request, mockRes as Response, mockNext);
        expect(mockStatus).toHaveBeenCalledWith(400); // Wait, logic says strictly checking body

        // Correct logic: if no file, check scriptContent
        (mockNext as jest.Mock).mockClear();
        mockStatus.mockClear();
        mockReq.body = { submissionType: 'query' }; // Not a script submission
        upload.validateScriptContent(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });

      it('should process file', () => {
        mockReq.file = {
          originalname: 'test.js',
          buffer,
          size: 100,
          mimetype: 'text/javascript'
        } as any;

        upload.validateScriptContent(mockReq as Request, mockRes as Response, mockNext);
        expect(mockReq.scriptInfo).toBeDefined();
        expect(mockReq.scriptInfo?.content).toContain('console.log');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should detect dangerous patterns', () => {
        mockReq.file = {
          originalname: 'evil.js',
          buffer: Buffer.from('require("child_process")'),
          size: 100,
          mimetype: 'text/javascript'
        } as any;

        upload.validateScriptContent(mockReq as Request, mockRes as Response, mockNext);
        expect(mockReq.scriptInfo?.warnings).toHaveLength(1);
      });
    });
  });
});
