import { Request } from 'express';
import auditLogger, { AuditEventType } from '../../src/utils/auditLogger';
import logger from '../../src/utils/logger';

// Mock the base logger
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

describe('AuditLogger', () => {
    let mockReq: Partial<Request>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            ip: '127.0.0.1',
            headers: {
                'user-agent': 'TestAgent/1.0',
            },
            socket: {
                remoteAddress: '127.0.0.1',
            } as any,
            user: {
                id: 'user-123',
                email: 'test@example.com',
                role: 'admin',
                // Add other required user properties if any
            } as any,
            method: 'GET',
        };
    });

    describe('Helper Functions Integration', () => {
        it('should extract IP from x-forwarded-for string', () => {
            mockReq.headers = { ...mockReq.headers, 'x-forwarded-for': '10.0.0.1, 10.0.0.2' };
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                ipAddress: '10.0.0.1'
            }));
        });

        it('should extract IP from x-forwarded-for array', () => {
            mockReq.headers = { ...mockReq.headers, 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] };
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                ipAddress: '10.0.0.1'
            }));
        });

        it('should fallback to req.socket.remoteAddress', () => {
            delete (mockReq as any).ip;
            mockReq.headers = {}; // No x-forwarded-for
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                ipAddress: '127.0.0.1'
            }));
        });

        it('should extract actor from req.user', () => {
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                actor: {
                    id: 'user-123',
                    email: 'test@example.com',
                    role: 'admin',
                }
            }));
        });

        it('should handle missing actor (unauthenticated)', () => {
            delete mockReq.user;
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                actor: null
            }));
        });

        it('should handle missing user agent', () => {
            mockReq.headers = {};
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                userAgent: 'unknown'
            }));
        });

        it('should handle missing ip and socket', () => {
            delete (mockReq as any).ip;
            delete (mockReq as any).socket;
            mockReq.headers = {};
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                ipAddress: 'unknown'
            }));
        });

        it('should use req.ip if present and no headers/socket', () => {
            delete (mockReq as any).socket;
            mockReq.headers = {};
            (mockReq as any).ip = '192.168.1.1';
            auditLogger.log(mockReq as Request, AuditEventType.LOGIN_SUCCESS);

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                ipAddress: '192.168.1.1'
            }));
        });
    });

    describe('Specific Logging Methods', () => {
        it('logApproval should log correctly', () => {
            auditLogger.logApproval(mockReq as Request, 'req-1', 'uuid-1', 'submitter@example.com');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.REQUEST_APPROVED,
                target: {
                    type: 'request',
                    id: 'req-1',
                    identifier: 'uuid-1',
                },
                metadata: {
                    submitterEmail: 'submitter@example.com',
                }
            }));
        });

        it('logRejection should log correctly', () => {
            auditLogger.logRejection(mockReq as Request, 'req-1', 'uuid-1', 'submitter@example.com', 'Bad query');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.REQUEST_REJECTED,
                target: {
                    type: 'request',
                    id: 'req-1',
                    identifier: 'uuid-1',
                },
                metadata: {
                    submitterEmail: 'submitter@example.com',
                    reason: 'Bad query',
                }
            }));
        });

        it('logSubmission should log correctly', () => {
            auditLogger.logSubmission(mockReq as Request, 'req-1', 'uuid-1', 'QUERY', 'prod-db');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.REQUEST_SUBMITTED,
                target: {
                    type: 'request',
                    id: 'req-1',
                    identifier: 'uuid-1',
                },
                metadata: {
                    submissionType: 'QUERY',
                    databaseName: 'prod-db',
                }
            }));
        });

        it('logLoginSuccess should log correctly', () => {
            auditLogger.logLoginSuccess(mockReq as Request, 'u-1', 'user@example.com');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.LOGIN_SUCCESS,
                target: {
                    type: 'user',
                    id: 'u-1',
                    identifier: 'user@example.com',
                }
            }));
        });

        it('logLoginFailure should log correctly', () => {
            auditLogger.logLoginFailure(mockReq as Request, 'attempt@example.com', 'Bad password');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.LOGIN_FAILURE,
                target: {
                    type: 'user',
                    id: 'unknown',
                    identifier: 'attempt@example.com',
                },
                metadata: {
                    reason: 'Bad password'
                }
            }));
        });

        it('logRoleChange should log correctly', () => {
            auditLogger.logRoleChange(mockReq as Request, 'target-u', 'target@example.com', 'user', 'admin');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.USER_ROLE_CHANGED,
                target: {
                    type: 'user',
                    id: 'target-u',
                    identifier: 'target@example.com',
                },
                metadata: {
                    previousValue: 'user',
                    newValue: 'admin',
                }
            }));
        });

        it('logUnauthorizedAccess should log correctly', () => {
            auditLogger.logUnauthorizedAccess(mockReq as Request, '/admin');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.UNAUTHORIZED_ACCESS,
                metadata: {
                    path: '/admin',
                    method: 'GET'
                }
            }));
        });

        it('logForbiddenAccess should log correctly', () => {
            auditLogger.logForbiddenAccess(mockReq as Request, '/admin', 'admin');

            expect(logger.info).toHaveBeenCalledWith('AUDIT', expect.objectContaining({
                eventType: AuditEventType.FORBIDDEN_ACCESS,
                metadata: {
                    path: '/admin',
                    method: 'GET',
                    requiredRole: 'admin'
                }
            }));
        });
    });
});
