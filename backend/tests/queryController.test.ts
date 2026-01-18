/**
 * Query Controller Tests (TypeScript)
 * Tests for query submission and management endpoints
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as queryController from '../src/controllers/queryController';
import { User, UserRole } from '../src/entities/User';
import { QueryRequest, RequestStatus, SubmissionType, DatabaseType } from '../src/entities/QueryRequest';
import { Pod } from '../src/entities/Pod';
import * as response from '../src/utils/response';

// Mock dependencies
const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    execute: jest.fn<any>(),
};

const mockEntityManager = {
    findOne: jest.fn<any>(),
    findOneOrFail: jest.fn<any>(),
    findAndCount: jest.fn<any>(),
    persistAndFlush: jest.fn<any>(),
    flush: jest.fn<any>(),
    find: jest.fn<any>(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    getConnection: jest.fn().mockReturnValue({
        execute: jest.fn<any>(),
    }),
};

jest.mock('../src/db', () => ({
    getEntityManager: jest.fn(() => mockEntityManager),
}));

jest.mock('../src/config/staticData', () => ({
    getInstanceById: jest.fn<any>(),
    validateInstanceDatabase: jest.fn<any>(),
    getPodById: jest.fn<any>(),
    getPodsByManager: jest.fn<any>(),
    getAllPods: jest.fn<any>(),
    getInstancesByType: jest.fn<any>(),
    getAllInstances: jest.fn<any>(),
    getDatabasesForInstance: jest.fn<any>(),
}));

jest.mock('../src/services', () => ({
    slackService: {
        notifyNewSubmission: jest.fn<any>(),
        notifyApprovalSuccess: jest.fn<any>(),
        notifyApprovalFailure: jest.fn<any>(),
        notifyRejection: jest.fn<any>(),
    },
    queryExecutionService: {
        executeQuery: jest.fn<any>(),
    },
    scriptExecutionService: {
        executeScript: jest.fn<any>(),
    },
    analyzeQuery: jest.fn<any>(),
}));

jest.mock('../src/utils/response', () => ({
    success: jest.fn(),
    created: jest.fn(),
    error: jest.fn(),
    paginated: jest.fn(),
}));

jest.mock('../src/utils/auditLogger', () => ({
    auditLogger: {
        logApproval: jest.fn(),
        logRejection: jest.fn(),
    }
}));

import * as staticData from '../src/config/staticData';
import { slackService, queryExecutionService, scriptExecutionService, analyzeQuery } from '../src/services';

// Helpers
const createMockUser = (role: UserRole = UserRole.DEVELOPER, overrides = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    role,
    firstName: 'Test',
    lastName: 'User',
    slackUserId: 'U12345',
    managedPods: [],
    getEntity: jest.fn().mockReturnThis(),
    ...overrides
} as any);

const createMockQueryRequest = (overrides: Partial<QueryRequest> = {}) => ({
    id: 1,
    uuid: 'uuid-123',
    status: RequestStatus.PENDING,
    user: { id: 'user-123', getEntity: jest.fn().mockReturnValue({ email: 'test@example.com', slackUserId: 'U12345' }) },
    userId: 'user-123',
    podId: 'pod-1',
    podName: 'Pod 1',
    submissionType: SubmissionType.QUERY,
    queryContent: 'SELECT 1',
    approve: jest.fn(),
    reject: jest.fn(),
    markExecuting: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
    createdAt: new Date(),
    instanceName: 'Test Instance',
    databaseName: 'test_db',
    ...overrides,
} as unknown as QueryRequest);

describe('Query Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            body: {},
            params: {},
            query: {},
            headers: {
                'x-forwarded-for': '127.0.0.1',
                'user-agent': 'Jest Test Runner',
            },
            connection: { remoteAddress: '127.0.0.1' } as any,
            socket: { remoteAddress: '127.0.0.1' } as any,
            ip: '127.0.0.1',
            user: createMockUser(),
        };

        mockRes = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn().mockReturnThis() as any,
        };
    });

    describe('submitRequest', () => {
        it('should submit a query request successfully', async () => {
            mockReq.body = {
                instanceId: 'database-1',
                databaseName: 'test_db',
                submissionType: SubmissionType.QUERY,
                queryContent: 'SELECT * FROM users',
                comments: 'Test query',
                podId: 'pod-1',
            };

            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({ id: 'database-1', name: 'Database 1', type: 'postgresql' });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(true);
            (staticData.getPodById as jest.Mock<any>).mockReturnValue({ id: 'pod-1', name: 'Pod 1', manager_email: 'manager@test.com' });
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser());

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
            expect(response.created).toHaveBeenCalled();
            expect(slackService.notifyNewSubmission).toHaveBeenCalled();
        });

        it('should return 400 for invalid instance', async () => {
            mockReq.body = { instanceId: 'bad' } as any;
            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue(null);
            await queryController.submitRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Invalid instance selected', 400, 'VALIDATION_ERROR');
        });

        it('should return 400 for invalid database in instance', async () => {
            mockReq.body = { instanceId: 'db1', databaseName: 'bad' } as any;
            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({ id: 'db1' });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(false);
            await queryController.submitRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Invalid database for this instance', 400, 'VALIDATION_ERROR');
        });

        it('should return 400 for invalid pod', async () => {
            mockReq.body = { instanceId: 'db1', databaseName: 'good', podId: 'bad' } as any;
            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({ id: 'db1' });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(true);
            (staticData.getPodById as jest.Mock<any>).mockReturnValue(null);
            await queryController.submitRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Invalid POD selected', 400, 'VALIDATION_ERROR');
        });

        it('should handle script submission with uploaded file', async () => {
            mockReq.body = { submissionType: SubmissionType.SCRIPT, instanceId: '1', databaseName: 'db', podId: '1', comments: 'c' } as any;
            (mockReq as any).scriptInfo = { filename: 'test.py', content: 'print(1)' };

            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({ id: '1', type: 'mongo' });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(true);
            (staticData.getPodById as jest.Mock<any>).mockReturnValue({ id: '1', manager_email: 'm' });
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser());

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(mockEntityManager.persistAndFlush).toHaveBeenCalledWith(expect.objectContaining({
                scriptFilename: 'test.py',
                scriptContent: 'print(1)'
            }));
            expect(response.created).toHaveBeenCalled();
        });

        it('should handle script submission with content in body', async () => {
            mockReq.body = {
                submissionType: SubmissionType.SCRIPT,
                instanceId: '1', databaseName: 'db', podId: '1', comments: 'c',
                scriptContent: 'print(1)', scriptFilename: 'manual.py'
            } as any;

            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({ id: '1' });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(true);
            (staticData.getPodById as jest.Mock<any>).mockReturnValue({ id: '1' });
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser());

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(mockEntityManager.persistAndFlush).toHaveBeenCalledWith(expect.objectContaining({
                scriptFilename: 'manual.py'
            }));
            expect(response.created).toHaveBeenCalled();
        });

        it('should return 400 if script content missing', async () => {
            mockReq.body = { submissionType: SubmissionType.SCRIPT, instanceId: '1', databaseName: 'db', podId: '1' } as any;
            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({ id: '1' });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(true);
            (staticData.getPodById as jest.Mock<any>).mockReturnValue({ id: '1' });
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser());

            await queryController.submitRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Script file is required', 400, 'VALIDATION_ERROR');
        });

        it('should return 500 on unexpected error', async () => {
            mockReq.body = { instanceId: 'bad' } as any;
            (staticData.getInstanceById as jest.Mock<any>).mockImplementation(() => { throw new Error('fail'); });
            await queryController.submitRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to submit request', 500);
        });
    });

    describe('getRequest', () => {
        it('should get request for owner', async () => {
            mockReq.params = { uuid: 'u1' };
            const req = createMockQueryRequest();
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            await queryController.getRequest(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, req);
        });

        it('should return 404 if not found', async () => {
            mockReq.params = { uuid: 'u1' };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(null);
            await queryController.getRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Request not found', 404, 'NOT_FOUND');
        });

        it('should deny access for developer viewing others request', async () => {
            mockReq.params = { uuid: 'u1' };
            const req = createMockQueryRequest({ user: { id: 'other' } as any });
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            await queryController.getRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Access denied', 403, 'AUTHORIZATION_ERROR');
        });

        it('should allow manager to view request in managed pod', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.MANAGER);
            const req = createMockQueryRequest({ podId: 'pod1', user: { id: 'other' } as any });

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (staticData.getPodsByManager as jest.Mock<any>).mockReturnValue([{ id: 'pod1' }]);

            await queryController.getRequest(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, req);
        });

        it('should deny manager viewing request in unmanaged pod', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.MANAGER);
            const req = createMockQueryRequest({ podId: 'pod2', user: { id: 'other' } as any });

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (staticData.getPodsByManager as jest.Mock<any>).mockReturnValue([{ id: 'pod1' }]);

            await queryController.getRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Access denied', 403, 'AUTHORIZATION_ERROR');
        });

        it('should return 500 on error', async () => {
            (mockEntityManager.findOne as jest.Mock<any>).mockRejectedValue(new Error('fail'));
            await queryController.getRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to get request', 500);
        });
    });

    describe('getAllRequests (and wrappers)', () => {
        it('should get my requests', async () => {
            // Wraps getAllRequests, injecting userId
            await queryController.getMyRequests(mockReq as any, mockRes as Response);
            expect(mockReq.query!.userId).toBe('user-123');
            expect(mockEntityManager.findAndCount).toHaveBeenCalled();
        });

        it('should get pending requests', async () => {
            // Wraps getAllRequests injecting status
            await queryController.getPendingRequests(mockReq as any, mockRes as Response);
            expect(mockReq.query!.status).toBe(RequestStatus.PENDING);
            expect(mockEntityManager.findAndCount).toHaveBeenCalled();
        });

        it('should filter requests generically (admin)', async () => {
            mockReq.user = createMockUser(UserRole.ADMIN);
            mockReq.query = {
                status: 'pending,approved',
                databaseType: 'postgres',
                submissionType: 'query',
                podId: 'pod1',
                search: 'test',
                startDate: '2023-01-01',
                endDate: '2023-01-02'
            };
            (mockEntityManager.findAndCount as jest.Mock<any>).mockResolvedValue([[], 0]);

            await queryController.getAllRequests(mockReq as any, mockRes as Response);

            const where: any = (mockEntityManager.findAndCount as jest.Mock<any>).mock.calls[0][1];
            expect(where.status).toEqual({ $in: ['pending', 'approved'] });
            expect(where.databaseType).toBe('postgres');
            expect(where.podId).toBe('pod1');
            expect(where.$or).toBeDefined(); // Search
            expect(where.createdAt.$gte).toBeDefined();
            expect(where.createdAt.$lte).toBeDefined();
            expect(response.paginated).toHaveBeenCalled();
        });

        it('should enforce manager pod restrictions when filtering', async () => {
            mockReq.user = createMockUser(UserRole.MANAGER);
            (staticData.getPodsByManager as jest.Mock<any>).mockReturnValue([{ id: 'pod1' }]);

            // Case 1: Filter by managed pod
            mockReq.query = { podId: 'pod1' };
            await queryController.getAllRequests(mockReq as any, mockRes as Response);
            expect(((mockEntityManager.findAndCount as jest.Mock<any>).mock.calls[0][1] as any).podId).toBe('pod1');

            // Case 2: Filter by unmanaged pod
            mockReq.query = { podId: 'pod2' };
            await queryController.getAllRequests(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Access denied to this POD', 403, 'AUTHORIZATION_ERROR');

            // Case 3: No specific pod filter -> generic IN clause
            mockReq.query = {};
            (mockEntityManager.findAndCount as jest.Mock<any>).mockClear();
            (mockEntityManager.findAndCount as jest.Mock<any>).mockResolvedValue([[], 0]);
            await queryController.getAllRequests(mockReq as any, mockRes as Response);
            expect(((mockEntityManager.findAndCount as jest.Mock<any>).mock.calls[0][1] as any).podId).toEqual({ $in: ['pod1'] });

            // Case 4: Manager with no pods
            (staticData.getPodsByManager as jest.Mock<any>).mockReturnValue([]);
            await queryController.getAllRequests(mockReq as any, mockRes as Response);
            expect(response.paginated).toHaveBeenCalledWith(mockRes, [], expect.anything());
        });

        it('should exclude own requests if flag set', async () => {
            mockReq.query = { excludeOwnRequests: 'true' };
            (mockEntityManager.findAndCount as jest.Mock<any>).mockResolvedValue([[], 0]);
            await queryController.getAllRequests(mockReq as any, mockRes as Response);
            expect(((mockEntityManager.findAndCount as jest.Mock<any>).mock.calls[0][1] as any).user).toEqual({ $ne: 'user-123' });
        });

        it('should handle comma separated filters for db type and submission type', async () => {
            mockReq.query = { databaseType: 'a,b', submissionType: 'x,y' };
            (mockEntityManager.findAndCount as jest.Mock<any>).mockResolvedValue([[], 0]);
            await queryController.getAllRequests(mockReq as any, mockRes as Response);
            const where: any = (mockEntityManager.findAndCount as jest.Mock<any>).mock.calls[0][1];
            expect(where.databaseType).toEqual({ $in: ['a', 'b'] });
            expect(where.submissionType).toEqual({ $in: ['x', 'y'] });
        });

        it('should return 500 on error', async () => {
            (mockEntityManager.findAndCount as jest.Mock<any>).mockRejectedValue(new Error('fail'));
            await queryController.getAllRequests(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to get requests', 500);
        });
    });

    describe('approveRequest', () => {
        it('should approve and execute query request', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.ADMIN);
            const req = createMockQueryRequest({ submissionType: SubmissionType.QUERY });

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));
            (queryExecutionService.executeQuery as jest.Mock<any>).mockResolvedValue({ success: true });

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(req.approve).toHaveBeenCalled();
            expect(req.markExecuting).toHaveBeenCalled();
            expect(queryExecutionService.executeQuery).toHaveBeenCalled();
            expect(req.markCompleted).toHaveBeenCalled();
            expect(slackService.notifyApprovalSuccess).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalledWith(mockRes, expect.objectContaining({ executionResult: { success: true } }), expect.any(String));
        });

        it('should execute script if type is SCRIPT', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.ADMIN);
            const req = createMockQueryRequest({ submissionType: SubmissionType.SCRIPT });

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));
            (scriptExecutionService.executeScript as jest.Mock<any>).mockResolvedValue({ success: true });

            await queryController.approveRequest(mockReq as any, mockRes as Response);
            expect(scriptExecutionService.executeScript).toHaveBeenCalled();
        });

        it('should handle execution logic failure (success: false return)', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.ADMIN);
            const req = createMockQueryRequest();

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));
            (queryExecutionService.executeQuery as jest.Mock<any>).mockResolvedValue({ success: false, error: 'Logic fail' });

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(req.markFailed).toHaveBeenCalledWith('Logic fail');
            expect(slackService.notifyApprovalSuccess).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalledWith(mockRes, expect.anything(), 'Request approved but execution failed');
        });

        it('should handle exception during execution', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.ADMIN);
            const req = createMockQueryRequest();

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));
            (queryExecutionService.executeQuery as jest.Mock<any>).mockRejectedValue(new Error('Crash'));

            await queryController.approveRequest(mockReq as any, mockRes as Response);
            expect(req.markFailed).toHaveBeenCalledWith('Crash');
            expect(slackService.notifyApprovalFailure).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalledWith(mockRes, req, 'Request approved but execution failed');
        });

        it('should return 404 if request not found', async () => {
            mockReq.params = { uuid: 'u1' };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(null);
            await queryController.approveRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Request not found', 404, 'NOT_FOUND');
        });

        it('should return 400 if request not pending', async () => {
            mockReq.params = { uuid: 'u1' };
            const req = createMockQueryRequest({ status: RequestStatus.APPROVED });
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            await queryController.approveRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Request is not pending approval', 400, 'VALIDATION_ERROR');
        });

        it('should enforce manager authorization', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.MANAGER);
            const req = createMockQueryRequest({ podId: 'pod2' });

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (staticData.getPodsByManager as jest.Mock<any>).mockReturnValue([{ id: 'pod1' }]);

            await queryController.approveRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Not authorized to approve this request', 403, 'AUTHORIZATION_ERROR');
        });

        it('should return 500 on unexpected error', async () => {
            (mockEntityManager.findOne as jest.Mock<any>).mockRejectedValue(new Error('fail'));
            await queryController.approveRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to approve request', 500);
        });
    });

    describe('rejectRequest', () => {
        it('should reject request successfully', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.body = { reason: 'No' };
            mockReq.user = createMockUser(UserRole.ADMIN);
            const req = createMockQueryRequest();

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));

            await queryController.rejectRequest(mockReq as any, mockRes as Response);
            expect(req.reject).toHaveBeenCalled();
            expect(slackService.notifyRejection).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalledWith(mockRes, req, 'Request rejected');
        });

        it('should return 404 if not found', async () => {
            mockReq.params = { uuid: 'u1' };
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(null);
            await queryController.rejectRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Request not found', 404, 'NOT_FOUND');
        });

        it('should return 400 if not pending', async () => {
            mockReq.params = { uuid: 'u1' };
            const req = createMockQueryRequest({ status: RequestStatus.APPROVED });
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            await queryController.rejectRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Request is not pending approval', 400, 'VALIDATION_ERROR');
        });

        it('should enforce manager authorization', async () => {
            mockReq.params = { uuid: 'u1' };
            mockReq.user = createMockUser(UserRole.MANAGER);
            const req = createMockQueryRequest({ podId: 'pod2' });

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (staticData.getPodsByManager as jest.Mock<any>).mockReturnValue([{ id: 'pod1' }]);

            await queryController.rejectRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Not authorized to reject this request', 403, 'AUTHORIZATION_ERROR');
        });

        it('should return 500 on error', async () => {
            (mockEntityManager.findOne as jest.Mock<any>).mockRejectedValue(new Error('fail'));
            await queryController.rejectRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to reject request', 500);
        });
    });

    describe('cloneRequest', () => {
        it('should clone request successfully', async () => {
            mockReq.params = { uuid: 'u1' };
            const req = createMockQueryRequest();
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser());

            await queryController.cloneRequest(mockReq as any, mockRes as Response);
            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
            expect(response.created).toHaveBeenCalled();
            expect(slackService.notifyNewSubmission).toHaveBeenCalled();
        });

        it('should return 403 if cloning others request', async () => {
            mockReq.params = { uuid: 'u1' };
            const req = createMockQueryRequest({ user: { id: 'other' } as any });
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(req);
            await queryController.cloneRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Can only clone your own requests', 403, 'AUTHORIZATION_ERROR');
        });

        it('should return 404 if not found', async () => {
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(null);
            await queryController.cloneRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Request not found', 404, 'NOT_FOUND');
        });

        it('should return 500 on error', async () => {
            (mockEntityManager.findOne as jest.Mock<any>).mockRejectedValue(new Error('fail'));
            await queryController.cloneRequest(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to clone request', 500);
        });
    });

    describe('getMyStatusCounts', () => {
        it('should return status counts', async () => {
            const mockExecute = ((mockEntityManager.getConnection() as any).execute as jest.Mock<any>);
            mockExecute.mockResolvedValue([
                { status: 'pending', count: '5' },
                { status: 'approved', count: '3' }
            ]);

            await queryController.getMyStatusCounts(mockReq as any, mockRes as Response);

            expect(response.success).toHaveBeenCalledWith(mockRes, expect.objectContaining({
                pending: 5,
                approved: 3,
                total: 8
            }));
        });

        it('should return 500 on error', async () => {
            ((mockEntityManager.getConnection() as any).execute as jest.Mock<any>).mockRejectedValue(new Error('fail'));
            await queryController.getMyStatusCounts(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to get status counts', 500);
        });
    });

    describe('getStats', () => {
        it('should return stats', async () => {
            mockQueryBuilder.execute
                .mockResolvedValueOnce([{ status: 'pending', count: '10' }]) // Overall
                .mockResolvedValueOnce([{ pod_id: 'p1', pod_name: 'P1', count: '5' }]) // Pods
                .mockResolvedValueOnce([{ database_type: 'sql', count: '4' }]); // Types

            (mockEntityManager.find as jest.Mock<any>).mockResolvedValue([]); // Recent

            await queryController.getStats(mockReq as any, mockRes as Response);

            expect(response.success).toHaveBeenCalledWith(mockRes, expect.objectContaining({
                overall: { pending: 10 },
                byPod: [{ podId: 'p1', podName: 'P1', count: 5 }],
                byType: [{ type: 'sql', count: 4 }]
            }));
        });

        it('should return 500 on error', async () => {
            mockQueryBuilder.execute.mockRejectedValue(new Error('fail'));
            await queryController.getStats(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to fetch statistics', 500);
        });
    });

    describe('Config getters', () => {
        it('getInstances should return all instances', async () => {
            (staticData.getAllInstances as jest.Mock<any>).mockReturnValue(['i1']);
            await queryController.getInstances(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, ['i1']);
        });

        it('getInstances should filter by type', async () => {
            mockReq.query = { type: 'mongo' };
            (staticData.getInstancesByType as jest.Mock<any>).mockReturnValue(['i2']);
            await queryController.getInstances(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, ['i2']);
        });

        it('getDatabases should return dbs for instance', async () => {
            mockReq.params = { instanceId: 'i1' };
            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({ id: 'i1', name: 'N', type: 'T' });
            (staticData.getDatabasesForInstance as jest.Mock<any>).mockReturnValue(['db1']);

            await queryController.getDatabases(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, expect.objectContaining({ databases: ['db1'] }));
        });

        it('getDatabases should 404 if instance not found', async () => {
            mockReq.params = { instanceId: 'bad' };
            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue(null);
            await queryController.getDatabases(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Instance not found', 404, 'NOT_FOUND');
        });

        it('getPods should return all active pods', async () => {
            (mockEntityManager.find as jest.Mock<any>).mockResolvedValue([{ id: 'p1', name: 'P1', managerEmail: 'm@m.com' }]);
            await queryController.getPods(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, [{ id: 'p1', name: 'P1', manager_email: 'm@m.com' }]);
        });

        it('getPods should return managed pods for approval view', async () => {
            mockReq.query = { forApproval: 'true' };
            mockReq.user = createMockUser(UserRole.MANAGER);
            (mockEntityManager.find as jest.Mock<any>).mockResolvedValue([
                { id: 'p1', name: 'P1', managerEmail: 'test@example.com' }, // Owned
                { id: 'p2', name: 'P2', managerEmail: 'other@m.com' } // Not owned
            ]);

            await queryController.getPods(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, [{ id: 'p1', name: 'P1', manager_email: 'test@example.com' }]);
        });

        it('getPods should return 500 on error', async () => {
            (mockEntityManager.find as jest.Mock<any>).mockRejectedValue(new Error('fail'));
            await queryController.getPods(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to get pods', 500);
        });
    });

    describe('analyzeQueryContent', () => {
        it('should analyze query successfully', async () => {
            mockReq.body = { query: 'SELECT 1', databaseType: 'postgres' };
            (analyzeQuery as jest.Mock<any>).mockReturnValue({ overallRisk: 'low', operations: [] });

            await queryController.analyzeQueryContent(mockReq as any, mockRes as Response);
            expect(response.success).toHaveBeenCalledWith(mockRes, expect.objectContaining({ overallRisk: 'low' }), expect.any(String));
        });

        it('should return 400 for missing fields', async () => {
            mockReq.body = { query: '' } as any;
            await queryController.analyzeQueryContent(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, expect.stringContaining('required'), 400, 'VALIDATION_ERROR');
        });

        it('should return 500 on error', async () => {
            mockReq.body = { query: 'q', databaseType: 't' };
            (analyzeQuery as jest.Mock<any>).mockImplementation(() => { throw new Error('fail'); });
            await queryController.analyzeQueryContent(mockReq as any, mockRes as Response);
            expect(response.error).toHaveBeenCalledWith(mockRes, 'Failed to analyze query', 500);
        });
    });
});
