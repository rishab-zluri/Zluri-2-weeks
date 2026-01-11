/**
 * QueryRequest Model Tests
 * Tests for query request CRUD operations and status management
 */

// Mock the database module
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const { query } = require('../src/config/database');
const QueryRequest = require('../src/models/QueryRequest');
const { DatabaseError, NotFoundError } = require('../src/utils/errors');

describe('QueryRequest Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should have correct RequestStatus values', () => {
      expect(QueryRequest.RequestStatus.PENDING).toBe('pending');
      expect(QueryRequest.RequestStatus.APPROVED).toBe('approved');
      expect(QueryRequest.RequestStatus.REJECTED).toBe('rejected');
      expect(QueryRequest.RequestStatus.EXECUTING).toBe('executing');
      expect(QueryRequest.RequestStatus.COMPLETED).toBe('completed');
      expect(QueryRequest.RequestStatus.FAILED).toBe('failed');
    });

    it('should have correct SubmissionType values', () => {
      expect(QueryRequest.SubmissionType.QUERY).toBe('query');
      expect(QueryRequest.SubmissionType.SCRIPT).toBe('script');
    });

    it('should have correct DatabaseType values', () => {
      expect(QueryRequest.DatabaseType.POSTGRESQL).toBe('postgresql');
      expect(QueryRequest.DatabaseType.MONGODB).toBe('mongodb');
    });
  });

  describe('createTable', () => {
    it('should create table successfully', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      
      await expect(QueryRequest.createTable()).resolves.not.toThrow();
      expect(query).toHaveBeenCalled();
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));
      
      await expect(QueryRequest.createTable()).rejects.toThrow(DatabaseError);
    });
  });

  describe('create', () => {
    const requestData = {
      userId: 'user-123',
      databaseType: 'postgresql',
      instanceId: 'db-1',
      instanceName: 'Database 1',
      databaseName: 'test_db',
      submissionType: 'query',
      queryContent: 'SELECT * FROM users',
      comments: 'Test query',
      podId: 'pod-1',
      podName: 'Pod 1',
    };

    it('should create a request successfully', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          uuid: 'uuid-123',
          user_id: 'user-123',
          database_type: 'postgresql',
          instance_id: 'db-1',
          instance_name: 'Database 1',
          database_name: 'test_db',
          submission_type: 'query',
          query_content: 'SELECT * FROM users',
          comments: 'Test query',
          pod_id: 'pod-1',
          pod_name: 'Pod 1',
          status: 'pending',
          created_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await QueryRequest.create(requestData);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('status', 'pending');
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.create(requestData)).rejects.toThrow(DatabaseError);
    });

    it('should accept null for optional fields (queryContent, scriptFilename, scriptContent) - line 99', async () => {
      // Test the default parameters: queryContent = null, scriptFilename = null, scriptContent = null
      const scriptRequestData = {
        userId: 'user-123',
        databaseType: 'postgresql',
        instanceId: 'db-1',
        instanceName: 'Database 1',
        databaseName: 'test_db',
        submissionType: 'script',
        queryContent: null,       // Explicit null
        scriptFilename: null,     // Explicit null (default)
        scriptContent: null,      // Explicit null (default)
        comments: 'Test script',
        podId: 'pod-1',
        podName: 'Pod 1',
      };

      const mockResult = {
        rows: [{
          id: 2,
          uuid: 'uuid-456',
          user_id: 'user-123',
          database_type: 'postgresql',
          instance_id: 'db-1',
          instance_name: 'Database 1',
          database_name: 'test_db',
          submission_type: 'script',
          query_content: null,
          script_filename: null,
          script_content: null,
          comments: 'Test script',
          pod_id: 'pod-1',
          pod_name: 'Pod 1',
          status: 'pending',
          created_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await QueryRequest.create(scriptRequestData);

      expect(result).toHaveProperty('id', 2);
      expect(result.queryContent).toBeNull();
      expect(result.scriptFilename).toBeNull();
      expect(result.scriptContent).toBeNull();
    });
  });

  describe('findById', () => {
    const mockRow = {
      id: 1,
      uuid: 'uuid-123',
      user_id: 'user-123',
      user_email: 'test@example.com',
      user_name: 'Test User',
      database_type: 'postgresql',
      instance_id: 'db-1',
      instance_name: 'Database 1',
      database_name: 'test_db',
      submission_type: 'query',
      query_content: 'SELECT * FROM users',
      script_filename: null,
      script_content: null,
      comments: 'Test query',
      pod_id: 'pod-1',
      pod_name: 'Pod 1',
      status: 'pending',
      approver_id: null,
      approver_email: null,
      approved_at: null,
      rejection_reason: null,
      execution_result: null,
      execution_error: null,
      execution_started_at: null,
      execution_completed_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should find request by ID', async () => {
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.findById(1);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('userEmail', 'test@example.com');
    });

    it('should return null when not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await QueryRequest.findById(999);

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.findById(1)).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByUuid', () => {
    it('should find request by UUID', async () => {
      const mockRow = {
        id: 1,
        uuid: 'uuid-123',
        user_id: 'user-123',
        user_email: 'test@example.com',
        user_name: 'Test User',
        database_type: 'postgresql',
        instance_id: 'db-1',
        instance_name: 'Database 1',
        database_name: 'test_db',
        submission_type: 'query',
        query_content: 'SELECT *',
        comments: 'Test',
        pod_id: 'pod-1',
        pod_name: 'Pod 1',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      };
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.findByUuid('uuid-123');

      expect(result).toHaveProperty('uuid', 'uuid-123');
    });

    it('should return null when not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await QueryRequest.findByUuid('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.findByUuid('uuid-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByUserId', () => {
    it('should find requests by user ID', async () => {
      const mockRows = [
        { id: 1, uuid: 'uuid-1', user_id: 'user-123', user_email: 'test@test.com', user_name: 'Test', database_type: 'postgresql', instance_id: 'db-1', instance_name: 'DB', database_name: 'test', submission_type: 'query', query_content: 'SELECT', comments: 'Test', pod_id: 'pod-1', pod_name: 'Pod 1', status: 'pending', created_at: new Date(), updated_at: new Date() },
        { id: 2, uuid: 'uuid-2', user_id: 'user-123', user_email: 'test@test.com', user_name: 'Test', database_type: 'postgresql', instance_id: 'db-1', instance_name: 'DB', database_name: 'test', submission_type: 'query', query_content: 'SELECT', comments: 'Test', pod_id: 'pod-1', pod_name: 'Pod 1', status: 'completed', created_at: new Date(), updated_at: new Date() },
      ];
      query.mockResolvedValueOnce({ rows: mockRows });

      const result = await QueryRequest.findByUserId('user-123');

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await QueryRequest.findByUserId('user-123', { status: 'pending' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        expect.arrayContaining(['user-123', 'pending'])
      );
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.findByUserId('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByPodIds', () => {
    it('should find requests by POD IDs', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await QueryRequest.findByPodIds(['pod-1', 'pod-2']);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('pod_id = ANY($1)'),
        expect.arrayContaining([['pod-1', 'pod-2']])
      );
    });

    it('should filter by status', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await QueryRequest.findByPodIds(['pod-1'], { status: 'pending' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        expect.any(Array)
      );
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.findByPodIds(['pod-1'])).rejects.toThrow(DatabaseError);
    });
  });

  describe('findAll', () => {
    it('should find all requests', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await QueryRequest.findAll();

      expect(query).toHaveBeenCalled();
    });

    it('should apply all filters', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await QueryRequest.findAll({
        status: 'pending',
        podId: 'pod-1',
        userId: 'user-123',
        databaseType: 'postgresql',
        submissionType: 'query',
        search: 'test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        limit: 10,
        offset: 0,
      });

      const callArgs = query.mock.calls[0];
      expect(callArgs[0]).toContain('status = $1');
      expect(callArgs[0]).toContain('pod_id = $2');
      expect(callArgs[0]).toContain('user_id = $3');
      expect(callArgs[0]).toContain('database_type = $4');
      expect(callArgs[0]).toContain('submission_type = $5');
      expect(callArgs[0]).toContain('ILIKE');
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.findAll()).rejects.toThrow(DatabaseError);
    });
  });

  describe('count', () => {
    it('should count all requests', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '25' }] });

      const result = await QueryRequest.count();

      expect(result).toBe(25);
    });

    it('should count with filters', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await QueryRequest.count({ status: 'pending', podId: 'pod-1' });

      expect(result).toBe(5);
    });

    it('should count with podIds', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      await QueryRequest.count({ podIds: ['pod-1', 'pod-2'] });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('pod_id = ANY($1)'),
        expect.any(Array)
      );
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.count()).rejects.toThrow(DatabaseError);
    });
  });

  describe('updateStatus', () => {
    const mockRow = {
      id: 1,
      uuid: 'uuid-123',
      user_id: 'user-123',
      database_type: 'postgresql',
      instance_id: 'db-1',
      instance_name: 'Database 1',
      database_name: 'test_db',
      submission_type: 'query',
      query_content: 'SELECT *',
      comments: 'Test',
      pod_id: 'pod-1',
      pod_name: 'Pod 1',
      status: 'approved',
      approver_id: 'approver-123',
      approver_email: 'approver@test.com',
      approved_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should update status successfully', async () => {
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.updateStatus(1, 'approved', {
        approverId: 'approver-123',
        approverEmail: 'approver@test.com',
      });

      expect(result).toHaveProperty('status', 'approved');
    });

    it('should throw NotFoundError when not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(QueryRequest.updateStatus(999, 'approved')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other errors', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.updateStatus(1, 'approved')).rejects.toThrow(DatabaseError);
    });
  });

  describe('approve', () => {
    it('should approve request', async () => {
      const mockRow = {
        id: 1, uuid: 'uuid-123', user_id: 'user-123', database_type: 'postgresql',
        instance_id: 'db-1', instance_name: 'DB', database_name: 'test',
        submission_type: 'query', query_content: 'SELECT', comments: 'Test',
        pod_id: 'pod-1', pod_name: 'Pod 1', status: 'approved',
        approver_id: 'approver-123', approver_email: 'approver@test.com',
        approved_at: new Date(), created_at: new Date(), updated_at: new Date(),
      };
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.approve(1, 'approver-123', 'approver@test.com');

      expect(result).toHaveProperty('status', 'approved');
    });
  });

  describe('reject', () => {
    it('should reject request with reason', async () => {
      const mockRow = {
        id: 1, uuid: 'uuid-123', user_id: 'user-123', database_type: 'postgresql',
        instance_id: 'db-1', instance_name: 'DB', database_name: 'test',
        submission_type: 'query', query_content: 'SELECT', comments: 'Test',
        pod_id: 'pod-1', pod_name: 'Pod 1', status: 'rejected',
        approver_id: 'approver-123', approver_email: 'approver@test.com',
        rejection_reason: 'Invalid query', created_at: new Date(), updated_at: new Date(),
      };
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.reject(1, 'approver-123', 'approver@test.com', 'Invalid query');

      expect(result).toHaveProperty('status', 'rejected');
      expect(result).toHaveProperty('rejectionReason', 'Invalid query');
    });

    it('should reject request without reason (uses default null)', async () => {
      // Line 462: reason = null default parameter
      const mockRow = {
        id: 1, uuid: 'uuid-123', user_id: 'user-123', database_type: 'postgresql',
        instance_id: 'db-1', instance_name: 'DB', database_name: 'test',
        submission_type: 'query', query_content: 'SELECT', comments: 'Test',
        pod_id: 'pod-1', pod_name: 'Pod 1', status: 'rejected',
        approver_id: 'approver-123', approver_email: 'approver@test.com',
        rejection_reason: null, created_at: new Date(), updated_at: new Date(),
      };
      query.mockResolvedValueOnce({ rows: [mockRow] });

      // Call without the optional reason parameter - should use default null
      const result = await QueryRequest.reject(1, 'approver-123', 'approver@test.com');

      expect(result).toHaveProperty('status', 'rejected');
      expect(result.rejectionReason).toBeNull();
      
      // Verify null was passed to the query
      expect(query).toHaveBeenCalled();
      const queryCall = query.mock.calls[0];
      expect(queryCall[1]).toContain(null); // rejection_reason should be null
    });
  });

  describe('markExecuting', () => {
    it('should mark request as executing', async () => {
      const mockRow = {
        id: 1, uuid: 'uuid-123', user_id: 'user-123', database_type: 'postgresql',
        instance_id: 'db-1', instance_name: 'DB', database_name: 'test',
        submission_type: 'query', query_content: 'SELECT', comments: 'Test',
        pod_id: 'pod-1', pod_name: 'Pod 1', status: 'executing',
        execution_started_at: new Date(), created_at: new Date(), updated_at: new Date(),
      };
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.markExecuting(1);

      expect(result).toHaveProperty('status', 'executing');
    });
  });

  describe('markCompleted', () => {
    it('should mark request as completed with result', async () => {
      const mockRow = {
        id: 1, uuid: 'uuid-123', user_id: 'user-123', database_type: 'postgresql',
        instance_id: 'db-1', instance_name: 'DB', database_name: 'test',
        submission_type: 'query', query_content: 'SELECT', comments: 'Test',
        pod_id: 'pod-1', pod_name: 'Pod 1', status: 'completed',
        execution_result: '{"rows": []}', execution_completed_at: new Date(),
        created_at: new Date(), updated_at: new Date(),
      };
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.markCompleted(1, '{"rows": []}');

      expect(result).toHaveProperty('status', 'completed');
    });
  });

  describe('markFailed', () => {
    it('should mark request as failed with error', async () => {
      const mockRow = {
        id: 1, uuid: 'uuid-123', user_id: 'user-123', database_type: 'postgresql',
        instance_id: 'db-1', instance_name: 'DB', database_name: 'test',
        submission_type: 'query', query_content: 'SELECT', comments: 'Test',
        pod_id: 'pod-1', pod_name: 'Pod 1', status: 'failed',
        execution_error: 'Connection timeout', execution_completed_at: new Date(),
        created_at: new Date(), updated_at: new Date(),
      };
      query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await QueryRequest.markFailed(1, 'Connection timeout');

      expect(result).toHaveProperty('status', 'failed');
    });
  });

  describe('getStatusCountsByUser', () => {
    it('should get status counts', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { status: 'pending', count: '5' },
          { status: 'completed', count: '10' },
          { status: 'failed', count: '2' },
        ],
      });

      const result = await QueryRequest.getStatusCountsByUser('user-123');

      expect(result).toHaveProperty('pending', 5);
      expect(result).toHaveProperty('completed', 10);
      expect(result).toHaveProperty('failed', 2);
      expect(result).toHaveProperty('total', 17);
    });

    it('should return zeros when no data', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await QueryRequest.getStatusCountsByUser('user-123');

      expect(result.total).toBe(0);
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(QueryRequest.getStatusCountsByUser('user-123')).rejects.toThrow(DatabaseError);
    });
  });
});
