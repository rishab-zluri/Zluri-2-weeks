/**
 * Query Controller Tests
 * Tests for query submission and management endpoints
 */

// Setup mocks
const mockNotifyNewSubmission = jest.fn().mockResolvedValue();
const mockNotifyApprovalSuccess = jest.fn().mockResolvedValue();
const mockNotifyApprovalFailure = jest.fn().mockResolvedValue();
const mockNotifyRejection = jest.fn().mockResolvedValue();
const mockExecuteQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const mockExecuteScript = jest.fn().mockResolvedValue({ success: true, stdout: '' });

// Mock dependencies
jest.mock('../src/models/QueryRequest');
jest.mock('../src/models/User');
jest.mock('../src/config/staticData');
jest.mock('../src/services', () => ({
  slackService: {
    notifyNewSubmission: (...args) => mockNotifyNewSubmission(...args),
    notifyApprovalSuccess: (...args) => mockNotifyApprovalSuccess(...args),
    notifyApprovalFailure: (...args) => mockNotifyApprovalFailure(...args),
    notifyRejection: (...args) => mockNotifyRejection(...args),
  },
  queryExecutionService: {
    executeQuery: (...args) => mockExecuteQuery(...args),
  },
  scriptExecutionService: {
    executeScript: (...args) => mockExecuteScript(...args),
  },
}));

const QueryRequest = require('../src/models/QueryRequest');
const User = require('../src/models/User');
const staticData = require('../src/config/staticData');
const queryController = require('../src/controllers/queryController');

describe('Query Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock request
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'developer',
        slackUserId: 'U12345',
      },
      scriptInfo: null,
    };

    // Set up mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Set up default mocks
    QueryRequest.RequestStatus = {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      EXECUTING: 'executing',
      COMPLETED: 'completed',
      FAILED: 'failed',
    };

    User.UserRoles = {
      DEVELOPER: 'developer',
      MANAGER: 'manager',
      ADMIN: 'admin',
    };

    // Reset service mocks with default return values
    mockExecuteQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockExecuteScript.mockResolvedValue({ success: true, stdout: '' });
  });

  describe('submitRequest', () => {
    it('should submit a query request successfully', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'query',
        queryContent: 'SELECT * FROM users',
        comments: 'Test query',
        podId: 'pod-1',
      };

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'Database 1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue({
        id: 'pod-1',
        name: 'Pod 1',
      });

      QueryRequest.create.mockResolvedValue({
        id: 1,
        uuid: 'uuid-123',
        status: 'pending',
        createdAt: new Date(),
      });

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        uuid: 'uuid-123',
        userEmail: 'test@example.com',
      });

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockNotifyNewSubmission).toHaveBeenCalled();
    });

    it('should return error for invalid instance', async () => {
      mockReq.body = {
        instanceId: 'invalid-instance',
        databaseName: 'test_db',
        submissionType: 'query',
        queryContent: 'SELECT 1',
        comments: 'Test',
        podId: 'pod-1',
      };

      staticData.getInstanceById.mockReturnValue(null);

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_INSTANCE',
        })
      );
    });

    it('should return error for invalid database', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'invalid_db',
        submissionType: 'query',
        queryContent: 'SELECT 1',
        comments: 'Test',
        podId: 'pod-1',
      };

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(false);

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_DATABASE',
        })
      );
    });

    it('should return error for invalid POD', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'query',
        queryContent: 'SELECT 1',
        comments: 'Test',
        podId: 'invalid-pod',
      };

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue(null);

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_POD',
        })
      );
    });

    it('should return error for missing script file', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'script',
        comments: 'Test script',
        podId: 'pod-1',
      };

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue({ id: 'pod-1', name: 'Pod 1' });

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MISSING_SCRIPT',
        })
      );
    });

    it('should handle script file upload', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'script',
        comments: 'Test script',
        podId: 'pod-1',
      };
      mockReq.scriptInfo = {
        filename: 'test.js',
        content: 'console.log("test")',
      };

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'Database 1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue({ id: 'pod-1', name: 'Pod 1' });
      QueryRequest.create.mockResolvedValue({ id: 1, uuid: 'uuid-123', status: 'pending', createdAt: new Date() });
      QueryRequest.findByUuid.mockResolvedValue({ id: 1 });

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should handle script content from body when no file uploaded', async () => {
      // This tests the else-if branch at lines 73-75
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'script',
        scriptContent: 'console.log("test from body")',
        scriptFilename: 'custom-script.js',
        comments: 'Test script from body',
        podId: 'pod-1',
      };
      // Explicitly don't set scriptInfo (no file upload)
      mockReq.scriptInfo = undefined;

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'Database 1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue({ id: 'pod-1', name: 'Pod 1' });
      QueryRequest.create.mockResolvedValue({ id: 1, uuid: 'uuid-123', status: 'pending', createdAt: new Date() });
      QueryRequest.findByUuid.mockResolvedValue({ id: 1 });

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(QueryRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptFilename: 'custom-script.js',
          scriptContent: 'console.log("test from body")',
        })
      );
    });

    it('should use default filename when scriptContent provided without filename', async () => {
      // This tests the default filename fallback at line 74
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'script',
        scriptContent: 'console.log("test")',
        // No scriptFilename - should default to 'script.js'
        comments: 'Test script',
        podId: 'pod-1',
      };
      mockReq.scriptInfo = undefined;

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'Database 1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue({ id: 'pod-1', name: 'Pod 1' });
      QueryRequest.create.mockResolvedValue({ id: 1, uuid: 'uuid-123', status: 'pending', createdAt: new Date() });
      QueryRequest.findByUuid.mockResolvedValue({ id: 1 });

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(QueryRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptFilename: 'script.js',  // Default filename
          scriptContent: 'console.log("test")',
        })
      );
    });
  });

  describe('getRequest', () => {
    it('should get request for owner', async () => {
      mockReq.params = { id: '1' };

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'user-123',
        status: 'pending',
      });

      await queryController.getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for non-existent request', async () => {
      mockReq.params = { id: '999' };

      QueryRequest.findByUuid.mockResolvedValue(null);

      await queryController.getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should deny access for developer viewing others request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'developer';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'other-user',
        podId: 'pod-1',
      });

      await queryController.getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow manager to view POD request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'manager';
      mockReq.user.email = 'manager@test.com';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'other-user',
        podId: 'pod-1',
      });
      staticData.getPodsByManager.mockReturnValue([{ id: 'pod-1' }]);

      await queryController.getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should deny manager viewing other POD request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'manager';
      mockReq.user.email = 'manager@test.com';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'other-user',
        podId: 'pod-2',
      });
      staticData.getPodsByManager.mockReturnValue([{ id: 'pod-1' }]);

      await queryController.getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getMyRequests', () => {
    it('should get user requests with pagination', async () => {
      mockReq.query = { page: '1', limit: '10' };

      QueryRequest.findByUserId.mockResolvedValue([
        { id: 1, status: 'pending' },
        { id: 2, status: 'completed' },
      ]);
      QueryRequest.count.mockResolvedValue(2);

      await queryController.getMyRequests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.any(Object),
        })
      );
    });

    it('should filter by status', async () => {
      mockReq.query = { status: 'pending' };

      QueryRequest.findByUserId.mockResolvedValue([]);
      QueryRequest.count.mockResolvedValue(0);

      await queryController.getMyRequests(mockReq, mockRes);

      expect(QueryRequest.findByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ status: 'pending' })
      );
    });
  });

  describe('getMyStatusCounts', () => {
    it('should return status counts', async () => {
      QueryRequest.getStatusCountsByUser.mockResolvedValue({
        pending: 5,
        completed: 10,
        total: 15,
      });

      await queryController.getMyStatusCounts(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getPendingRequests', () => {
    it('should get pending requests for admin', async () => {
      mockReq.user.role = 'admin';
      mockReq.query = {};

      staticData.getAllPods.mockReturnValue([
        { id: 'pod-1' },
        { id: 'pod-2' },
      ]);
      QueryRequest.findByPodIds.mockResolvedValue([]);
      QueryRequest.count.mockResolvedValue(0);

      await queryController.getPendingRequests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should get pending requests for manager', async () => {
      mockReq.user.role = 'manager';
      mockReq.user.email = 'manager@test.com';
      mockReq.query = {};

      staticData.getPodsByManager.mockReturnValue([{ id: 'pod-1' }]);
      QueryRequest.findByPodIds.mockResolvedValue([]);
      QueryRequest.count.mockResolvedValue(0);

      await queryController.getPendingRequests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should filter by specific POD', async () => {
      mockReq.user.role = 'admin';
      mockReq.query = { podId: 'pod-1' };

      staticData.getAllPods.mockReturnValue([{ id: 'pod-1' }, { id: 'pod-2' }]);
      QueryRequest.findByPodIds.mockResolvedValue([]);
      QueryRequest.count.mockResolvedValue(0);

      await queryController.getPendingRequests(mockReq, mockRes);

      expect(QueryRequest.findByPodIds).toHaveBeenCalledWith(
        ['pod-1'],
        expect.any(Object)
      );
    });

    it('should deny access to unauthorized POD', async () => {
      mockReq.user.role = 'manager';
      mockReq.query = { podId: 'pod-2' };

      staticData.getPodsByManager.mockReturnValue([{ id: 'pod-1' }]);

      await queryController.getPendingRequests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return empty for manager with no PODs', async () => {
      mockReq.user.role = 'manager';
      mockReq.query = {};

      staticData.getPodsByManager.mockReturnValue([]);

      await queryController.getPendingRequests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [],
        })
      );
    });
  });

  describe('approveRequest', () => {
    it('should approve and execute query request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'requester-123',
        podId: 'pod-1',
        status: 'pending',
        submissionType: 'query',
        queryContent: 'SELECT 1',
      });
      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1, status: 'executing' });
      QueryRequest.markCompleted.mockResolvedValue({ id: 1, status: 'completed' });
      User.findById.mockResolvedValue({ id: 'requester-123', slackUserId: 'U123' });

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockExecuteQuery).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should approve and execute script request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'requester-123',
        podId: 'pod-1',
        status: 'pending',
        submissionType: 'script',
        scriptContent: 'console.log("test")',
      });
      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1, status: 'executing' });
      QueryRequest.markCompleted.mockResolvedValue({ id: 1, status: 'completed' });
      User.findById.mockResolvedValue({ id: 'requester-123', slackUserId: 'U123' });

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockExecuteScript).toHaveBeenCalled();
    });

    it('should handle execution failure', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'requester-123',
        podId: 'pod-1',
        status: 'pending',
        submissionType: 'query',
      });
      QueryRequest.approve.mockResolvedValue({ id: 1 });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1 });
      QueryRequest.markFailed.mockResolvedValue({ id: 1, status: 'failed' });
      User.findById.mockResolvedValue({ id: 'requester-123' });
      mockExecuteQuery.mockRejectedValue(new Error('Query failed'));

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockNotifyApprovalFailure).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should mark as failed when result.success is false', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'requester-123',
        podId: 'pod-1',
        status: 'pending',
        submissionType: 'script',
        scriptContent: 'console.log("test")',
      });
      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1, status: 'executing' });
      QueryRequest.markFailed.mockResolvedValue({ id: 1, status: 'failed' });
      User.findById.mockResolvedValue({ id: 'requester-123', slackUserId: 'U123' });
      
      // Mock script execution returning success: false
      mockExecuteScript.mockResolvedValue({
        success: false,
        error: { type: 'Error', message: 'Column not found' },
        output: [],
      });

      await queryController.approveRequest(mockReq, mockRes);

      expect(QueryRequest.markFailed).toHaveBeenCalledWith(1, 'Column not found');
      expect(mockNotifyApprovalSuccess).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Request approved but execution failed',
        })
      );
    });

    it('should mark as failed with default message when result.success is false without error message', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'requester-123',
        podId: 'pod-1',
        status: 'pending',
        submissionType: 'script',
        scriptContent: 'console.log("test")',
      });
      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1, status: 'executing' });
      QueryRequest.markFailed.mockResolvedValue({ id: 1, status: 'failed' });
      User.findById.mockResolvedValue({ id: 'requester-123', slackUserId: 'U123' });
      
      // Mock script execution returning success: false without error message
      mockExecuteScript.mockResolvedValue({
        success: false,
        output: [],
      });

      await queryController.approveRequest(mockReq, mockRes);

      expect(QueryRequest.markFailed).toHaveBeenCalledWith(1, 'Execution failed');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for non-existent request', async () => {
      mockReq.params = { id: '999' };

      QueryRequest.findByUuid.mockResolvedValue(null);

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return error for non-pending request', async () => {
      mockReq.params = { id: '1' };

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        status: 'completed',
      });

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_STATUS',
        })
      );
    });

    it('should deny manager approving other POD request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'manager';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        podId: 'pod-2',
        status: 'pending',
      });
      staticData.getPodsByManager.mockReturnValue([{ id: 'pod-1' }]);

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('rejectRequest', () => {
    it('should reject request with reason', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { reason: 'Invalid query' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        userId: 'requester-123',
        podId: 'pod-1',
        status: 'pending',
      });
      QueryRequest.reject.mockResolvedValue({
        id: 1,
        status: 'rejected',
        rejectionReason: 'Invalid query',
      });
      User.findById.mockResolvedValue({ id: 'requester-123', slackUserId: 'U123' });

      await queryController.rejectRequest(mockReq, mockRes);

      expect(mockNotifyRejection).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for non-existent request', async () => {
      mockReq.params = { id: '999' };

      QueryRequest.findByUuid.mockResolvedValue(null);

      await queryController.rejectRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should deny manager rejecting other POD request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'manager';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        podId: 'pod-2',
        status: 'pending',
      });
      staticData.getPodsByManager.mockReturnValue([{ id: 'pod-1' }]);

      await queryController.rejectRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('cloneRequest', () => {
    it('should clone request successfully', async () => {
      mockReq.params = { uuid: 'c4e7169b-0aac-4c61-88a2-34a2259f2f43' };

      QueryRequest.findByUuid = jest.fn()
        .mockResolvedValueOnce({
          id: 1,
          userId: 'user-123',
          databaseType: 'postgresql',
          instanceId: 'db-1',
          instanceName: 'DB 1',
          databaseName: 'test_db',
          submissionType: 'query',
          queryContent: 'SELECT 1',
          comments: 'Original comment',
          podId: 'pod-1',
          podName: 'Pod 1',
        })
        .mockResolvedValueOnce({
          id: 2,
          userId: 'user-123',
        });

      QueryRequest.create.mockResolvedValue({
        id: 2,
        uuid: 'new-uuid',
        status: 'pending',
        createdAt: new Date(),
      });

      await queryController.cloneRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 404 for non-existent request', async () => {
      mockReq.params = { uuid: 'non-existent-uuid-1234-5678-90ab-cdef12345678' };

      // Explicitly reset and set findByUuid to return null
      QueryRequest.findByUuid = jest.fn().mockResolvedValue(null);

      await queryController.cloneRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should deny cloning other user request', async () => {
      mockReq.params = { uuid: 'c4e7169b-0aac-4c61-88a2-34a2259f2f43' };

      QueryRequest.findByUuid = jest.fn().mockResolvedValue({
        id: 1,
        userId: 'other-user',
      });

      await queryController.cloneRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getAllRequests', () => {
    it('should get all requests with filters', async () => {
      mockReq.query = {
        status: 'pending',
        podId: 'pod-1',
      };

      QueryRequest.findAll.mockResolvedValue([]);
      QueryRequest.count.mockResolvedValue(0);

      await queryController.getAllRequests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getInstances', () => {
    it('should get all instances', async () => {
      staticData.getAllInstances.mockReturnValue([
        { id: 'db-1', name: 'DB 1', type: 'postgresql' },
      ]);

      await queryController.getInstances(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should filter by type', async () => {
      mockReq.query = { type: 'postgresql' };

      staticData.getInstancesByType.mockReturnValue([
        { id: 'db-1', name: 'DB 1', type: 'postgresql' },
      ]);

      await queryController.getInstances(mockReq, mockRes);

      expect(staticData.getInstancesByType).toHaveBeenCalledWith('postgresql');
    });
  });

  describe('getDatabases', () => {
    it('should get databases for instance', async () => {
      mockReq.params = { instanceId: 'database-1' };

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'DB 1',
        type: 'postgresql',
      });
      staticData.getDatabasesForInstance.mockReturnValue(['db1', 'db2']);

      await queryController.getDatabases(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for non-existent instance', async () => {
      mockReq.params = { instanceId: 'invalid' };

      staticData.getInstanceById.mockReturnValue(null);

      await queryController.getDatabases(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getPods', () => {
    it('should get all pods', async () => {
      staticData.getAllPods.mockReturnValue([
        { id: 'pod-1', name: 'Pod 1' },
        { id: 'pod-2', name: 'Pod 2' },
      ]);

      await queryController.getPods(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return only managed pods for managers when forApproval=true', async () => {
      mockReq.user.role = 'manager';
      mockReq.user.email = 'manager@example.com';
      mockReq.query = { forApproval: 'true' };

      staticData.getPodsByManager.mockReturnValue([
        { id: 'pod-1', name: 'Pod 1' },
      ]);

      await queryController.getPods(mockReq, mockRes);

      expect(staticData.getPodsByManager).toHaveBeenCalledWith('manager@example.com');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ id: 'pod-1', name: 'Pod 1' }],
        })
      );
    });

    it('should return all pods for admin even with forApproval=true', async () => {
      mockReq.user.role = 'admin';
      mockReq.query = { forApproval: 'true' };

      staticData.getAllPods.mockReturnValue([
        { id: 'pod-1', name: 'Pod 1' },
        { id: 'pod-2', name: 'Pod 2' },
      ]);

      await queryController.getPods(mockReq, mockRes);

      expect(staticData.getAllPods).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  // Additional tests for 100% branch coverage
  describe('Branch Coverage - Manager Authorization', () => {
    it('should deny manager approving request from unmanaged pod (line 225)', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'manager';
      mockReq.user.email = 'manager@example.com';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        podId: 'pod-unmanaged',
        status: 'pending',
        userId: 'other-user',
      });
      
      // Manager only manages pod-1, not pod-unmanaged
      staticData.getPodsByManager.mockReturnValue([{ id: 'pod-1' }]);

      await queryController.approveRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin to approve any pod request', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';
      mockReq.user.email = 'admin@example.com';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        podId: 'any-pod',
        status: 'pending',
        userId: 'other-user',
        submissionType: 'query',
        queryContent: 'SELECT 1',
        instanceId: 'db-1',
        databaseName: 'test_db',
      });

      staticData.getInstanceById.mockReturnValue({ id: 'db-1', type: 'postgresql' });
      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1 });
      QueryRequest.markCompleted.mockResolvedValue({ id: 1, status: 'completed' });
      User.findById.mockResolvedValue({ id: 'other-user', slackUserId: 'U123' });

      await queryController.approveRequest(mockReq, mockRes);

      // Admin should not be blocked by pod authorization
      expect(staticData.getPodsByManager).not.toHaveBeenCalled();
    });
  });

  describe('Branch Coverage - Script Content from Body', () => {
    it('should use scriptContent from body when scriptInfo is undefined (line 73)', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'script',
        scriptContent: 'console.log("body script")',
        scriptFilename: 'myscript.js',
        comments: 'Test script from body',
        podId: 'pod-1',
      };
      // Explicitly set scriptInfo to undefined/falsy
      mockReq.scriptInfo = null;

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'Database 1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue({ id: 'pod-1', name: 'Pod 1' });
      QueryRequest.create.mockResolvedValue({ id: 1, uuid: 'uuid-123', status: 'pending', createdAt: new Date() });
      QueryRequest.findByUuid.mockResolvedValue({ id: 1 });

      await queryController.submitRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(QueryRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptFilename: 'myscript.js',
          scriptContent: 'console.log("body script")',
        })
      );
    });

    it('should use empty string filename with fallback to script.js (line 73 || branch)', async () => {
      mockReq.body = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        submissionType: 'script',
        scriptContent: 'console.log("test")',
        scriptFilename: '', // Empty string should trigger || 'script.js'
        comments: 'Test',
        podId: 'pod-1',
      };
      mockReq.scriptInfo = undefined;

      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'Database 1',
        type: 'postgresql',
      });
      staticData.validateInstanceDatabase.mockReturnValue(true);
      staticData.getPodById.mockReturnValue({ id: 'pod-1', name: 'Pod 1' });
      QueryRequest.create.mockResolvedValue({ id: 1, uuid: 'uuid-123', status: 'pending', createdAt: new Date() });
      QueryRequest.findByUuid.mockResolvedValue({ id: 1 });

      await queryController.submitRequest(mockReq, mockRes);

      expect(QueryRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptFilename: 'script.js', // Should fall back to default
        })
      );
    });
  });

  describe('Branch Coverage - Execution Failure', () => {
    it('should mark request as failed when execution throws error (line 272)', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        podId: 'pod-1',
        status: 'pending',
        userId: 'user-123',
        submissionType: 'query',
        queryContent: 'SELECT * FROM broken_table',
        instanceId: 'db-1',
        databaseName: 'test_db',
      });

      staticData.getInstanceById.mockReturnValue({ id: 'db-1', type: 'postgresql' });
      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1, status: 'executing' });
      
      // Make execution fail
      mockExecuteQuery.mockRejectedValue(new Error('Database connection timeout'));
      
      QueryRequest.markFailed.mockResolvedValue({ id: 1, status: 'failed', executionResult: 'Database connection timeout' });
      User.findById.mockResolvedValue({ id: 'user-123', slackUserId: 'U12345' });

      await queryController.approveRequest(mockReq, mockRes);

      expect(QueryRequest.markFailed).toHaveBeenCalledWith(1, 'Database connection timeout');
      expect(mockNotifyApprovalFailure).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should use default error message when error has no message (line 272)', async () => {
      mockReq.params = { id: '1' };
      mockReq.user.role = 'admin';

      QueryRequest.findByUuid.mockResolvedValue({
        id: 1,
        podId: 'pod-1',
        status: 'pending',
        userId: 'user-123',
        submissionType: 'query',
        queryContent: 'SELECT 1',
        instanceId: 'db-1',
        databaseName: 'test_db',
      });

      staticData.getInstanceById.mockReturnValue({ id: 'db-1', type: 'postgresql' });
      QueryRequest.approve.mockResolvedValue({ id: 1, status: 'approved' });
      QueryRequest.markExecuting.mockResolvedValue({ id: 1 });
      
      // Error without message
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      mockExecuteQuery.mockRejectedValue(errorWithoutMessage);
      
      QueryRequest.markFailed.mockResolvedValue({ id: 1, status: 'failed' });
      User.findById.mockResolvedValue({ id: 'user-123', slackUserId: 'U12345' });

      await queryController.approveRequest(mockReq, mockRes);

      expect(QueryRequest.markFailed).toHaveBeenCalledWith(1, 'Execution failed');
    });
  });
});
