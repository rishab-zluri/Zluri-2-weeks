/**
 * Database Controller Tests (TypeScript)
 * Tests for database management endpoints
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import * as databaseController from '../src/controllers/databaseController';
import { UserRole } from '../src/entities/User';

// Mock dependencies
jest.mock('../src/services/databaseSyncService', () => ({
    getInstances: jest.fn<any>(),
    getInstanceById: jest.fn<any>(),
    getDatabasesForInstance: jest.fn<any>(),
    syncInstanceDatabases: jest.fn<any>(),
    syncAllDatabases: jest.fn<any>(),
    getSyncHistory: jest.fn<any>(),
    getBlacklistEntries: jest.fn<any>(),
    addToBlacklist: jest.fn<any>(),
    removeFromBlacklist: jest.fn<any>(),
}));

jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

import * as databaseSyncService from '../src/services/databaseSyncService';

describe('Database Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            params: {},
            query: {},
            body: {},
            user: { id: 'user-123', email: 'admin@test.com', role: UserRole.ADMIN } as any,
        };

        mockRes = {
            status: jest.fn().mockReturnThis() as any,
            json: jest.fn().mockReturnThis() as any,
        };

        mockNext = jest.fn() as NextFunction;
    });

    describe('getInstances', () => {
        it('should return all instances', async () => {
            const mockInstances = [
                { id: 'db-1', name: 'Database 1', type: 'postgresql' },
                { id: 'db-2', name: 'Database 2', type: 'mongodb' },
            ];
            (databaseSyncService.getInstances as jest.Mock<any>).mockResolvedValue(mockInstances);

            await databaseController.getInstances(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockInstances,
                count: 2,
            });
        });

        it('should filter by type', async () => {
            mockReq.query = { type: 'postgresql' };
            const mockInstances = [{ id: 'db-1', name: 'Database 1', type: 'postgresql' }];
            (databaseSyncService.getInstances as jest.Mock<any>).mockResolvedValue(mockInstances);

            await databaseController.getInstances(mockReq as Request, mockRes as Response, mockNext);

            expect(databaseSyncService.getInstances).toHaveBeenCalledWith('postgresql');
        });

        it('should return error for invalid type', async () => {
            mockReq.query = { type: 'mysql' as any };

            await databaseController.getInstances(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
            }));
        });
    });

    describe('getInstanceById', () => {
        it('should return instance by ID', async () => {
            mockReq.params = { instanceId: 'db-1' };
            const mockInstance = { id: 'db-1', name: 'Database 1' };
            (databaseSyncService.getInstanceById as jest.Mock<any>).mockResolvedValue(mockInstance);

            await databaseController.getInstanceById(mockReq as any, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockInstance,
            });
        });

        it('should return 404 for non-existent instance', async () => {
            mockReq.params = { instanceId: 'non-existent' };
            (databaseSyncService.getInstanceById as jest.Mock<any>).mockResolvedValue(null);

            await databaseController.getInstanceById(mockReq as any, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getDatabases', () => {
        it('should return databases for instance', async () => {
            mockReq.params = { instanceId: 'db-1' };
            const mockInstance = { id: 'db-1', last_sync_at: new Date(), last_sync_status: 'success' };
            const mockDatabases = ['db1', 'db2', 'db3'];

            (databaseSyncService.getInstanceById as jest.Mock<any>).mockResolvedValue(mockInstance);
            (databaseSyncService.getDatabasesForInstance as jest.Mock<any>).mockResolvedValue(mockDatabases);

            await databaseController.getDatabases(mockReq as any, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockDatabases,
                count: 3,
                source: 'cache',
            }));
        });
    });

    describe('syncInstance', () => {
        it('should sync instance successfully', async () => {
            mockReq.params = { instanceId: 'db-1' };
            const mockInstance = { id: 'db-1', name: 'Database 1' };
            const mockResult = {
                success: true,
                databasesFound: 5,
                databasesAdded: 2,
                databasesDeactivated: 1,
                duration: 1000,
            };

            (databaseSyncService.getInstanceById as jest.Mock<any>).mockResolvedValue(mockInstance);
            (databaseSyncService.syncInstanceDatabases as jest.Mock<any>).mockResolvedValue(mockResult);

            await databaseController.syncInstance(mockReq as any, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: 'Database sync completed successfully',
            }));
        });

        it('should return 403 for non-admin users', async () => {
            mockReq.user!.role = UserRole.DEVELOPER;
            mockReq.params = { instanceId: 'db-1' };

            await databaseController.syncInstance(mockReq as any, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('syncAll', () => {
        it('should sync all instances successfully', async () => {
            const mockResults = {
                total: 3,
                successful: 2,
                failed: 1,
                details: [
                    { instanceId: 'db-1', success: true, databasesFound: 5, databasesAdded: 2 },
                    { instanceId: 'db-2', success: true, databasesFound: 3, databasesAdded: 0 },
                    { instanceId: 'db-3', success: false, error: 'Connection failed' },
                ],
            };

            (databaseSyncService.syncAllDatabases as jest.Mock<any>).mockResolvedValue(mockResults);

            await databaseController.syncAll(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    total: 3,
                    successful: 2,
                    failed: 1,
                }),
            }));
        });
    });

    describe('getSyncHistory', () => {
        it('should return sync history', async () => {
            mockReq.params = { instanceId: 'db-1' };
            const mockHistory = [
                { id: 1, sync_type: 'manual', status: 'success' },
                { id: 2, sync_type: 'scheduled', status: 'success' },
            ];

            (databaseSyncService.getSyncHistory as jest.Mock<any>).mockResolvedValue(mockHistory);

            await databaseController.getSyncHistory(mockReq as any, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockHistory,
                count: 2,
            });
        });
    });

    describe('getBlacklist', () => {
        it('should return blacklist entries', async () => {
            const mockEntries = [
                { id: 1, pattern: 'test_*', pattern_type: 'prefix' },
                { id: 2, pattern: 'temp_db', pattern_type: 'exact' },
            ];

            (databaseSyncService.getBlacklistEntries as jest.Mock<any>).mockResolvedValue(mockEntries);

            await databaseController.getBlacklist(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockEntries,
                count: 2,
            });
        });
    });

    describe('addToBlacklist', () => {
        it('should add pattern to blacklist', async () => {
            mockReq.body = { pattern: 'test_*', patternType: 'prefix', reason: 'Test databases' };
            const mockEntry = { id: 1, pattern: 'test_*', pattern_type: 'prefix' };

            (databaseSyncService.addToBlacklist as jest.Mock<any>).mockResolvedValue(mockEntry);

            await databaseController.addToBlacklist(mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockEntry,
            }));
        });
    });

    describe('removeFromBlacklist', () => {
        it('should remove pattern from blacklist', async () => {
            mockReq.params = { id: '1' };
            (databaseSyncService.removeFromBlacklist as jest.Mock<any>).mockResolvedValue(true);

            await databaseController.removeFromBlacklist(mockReq as any, mockRes as Response, mockNext);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Pattern removed from blacklist',
            });
        });
    });
});
