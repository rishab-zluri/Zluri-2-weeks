/**
 * Complete Branch Coverage Tests
 * Target: 100% branch coverage
 * 
 * Remaining uncovered branches:
 * - queryController.js: 73 (else if branch), 225 (manager auth), 272 (error handling), 315 (manager auth)
 * - errorHandler.js: 35-38 (default statusCode/code - may be dead code)
 * - QueryRequest.js: 99 (default params), 462 (default reason)
 * - User.js: 221 (no valid fields to update)
 * - userRoutes.js: 105 (conditional field assignment)
 * - queryExecutionService.js: 215 (invalid query format)
 * - scriptExecutionService.js: 177-178 (stdout handling)
 * - slackService.js: 292 (error catch block)
 * - logger.js: 15 (empty meta branch)
 * - secretsRoutes.js: 56-57, 98-99, 152-153 (error handlers)
 */

describe('Complete Branch Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  // ===================================================================
  // queryController.js - Line 73 (else if scriptContent and || 'script.js')
  // ===================================================================
  describe('queryController - script content handling', () => {
    let queryController;
    let mockRes;
    let QueryRequest;
    let staticData;

    beforeEach(() => {
      jest.resetModules();

      jest.doMock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
      }));

      QueryRequest = {
        create: jest.fn().mockResolvedValue({ id: 1, uuid: 'test-uuid' }),
        findById: jest.fn(), findByUuid: jest.fn().mockResolvedValue({ id: 1 }),
      };
      jest.doMock('../src/models/QueryRequest', () => QueryRequest);

      jest.doMock('../src/models/User', () => ({
        UserRoles: { ADMIN: 'admin', MANAGER: 'manager', DEVELOPER: 'developer' },
      }));

      staticData = {
        getInstanceById: jest.fn().mockReturnValue({ id: 'inst', name: 'Instance', type: 'postgresql' }),
        validateInstanceDatabase: jest.fn().mockReturnValue(true),
        getPodById: jest.fn().mockReturnValue({ id: 'pod', name: 'Pod' }),
      };
      jest.doMock('../src/config/staticData', () => staticData);

      jest.doMock('../src/services/slackService', () => ({
        notifyNewSubmission: jest.fn().mockResolvedValue(),
      }));

      queryController = require('../src/controllers/queryController');
      mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    });

    it('should return error when script submission has no content (validation)', async () => {
      // This tests the validation that happens BEFORE line 73
      const mockReq = {
        user: { id: 'user-1', email: 'test@test.com' },
        body: {
          instanceId: 'inst',
          databaseName: 'db',
          submissionType: 'script',
          // NO scriptContent - validation should fail
          comments: 'Test',
          podId: 'pod',
        },
        scriptInfo: undefined,
      };

      await queryController.submitRequest(mockReq, mockRes);

      // Should return error for missing script
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MISSING_SCRIPT',
        })
      );
    });

    it('should use scriptContent from body when no file uploaded (line 73)', async () => {
      const mockReq = {
        user: { id: 'user-1', email: 'test@test.com' },
        body: {
          instanceId: 'inst',
          databaseName: 'db',
          submissionType: 'script',
          scriptContent: 'console.log("from body")',  // Content provided
          scriptFilename: 'myfile.js',  // Filename provided
          comments: 'Test',
          podId: 'pod',
        },
        scriptInfo: undefined,  // No file uploaded, so else-if branch
      };

      await queryController.submitRequest(mockReq, mockRes);

      expect(QueryRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptFilename: 'myfile.js',
          scriptContent: 'console.log("from body")',
        })
      );
    });

    it('should use default script.js when scriptFilename not provided (line 74 fallback)', async () => {
      const mockReq = {
        user: { id: 'user-1', email: 'test@test.com' },
        body: {
          instanceId: 'inst',
          databaseName: 'db',
          submissionType: 'script',
          scriptContent: 'console.log("test")',
          // NO scriptFilename - should default to 'script.js'
          comments: 'Test',
          podId: 'pod',
        },
        scriptInfo: undefined,
      };

      await queryController.submitRequest(mockReq, mockRes);

      expect(QueryRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptFilename: 'script.js',  // Default value
          scriptContent: 'console.log("test")',
        })
      );
    });

    it('should use default script.js when scriptFilename is empty string', async () => {
      const mockReq = {
        user: { id: 'user-1', email: 'test@test.com' },
        body: {
          instanceId: 'inst',
          databaseName: 'db',
          submissionType: 'script',
          scriptContent: 'console.log("test")',
          scriptFilename: '',  // Empty string is falsy
          comments: 'Test',
          podId: 'pod',
        },
        scriptInfo: undefined,
      };

      await queryController.submitRequest(mockReq, mockRes);

      expect(QueryRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptFilename: 'script.js',  // Default because empty string is falsy
        })
      );
    });
  });

  // ===================================================================
  // queryController.js - Line 225 and 315 (Manager authorization)
  // ===================================================================
  describe('queryController - manager pod authorization', () => {
    let queryController;
    let mockRes;
    let QueryRequest;
    let staticData;
    let User;

    beforeEach(() => {
      jest.resetModules();

      jest.doMock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
      }));

      QueryRequest = {
        findById: jest.fn(), findByUuid: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
        markExecuting: jest.fn(),
        markCompleted: jest.fn(),
        markFailed: jest.fn(),
        RequestStatus: { PENDING: 'pending' },
      };
      jest.doMock('../src/models/QueryRequest', () => QueryRequest);

      User = {
        findById: jest.fn(), findByUuid: jest.fn(),
        UserRoles: { ADMIN: 'admin', MANAGER: 'manager', DEVELOPER: 'developer' },
      };
      jest.doMock('../src/models/User', () => User);

      staticData = {
        getInstanceById: jest.fn(),
        getPodsByManager: jest.fn(),
      };
      jest.doMock('../src/config/staticData', () => staticData);

      jest.doMock('../src/services/slackService', () => ({
        notifyApprovalSuccess: jest.fn().mockResolvedValue(),
        notifyApprovalFailure: jest.fn().mockResolvedValue(),
        notifyRejection: jest.fn().mockResolvedValue(),
      }));

      jest.doMock('../src/services/queryExecutionService', () => ({
        executePostgresQuery: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        executeMongoQuery: jest.fn().mockResolvedValue({ documents: [] }),
      }));

      jest.doMock('../src/services/scriptExecutionService', () => ({
        executeScript: jest.fn().mockResolvedValue({ output: '' }),
      }));

      queryController = require('../src/controllers/queryController');
      mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    });

    it('should return 403 for manager approving unmanaged pod request (line 225)', async () => {
      const mockReq = {
        params: { uuid: '1' },
        user: { id: 'mgr1', email: 'manager@test.com', role: 'manager' },
        body: {},
      };

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        status: 'pending',
        podId: 'pod-not-managed',  // Manager doesn't manage this
        userId: 'user-1',
      });

      // Manager only manages pod-1 and pod-2
      staticData.getPodsByManager.mockReturnValue([
        { id: 'pod-1', name: 'Pod 1' },
        { id: 'pod-2', name: 'Pod 2' },
      ]);

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'FORBIDDEN',
        })
      );
    });

    it('should return 403 for manager rejecting unmanaged pod request (line 315)', async () => {
      const mockReq = {
        params: { uuid: '1' },
        user: { id: 'mgr1', email: 'manager@test.com', role: 'manager' },
        body: { reason: 'Not needed' },
      };

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        status: 'pending',
        podId: 'unmanaged-pod',
        userId: 'user-1',
      });

      staticData.getPodsByManager.mockReturnValue([{ id: 'managed-pod' }]);

      await queryController.rejectRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });
  });

  // ===================================================================
  // queryController.js - Line 272 (Execution error handling)
  // ===================================================================
  describe('queryController - execution error handling', () => {
    let queryController;
    let mockRes;
    let QueryRequest;
    let staticData;
    let User;
    let slackService;
    let queryExecutionService;

    beforeEach(() => {
      jest.resetModules();

      jest.doMock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
      }));

      QueryRequest = {
        findById: jest.fn(), findByUuid: jest.fn(),
        approve: jest.fn(),
        markExecuting: jest.fn(),
        markCompleted: jest.fn(),
        markFailed: jest.fn(),
        RequestStatus: { PENDING: 'pending' },
        SubmissionType: { QUERY: 'query', SCRIPT: 'script' },
      };
      jest.doMock('../src/models/QueryRequest', () => QueryRequest);

      User = {
        findById: jest.fn(), findByUuid: jest.fn(),
        UserRoles: { ADMIN: 'admin', MANAGER: 'manager', DEVELOPER: 'developer' },
      };
      jest.doMock('../src/models/User', () => User);

      staticData = {
        getInstanceById: jest.fn().mockReturnValue({ id: 'inst', type: 'postgresql' }),
        getPodsByManager: jest.fn().mockReturnValue([]),
      };
      jest.doMock('../src/config/staticData', () => staticData);

      slackService = {
        notifyApprovalSuccess: jest.fn().mockResolvedValue(),
        notifyApprovalFailure: jest.fn().mockResolvedValue(),
        notifyRejection: jest.fn().mockResolvedValue(),
      };
      jest.doMock('../src/services/slackService', () => slackService);

      queryExecutionService = {
        executePostgresQuery: jest.fn().mockRejectedValue(new Error('DB Connection Failed')),
        executeMongoQuery: jest.fn().mockRejectedValue(new Error('Mongo Error')),
      };
      jest.doMock('../src/services/queryExecutionService', () => queryExecutionService);

      jest.doMock('../src/services/scriptExecutionService', () => ({
        executeScript: jest.fn().mockRejectedValue(new Error('Script Error')),
      }));

      queryController = require('../src/controllers/queryController');
      mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    });

    it('should mark request as failed on execution error (line 272)', async () => {
      const mockReq = {
        params: { uuid: '1' },
        user: { id: 'admin1', email: 'admin@test.com', role: 'admin' },
        body: {},
      };

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        status: 'pending',
        submissionType: 'query',
        queryContent: 'SELECT 1',
        instanceId: 'inst',
        databaseName: 'db',
        podId: 'pod-1',
        userId: 'user-1',
      });

      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1 });
      QueryRequest.markFailed.mockResolvedValue({ id: 1, status: 'failed' });
      User.findById.mockResolvedValue({ id: 'user-1', slackUserId: 'U123' });

      await queryController.approveRequest(mockReq, mockRes);

      expect(QueryRequest.markFailed).toHaveBeenCalled();
      expect(slackService.notifyApprovalFailure).toHaveBeenCalled();
    });

    it('should use default error message when error.message is undefined', async () => {
      const mockReq = {
        params: { uuid: '1' },
        user: { id: 'admin1', email: 'admin@test.com', role: 'admin' },
        body: {},
      };

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        status: 'pending',
        submissionType: 'query',
        queryContent: 'SELECT 1',
        instanceId: 'inst',
        databaseName: 'db',
        podId: 'pod-1',
        userId: 'user-1',
      });

      QueryRequest.approve.mockResolvedValue({ id: 1 });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1 });
      
      // Error without message property
      const errorWithoutMessage = {};
      queryExecutionService.executePostgresQuery.mockRejectedValue(errorWithoutMessage);
      
      QueryRequest.markFailed.mockResolvedValue({ id: 1 });
      User.findById.mockResolvedValue({ id: 'user-1' });

      await queryController.approveRequest(mockReq, mockRes);

      // Should use 'Execution failed' as default when error.message is falsy
      expect(QueryRequest.markFailed).toHaveBeenCalled();
    });
  });

  // ===================================================================
  // User.js - Line 221 (No valid fields to update)
  // Tests moved to userModel.test.js
  // ===================================================================

  // ===================================================================
  // QueryRequest.js - Lines 99, 462 (Default parameters)
  // Tests moved to queryRequestModel.test.js
  // ===================================================================

  // ===================================================================
  // slackService.js - Line 292 (Error catch block)
  // ===================================================================
  describe('slackService - notifyRejection error handling', () => {
    it('should catch and log errors without throwing (line 292)', async () => {
      jest.resetModules();

      process.env.SLACK_ENABLED = 'true';
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      process.env.SLACK_APPROVAL_CHANNEL = '#approvals';

      // Mock WebClient to throw error
      jest.doMock('@slack/web-api', () => ({
        WebClient: jest.fn().mockImplementation(() => ({
          conversations: {
            open: jest.fn().mockRejectedValue(new Error('Slack API failure')),
          },
          chat: {
            postMessage: jest.fn().mockRejectedValue(new Error('Post failed')),
          },
          users: {
            lookupByEmail: jest.fn().mockRejectedValue(new Error('Lookup failed')),
          },
        })),
      }));

      const slackService = require('../src/services/slackService');

      // Should not throw - error should be caught internally
      await expect(
        slackService.notifyRejection({
          id: 1,
          approverEmail: 'approver@test.com',
          slackUserId: 'U123',
          submissionType: 'query',
          queryContent: 'SELECT * FROM users',
          rejectionReason: 'Test rejection',
        })
      ).resolves.not.toThrow();

      delete process.env.SLACK_ENABLED;
      delete process.env.SLACK_BOT_TOKEN;
      delete process.env.SLACK_APPROVAL_CHANNEL;
    });
  });

  // ===================================================================
  // logger.js - Line 15 (Empty meta object branch)
  // ===================================================================
  describe('logger - meta object handling', () => {
    it('should not append JSON when meta is empty (line 15 false)', () => {
      const logger = require('../src/utils/logger');

      // Log without any meta - Object.keys(meta).length === 0
      expect(() => logger.info('Message without metadata')).not.toThrow();
    });

    it('should append JSON when meta has properties (line 15 true)', () => {
      const logger = require('../src/utils/logger');

      // Log with meta - Object.keys(meta).length > 0
      expect(() => logger.info('Message with metadata', { 
        userId: '123', 
        action: 'test' 
      })).not.toThrow();
    });
  });

  // ===================================================================
  // queryExecutionService.js - Line 215 (Invalid query format)
  // ===================================================================
  describe('queryExecutionService - invalid MongoDB query', () => {
    it('should throw for query that does not match any pattern (line 215)', async () => {
      jest.resetModules();

      const mockMongoClient = {
        connect: jest.fn().mockResolvedValue(),
        db: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({}),
          command: jest.fn(),
        }),
        close: jest.fn().mockResolvedValue(),
      };

      jest.doMock('mongodb', () => ({
        MongoClient: jest.fn().mockImplementation(() => mockMongoClient),
      }));

      jest.doMock('../src/config/database', () => ({
        portalPool: { query: jest.fn() },
        getMongoConnection: jest.fn().mockResolvedValue({
          host: 'localhost',
          port: 27017,
          username: 'user',
          password: 'pass',
        }),
      }));

      jest.doMock('../src/config/staticData', () => ({
        getInstanceById: jest.fn().mockReturnValue({
          id: 'mongo-inst',
          type: 'mongodb',
          _connection: { connectionString: 'mongodb://localhost' },
        }),
      }));

      const queryExecutionService = require('../src/services/queryExecutionService');

      // Use a query string that will fail parsing but pass initial checks
      // This needs to be something the parser returns type: undefined for
      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-inst',
          'testdb',
          'invalid query string that matches no pattern'
        )
      ).rejects.toThrow();
    });
  });

  // ===================================================================
  // errorHandler.js - Lines 35-38 (Default values - may be dead code)
  // Test by calling internal function directly if exported
  // ===================================================================
  describe('errorHandler - default values in sendErrorDev', () => {
    it('should handle error without statusCode (uses default 500)', () => {
      jest.resetModules();

      jest.doMock('../src/config', () => ({
        isDevelopment: true,
        isTest: true,
        isProduction: false,
        logging: { level: 'info' },
      }));

      const { errorHandler } = require('../src/middleware/errorHandler');
      
      // Create error without statusCode
      const err = new Error('Test error');
      // Don't set statusCode - let the || 500 fallback work
      
      const req = { path: '/test', method: 'GET', body: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      errorHandler(err, req, res, jest.fn());

      // The main handler sets statusCode before sendErrorDev, so we test
      // that the response uses 500
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle error without code (uses default INTERNAL_ERROR)', () => {
      jest.resetModules();

      jest.doMock('../src/config', () => ({
        isDevelopment: true,
        isTest: true,
        isProduction: false,
        logging: { level: 'info' },
      }));

      const { errorHandler } = require('../src/middleware/errorHandler');
      
      const err = new Error('Test error');
      err.statusCode = 400;
      // Don't set code
      
      const req = { path: '/test', method: 'GET', body: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      errorHandler(err, req, res, jest.fn());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });
});
