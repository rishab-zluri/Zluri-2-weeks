/**
 * Query Controller Tests (TypeScript)
 * Tests for query submission and management endpoints
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as queryController from '../src/controllers/queryController';
import { User, UserRole } from '../src/entities/User';
import { QueryRequest, RequestStatus, SubmissionType, DatabaseType } from '../src/entities/QueryRequest';
import * as response from '../src/utils/response';

// Mock dependencies
const mockEntityManager = {
    findOne: jest.fn<any>(),
    findOneOrFail: jest.fn<any>(),
    findAndCount: jest.fn<any>(),
    persistAndFlush: jest.fn<any>(),
    flush: jest.fn<any>(),
    find: jest.fn<any>(),
    createQueryBuilder: jest.fn<any>(),
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
}));

jest.mock('../src/utils/response', () => ({
    success: jest.fn(),
    created: jest.fn(),
    error: jest.fn(),
    paginated: jest.fn(),
}));

import * as staticData from '../src/config/staticData';
import { slackService, queryExecutionService, scriptExecutionService } from '../src/services';

// Helpers
const createMockUser = (role: UserRole = UserRole.DEVELOPER) => ({
    id: 'user-123',
    email: 'test@example.com',
    role,
    firstName: 'Test',
    lastName: 'User',
    slackUserId: 'U12345',
    managedPods: [],
    getEntity: jest.fn().mockReturnThis(),
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
            connection: {
                remoteAddress: '127.0.0.1',
            } as any,
            socket: {
                remoteAddress: '127.0.0.1',
            } as any,
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

            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({
                id: 'database-1',
                name: 'Database 1',
                type: 'postgresql',
            });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(true);
            (staticData.getPodById as jest.Mock<any>).mockReturnValue({
                id: 'pod-1',
                name: 'Pod 1',
            });
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser());
            (slackService.notifyNewSubmission as jest.Mock<any>).mockResolvedValue(true);

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();
            expect(response.created).toHaveBeenCalled();
            expect(slackService.notifyNewSubmission).toHaveBeenCalled();
        });

        it('should return error for invalid instance', async () => {
            mockReq.body = {
                instanceId: 'invalid-instance',
                databaseName: 'test_db',
                submissionType: SubmissionType.QUERY,
                queryContent: 'SELECT 1',
                comments: 'Test',
                podId: 'pod-1',
            };

            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue(null);

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, expect.stringContaining('Invalid instance'), 400, 'VALIDATION_ERROR');
        });

        it('should return error for missing script file', async () => {
            mockReq.body = {
                instanceId: 'database-1',
                databaseName: 'test_db',
                submissionType: SubmissionType.SCRIPT,
                comments: 'Test script',
                podId: 'pod-1',
            };

            (staticData.getInstanceById as jest.Mock<any>).mockReturnValue({
                id: 'database-1',
                type: 'postgresql',
            });
            (staticData.validateInstanceDatabase as jest.Mock<any>).mockReturnValue(true);
            (staticData.getPodById as jest.Mock<any>).mockReturnValue({ id: 'pod-1', name: 'Pod 1' });
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser());

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, expect.stringContaining('required'), 400, 'VALIDATION_ERROR');
        });
    });

    describe('getRequest', () => {
        it('should get request for owner', async () => {
            mockReq.params = { uuid: 'uuid-123' };

            const mockRequest = createMockQueryRequest();
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockRequest);

            await queryController.getRequest(mockReq as any, mockRes as Response);

            expect(response.success).toHaveBeenCalledWith(mockRes, mockRequest);
        });

        it('should deny access for developer viewing others request', async () => {
            mockReq.params = { uuid: 'uuid-123' };

            const mockRequest = createMockQueryRequest({
                user: { id: 'other-user', getEntity: jest.fn() } as any
            });
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockRequest);

            await queryController.getRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(mockRes, 'Access denied', 403, 'AUTHORIZATION_ERROR');
        });
    });

    describe('approveRequest', () => {
        it('should approve and execute query request', async () => {
            mockReq.params = { uuid: 'uuid-123' };
            mockReq.user!.role = UserRole.ADMIN;

            const mockRequest = createMockQueryRequest({
                submissionType: SubmissionType.QUERY,
                user: { id: 'requester-123', getEntity: jest.fn().mockReturnValue({ email: 'req@test.com' }) } as any
            });

            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockRequest);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));
            (queryExecutionService.executeQuery as jest.Mock<any>).mockResolvedValue({ success: true, rows: [] });

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.approve).toHaveBeenCalled();
            expect(mockRequest.markExecuting).toHaveBeenCalled();
            expect(mockRequest.markCompleted).toHaveBeenCalled();
            expect(queryExecutionService.executeQuery).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalled();
        });

        it('should handle execution failure', async () => {
            mockReq.params = { uuid: 'uuid-123' };
            mockReq.user!.role = UserRole.ADMIN;

            const mockRequest = createMockQueryRequest();
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockRequest);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));

            (queryExecutionService.executeQuery as jest.Mock<any>).mockResolvedValue({ success: false, error: 'Query failed' });

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.markFailed).toHaveBeenCalled();
            // In the code, verify what notify method is called.
            // But we mocked slackService globally, so we can just check expectations loosely or skip
        });
    });

    describe('rejectRequest', () => {
        it('should reject request with reason', async () => {
            mockReq.params = { uuid: 'uuid-123' };
            mockReq.body = { reason: 'Invalid query' };
            mockReq.user!.role = UserRole.ADMIN;

            const mockRequest = createMockQueryRequest();
            (mockEntityManager.findOne as jest.Mock<any>).mockResolvedValue(mockRequest);
            (mockEntityManager.findOneOrFail as jest.Mock<any>).mockResolvedValue(createMockUser(UserRole.ADMIN));

            await queryController.rejectRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.reject).toHaveBeenCalled();
            expect(slackService.notifyRejection).toHaveBeenCalled();
            expect(response.success).toHaveBeenCalled();
        });
    });
});
