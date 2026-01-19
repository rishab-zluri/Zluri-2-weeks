/**
 * Additional Query Controller Tests
 * Focus on uncovered branches and error paths to increase coverage
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as queryController from '../../src/controllers/queryController';
import * as staticData from '../../src/config/staticData';
import { databaseSyncService, slackService, queryExecutionService, scriptExecutionService } from '../../src/services';
import * as response from '../../src/utils/response';
import { QueryRequest, RequestStatus, SubmissionType, DatabaseType } from '../../src/entities/QueryRequest';
import { User, UserRole } from '../../src/entities/User';
import { ValidationError } from '../../src/utils/errors';

// Mock dependencies
jest.mock('../../src/db', () => ({
    getEntityManager: jest.fn(),
    getORM: jest.fn()
}));
jest.mock('../../src/config/staticData');
jest.mock('../../src/services');
jest.mock('../../src/utils/response');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/auditLogger');

import { getEntityManager } from '../../src/db';

describe('Query Controller - Additional Coverage', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockEm: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            cookie: jest.fn(),
        } as any;

        mockReq = {
            body: {},
            params: {},
            query: {},
            user: {
                id: 'user-1',
                email: 'test@example.com',
                role: UserRole.DEVELOPER
            } as any,
            headers: {},
            ip: '127.0.0.1'
        };

        mockEm = {
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            persistAndFlush: jest.fn(),
            flush: jest.fn(),
            getConnection: jest.fn()
        };

        (getEntityManager as jest.Mock).mockReturnValue(mockEm);
    });

    describe('submitRequest - Error Paths', () => {
        const validBody = {
            instanceId: 'instance-1',
            databaseName: 'test_db',
            submissionType: SubmissionType.QUERY,
            queryContent: 'SELECT * FROM users',
            comments: 'Test query',
            podId: 'pod-1'
        };

        it('should fail when instance not found', async () => {
            mockReq.body = validBody;
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue(null);

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Invalid instance selected',
                400,
                'VALIDATION_ERROR'
            );
        });

        it('should fail when database not synced for instance', async () => {
            mockReq.body = validBody;
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({
                id: 'instance-1',
                name: 'Test Instance',
                type: 'postgres'
            } as any);
            jest.mocked(databaseSyncService.getDatabasesForInstance).mockResolvedValue([
                { name: 'other_db' } as any
            ]);

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Invalid database for this instance',
                400,
                'VALIDATION_ERROR'
            );
        });

        it('should fail when POD not found', async () => {
            mockReq.body = validBody;
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({
                id: 'instance-1',
                name: 'Test Instance',
                type: 'postgres'
            } as any);
            jest.mocked(databaseSyncService.getDatabasesForInstance).mockResolvedValue([
                { name: 'test_db' } as any
            ]);
            jest.mocked(staticData.getPodById).mockReturnValue(null);

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Invalid POD selected',
                400,
                'VALIDATION_ERROR'
            );
        });

        it('should fail when script submission missing script file', async () => {
            mockReq.body = {
                ...validBody,
                submissionType: SubmissionType.SCRIPT,
                queryContent: undefined
            };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({
                id: 'instance-1',
                name: 'Test Instance',
                type: 'postgres'
            } as any);
            jest.mocked(databaseSyncService.getDatabasesForInstance).mockResolvedValue([
                { name: 'test_db' } as any
            ]);
            jest.mocked(staticData.getPodById).mockReturnValue({
                id: 'pod-1',
                name: 'Test Pod',
                manager_email: 'manager@test.com'
            } as any);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'user-1' });

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Script file is required',
                400,
                'VALIDATION_ERROR'
            );
        });

        it('should handle script submission with scriptContent in body', async () => {
            mockReq.body = {
                ...validBody,
                submissionType: SubmissionType.SCRIPT,
                scriptContent: 'console.log("test")',
                scriptFilename: 'test.js'
            };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({
                id: 'instance-1',
                name: 'Test Instance',
                type: 'postgres'
            } as any);
            jest.mocked(databaseSyncService.getDatabasesForInstance).mockResolvedValue([
                { name: 'test_db' } as any
            ]);
            jest.mocked(staticData.getPodById).mockReturnValue({
                id: 'pod-1',
                name: 'Test Pod',
                manager_email: 'manager@test.com'
            } as any);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'user-1' });
            jest.mocked(slackService.notifyNewSubmission).mockResolvedValue(undefined);

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(mockEm.persistAndFlush).toHaveBeenCalled();
            expect(response.created).toHaveBeenCalled();
        });

        it('should handle script submission with scriptInfo', async () => {
            mockReq.body = {
                ...validBody,
                submissionType: SubmissionType.SCRIPT
            };
            (mockReq as any).scriptInfo = {
                filename: 'uploaded.js',
                content: 'console.log("uploaded")'
            };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({
                id: 'instance-1',
                name: 'Test Instance',
                type: 'postgres'
            } as any);
            jest.mocked(databaseSyncService.getDatabasesForInstance).mockResolvedValue([
                { name: 'test_db' } as any
            ]);
            jest.mocked(staticData.getPodById).mockReturnValue({
                id: 'pod-1',
                name: 'Test Pod',
                manager_email: 'manager@test.com'
            } as any);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'user-1' });
            jest.mocked(slackService.notifyNewSubmission).mockResolvedValue(undefined);

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(mockEm.persistAndFlush).toHaveBeenCalled();
            expect(response.created).toHaveBeenCalled();
        });

        it('should handle database errors', async () => {
            mockReq.body = validBody;
            jest.mocked(databaseSyncService.getInstanceById).mockRejectedValue(new Error('DB Error'));

            await queryController.submitRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Failed to submit request',
                500
            );
        });
    });

    describe('getRequest - Authorization Paths', () => {
        it('should deny access for developer viewing other user request', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'user-2',
                email: 'other@test.com',
                role: UserRole.DEVELOPER
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                user: { id: 'user-1' }
            };
            mockEm.findOne.mockResolvedValue(mockRequest);

            await queryController.getRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Access denied',
                403,
                'AUTHORIZATION_ERROR'
            );
        });

        it('should deny access for manager not managing the POD', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'manager-1',
                email: 'manager@test.com',
                role: UserRole.MANAGER
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                user: { id: 'user-1' },
                podId: 'pod-2'
            };
            mockEm.findOne.mockResolvedValue(mockRequest);
            jest.mocked(staticData.getPodsByManager).mockReturnValue([
                { id: 'pod-1', name: 'Pod 1' }
            ] as any);

            await queryController.getRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Access denied',
                403,
                'AUTHORIZATION_ERROR'
            );
        });

        it('should allow manager to view their own request even if not managing POD', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'manager-1',
                email: 'manager@test.com',
                role: UserRole.MANAGER
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                user: { id: 'manager-1' },
                podId: 'pod-2'
            };
            mockEm.findOne.mockResolvedValue(mockRequest);
            jest.mocked(staticData.getPodsByManager).mockReturnValue([
                { id: 'pod-1', name: 'Pod 1' }
            ] as any);

            await queryController.getRequest(mockReq as any, mockRes as Response);

            expect(response.success).toHaveBeenCalledWith(mockRes, mockRequest);
        });

        it('should handle request not found', async () => {
            mockReq.params = { uuid: 'nonexistent' };
            mockEm.findOne.mockResolvedValue(null);

            await queryController.getRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Request not found',
                404,
                'NOT_FOUND'
            );
        });

        it('should handle database errors', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockEm.findOne.mockRejectedValue(new Error('DB Error'));

            await queryController.getRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Failed to get request',
                500
            );
        });
    });

    // Note: getMyStatusCounts tests removed due to TypeScript mock typing issues
    // The function is already tested in the main test suite

    describe('approveRequest - Error Paths', () => {
        it('should fail when request not found', async () => {
            mockReq.params = { uuid: 'nonexistent' };
            mockEm.findOne.mockResolvedValue(null);

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Request not found',
                404,
                'NOT_FOUND'
            );
        });

        it('should fail when request not pending', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            const mockRequest = {
                uuid: 'test-uuid',
                status: RequestStatus.APPROVED
            };
            mockEm.findOne.mockResolvedValue(mockRequest);

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Request is not pending approval',
                400,
                'VALIDATION_ERROR'
            );
        });

        it('should handle query execution failure with error object', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'admin-1',
                email: 'admin@test.com',
                role: UserRole.ADMIN
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                id: 1,
                status: RequestStatus.PENDING,
                submissionType: SubmissionType.QUERY,
                user: {
                    id: 'user-1',
                    getEntity: () => ({ email: 'user@test.com', slackUserId: 'U123' })
                },
                approve: jest.fn(),
                markExecuting: jest.fn(),
                markFailed: jest.fn(),
                podId: 'pod-1'
            };
            mockEm.findOne.mockResolvedValue(mockRequest);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'admin-1' });

            jest.mocked(queryExecutionService.executeQuery).mockResolvedValue({
                success: false,
                error: { message: 'Syntax error' }
            } as any);

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.markFailed).toHaveBeenCalledWith('Syntax error');
            expect(slackService.notifyApprovalFailure).toHaveBeenCalled();
        });

        it('should handle query execution failure with string error', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'admin-1',
                email: 'admin@test.com',
                role: UserRole.ADMIN
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                id: 1,
                status: RequestStatus.PENDING,
                submissionType: SubmissionType.QUERY,
                user: {
                    id: 'user-1',
                    getEntity: () => ({ email: 'user@test.com' })
                },
                approve: jest.fn(),
                markExecuting: jest.fn(),
                markFailed: jest.fn(),
                podId: 'pod-1'
            };
            mockEm.findOne.mockResolvedValue(mockRequest);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'admin-1' });

            jest.mocked(queryExecutionService.executeQuery).mockResolvedValue({
                success: false,
                error: 'Connection timeout'
            } as any);

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.markFailed).toHaveBeenCalledWith('Connection timeout');
        });

        it('should handle query execution failure with message field', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'admin-1',
                email: 'admin@test.com',
                role: UserRole.ADMIN
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                id: 1,
                status: RequestStatus.PENDING,
                submissionType: SubmissionType.QUERY,
                user: {
                    id: 'user-1',
                    getEntity: () => ({ email: 'user@test.com' })
                },
                approve: jest.fn(),
                markExecuting: jest.fn(),
                markFailed: jest.fn(),
                podId: 'pod-1'
            };
            mockEm.findOne.mockResolvedValue(mockRequest);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'admin-1' });

            jest.mocked(queryExecutionService.executeQuery).mockResolvedValue({
                success: false,
                message: 'Invalid query format'
            } as any);

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.markFailed).toHaveBeenCalledWith('Invalid query format');
        });

        it('should handle script execution failure', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'admin-1',
                email: 'admin@test.com',
                role: UserRole.ADMIN
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                id: 1,
                status: RequestStatus.PENDING,
                submissionType: SubmissionType.SCRIPT,
                user: {
                    id: 'user-1',
                    getEntity: () => ({ email: 'user@test.com' })
                },
                approve: jest.fn(),
                markExecuting: jest.fn(),
                markFailed: jest.fn(),
                podId: 'pod-1'
            };
            mockEm.findOne.mockResolvedValue(mockRequest);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'admin-1' });

            jest.mocked(scriptExecutionService.executeScript).mockResolvedValue({
                success: false,
                error: 'Script timeout'
            } as any);

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.markFailed).toHaveBeenCalledWith('Script timeout');
            expect(slackService.notifyApprovalFailure).toHaveBeenCalled();
        });

        it('should handle execution exception', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockReq.user = {
                id: 'admin-1',
                email: 'admin@test.com',
                role: UserRole.ADMIN
            } as any;

            const mockRequest = {
                uuid: 'test-uuid',
                id: 1,
                status: RequestStatus.PENDING,
                submissionType: SubmissionType.QUERY,
                user: {
                    id: 'user-1',
                    getEntity: () => ({ email: 'user@test.com' })
                },
                approve: jest.fn(),
                markExecuting: jest.fn(),
                markFailed: jest.fn(),
                podId: 'pod-1'
            };
            mockEm.findOne.mockResolvedValue(mockRequest);
            mockEm.findOneOrFail.mockResolvedValue({ id: 'admin-1' });

            jest.mocked(queryExecutionService.executeQuery).mockRejectedValue(new Error('Execution crashed'));

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(mockRequest.markFailed).toHaveBeenCalledWith('Execution crashed');
        });

        it('should handle database errors during approval', async () => {
            mockReq.params = { uuid: 'test-uuid' };
            mockEm.findOne.mockRejectedValue(new Error('DB Error'));

            await queryController.approveRequest(mockReq as any, mockRes as Response);

            expect(response.error).toHaveBeenCalledWith(
                mockRes,
                'Failed to approve request',
                500
            );
        });
    });
});
