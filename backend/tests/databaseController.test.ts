import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as databaseController from '../src/controllers/databaseController';
import * as databaseSyncService from '../src/services/databaseSyncService';
import { UserRole } from '../src/entities/User';

// Mock dependencies
jest.mock('../src/services/databaseSyncService');
jest.mock('../src/utils/logger');
jest.mock('../src/config/staticData', () => ({
    getInstanceById: jest.fn(),
    getDatabasesForInstance: jest.fn()
}), { virtual: true });

describe('Database Controller', () => {
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
        } as Partial<Response>;
        mockNext = jest.fn();
        mockReq = {
            body: {},
            query: {},
            params: {},
            user: { id: 'user-1', role: UserRole.DEVELOPER } as any
        };
    });

    describe('getInstances', () => {
        it('should return all instances', async () => {
            const instances = [{ id: '1' }];
            jest.mocked(databaseSyncService.getInstances).mockResolvedValue(instances as any);

            await databaseController.getInstances(mockReq as any, mockRes as Response, mockNext);

            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: instances }));
        });

        it('should filter by type', async () => {
            mockReq.query = { type: 'postgresql' };
            await databaseController.getInstances(mockReq as any, mockRes as Response, mockNext);
            expect(databaseSyncService.getInstances).toHaveBeenCalledWith('postgresql');
        });

        it('should fail with invalid type', async () => {
            mockReq.query = { type: 'invalid' as any };
            await databaseController.getInstances(mockReq as any, mockRes as Response, mockNext);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Invalid type') }));
        });

        it('should call next on error', async () => {
            jest.mocked(databaseSyncService.getInstances).mockRejectedValue(new Error('Fail'));
            await databaseController.getInstances(mockReq as any, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('getInstanceById', () => {
        it('should return instance', async () => {
            const instance = { id: '1' };
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue(instance as any);

            await databaseController.getInstanceById(mockReq as any, mockRes as Response, mockNext);

            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ data: instance }));
        });

        it('should return 404 if not found', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue(null);

            await databaseController.getInstanceById(mockReq as any, mockRes as Response, mockNext);

            expect(mockStatus).toHaveBeenCalledWith(404);
        });

        it('should call next on error', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockRejectedValue(new Error('Err'));
            await databaseController.getInstanceById(mockReq as any, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('getDatabases', () => {
        it('should return databases from sync service if instance exists', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({ id: '1', last_sync_at: new Date() } as any);
            jest.mocked(databaseSyncService.getDatabasesForInstance).mockResolvedValue([{ name: 'db1' }] as any);

            await databaseController.getDatabases(mockReq as any, mockRes as Response, mockNext);

            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ source: 'cache', count: 1 }));
        });

        it('should fallback to static config if instance not synced', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue(null);

            // Mock static data require
            const staticData = require('../src/config/staticData');
            staticData.getInstanceById.mockReturnValue({ id: '1' });
            staticData.getDatabasesForInstance.mockReturnValue(['db_static']);

            await databaseController.getDatabases(mockReq as any, mockRes as Response, mockNext);

            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ source: 'static', count: 1 }));
        });

        it('should return 404 if not found in cache OR static', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue(null);
            const staticData = require('../src/config/staticData');
            staticData.getInstanceById.mockReturnValue(null);

            await databaseController.getDatabases(mockReq as any, mockRes as Response, mockNext);

            expect(mockStatus).toHaveBeenCalledWith(404);
        });

        it('should call next on error', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockRejectedValue(new Error('Err'));
            await databaseController.getDatabases(mockReq as any, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('syncInstance', () => {
        it('should sync successfully if admin', async () => {
            mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({ id: '1' } as any);
            jest.mocked(databaseSyncService.syncInstanceDatabases).mockResolvedValue({ success: true, databasesFound: 1 } as any);

            await databaseController.syncInstance(mockReq as any, mockRes as Response, mockNext);

            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('completed') }));
        });

        it('should fail if not admin', async () => {
            mockReq.user = { id: 'dev', role: UserRole.DEVELOPER } as any;
            await databaseController.syncInstance(mockReq as any, mockRes as Response, mockNext);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });

        it('should return 404 if instance not found', async () => {
            mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue(null);

            await databaseController.syncInstance(mockReq as any, mockRes as Response, mockNext);

            expect(mockStatus).toHaveBeenCalledWith(404);
        });

        it('should handle sync failures', async () => {
            mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockResolvedValue({ id: '1' } as any);
            jest.mocked(databaseSyncService.syncInstanceDatabases).mockResolvedValue({ success: false, error: 'Fail' } as any);

            await databaseController.syncInstance(mockReq as any, mockRes as Response, mockNext);

            expect(mockStatus).toHaveBeenCalledWith(500);
        });

        it('should call next on error', async () => {
            mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getInstanceById).mockRejectedValue(new Error('Err'));
            await databaseController.syncInstance(mockReq as any, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('syncAll', () => {
        it('should sync all successfully if admin', async () => {
            mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
            jest.mocked(databaseSyncService.syncAllDatabases).mockResolvedValue({ total: 1, successful: 1, details: [] } as any);

            await databaseController.syncAll(mockReq as any, mockRes as Response, mockNext);

            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should fail if not admin', async () => {
            mockReq.user = { id: 'dev', role: UserRole.DEVELOPER } as any;
            await databaseController.syncAll(mockReq as any, mockRes as Response, mockNext);
            expect(mockStatus).toHaveBeenCalledWith(403);
        });

        it('should call next on error', async () => {
            mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
            jest.mocked(databaseSyncService.syncAllDatabases).mockRejectedValue(new Error('Err'));
            await databaseController.syncAll(mockReq as any, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('getSyncHistory', () => {
        it('should return history', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getSyncHistory).mockResolvedValue([]);
            await databaseController.getSyncHistory(mockReq as any, mockRes as Response, mockNext);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should call next on error', async () => {
            mockReq.params = { instanceId: '1' };
            jest.mocked(databaseSyncService.getSyncHistory).mockRejectedValue(new Error('Err'));
            await databaseController.getSyncHistory(mockReq as any, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('blacklist', () => {
        describe('getBlacklist', () => {
            it('should return blacklist', async () => {
                jest.mocked(databaseSyncService.getBlacklistEntries).mockResolvedValue([]);
                await databaseController.getBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
            });
            it('should call next on error', async () => {
                jest.mocked(databaseSyncService.getBlacklistEntries).mockRejectedValue(new Error('Err'));
                await databaseController.getBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('addToBlacklist', () => {
            const body = { pattern: 'db', patternType: 'exact' };

            it('should add successfully if admin', async () => {
                mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
                mockReq.body = body;
                jest.mocked(databaseSyncService.addToBlacklist).mockResolvedValue({ id: 1 });

                await databaseController.addToBlacklist(mockReq as any, mockRes as Response, mockNext);

                expect(mockStatus).toHaveBeenCalledWith(201);
            });

            it('should fail if not admin', async () => {
                mockReq.user = { id: 'dev', role: UserRole.DEVELOPER } as any;
                await databaseController.addToBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockStatus).toHaveBeenCalledWith(403);
            });

            it('should fail missing pattern', async () => {
                mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
                mockReq.body = {};
                await databaseController.addToBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockStatus).toHaveBeenCalledWith(400);
            });

            it('should fail invalid type', async () => {
                mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
                mockReq.body = { pattern: 'p', patternType: 'bad' } as any;
                await databaseController.addToBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockStatus).toHaveBeenCalledWith(400);
            });

            it('should call next on error', async () => {
                mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
                mockReq.body = body;
                jest.mocked(databaseSyncService.addToBlacklist).mockRejectedValue(new Error('Err'));
                await databaseController.addToBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('removeFromBlacklist', () => {
            it('should remove successfully if admin', async () => {
                mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
                mockReq.params = { id: '1' };
                jest.mocked(databaseSyncService.removeFromBlacklist).mockResolvedValue(true);

                await databaseController.removeFromBlacklist(mockReq as any, mockRes as Response, mockNext);

                expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
            });

            it('should fail if not admin', async () => {
                mockReq.user = { id: 'dev', role: UserRole.DEVELOPER } as any;
                await databaseController.removeFromBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockStatus).toHaveBeenCalledWith(403);
            });

            it('should fail if not found', async () => {
                mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
                mockReq.params = { id: '1' };
                jest.mocked(databaseSyncService.removeFromBlacklist).mockResolvedValue(false);

                await databaseController.removeFromBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockStatus).toHaveBeenCalledWith(404);
            });

            it('should call next on error', async () => {
                mockReq.user = { id: 'admin', role: UserRole.ADMIN } as any;
                mockReq.params = { id: '1' };
                jest.mocked(databaseSyncService.removeFromBlacklist).mockRejectedValue(new Error('Err'));
                await databaseController.removeFromBlacklist(mockReq as any, mockRes as Response, mockNext);
                expect(mockNext).toHaveBeenCalled();
            });
        });
    });
});
