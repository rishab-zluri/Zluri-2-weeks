/**
 * Database Controller Tests
 * Tests for database management endpoints
 */

// Mock dependencies
jest.mock('../src/services/databaseSyncService');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const databaseSyncService = require('../src/services/databaseSyncService');
const databaseController = require('../src/controllers/databaseController');

describe('Database Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-123', email: 'admin@test.com', role: 'admin' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('getInstances', () => {
    it('should return all instances', async () => {
      const mockInstances = [
        { id: 'db-1', name: 'Database 1', type: 'postgresql' },
        { id: 'db-2', name: 'Database 2', type: 'mongodb' },
      ];
      databaseSyncService.getInstances.mockResolvedValue(mockInstances);

      await databaseController.getInstances(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockInstances,
        count: 2,
      });
    });

    it('should filter by type', async () => {
      mockReq.query.type = 'postgresql';
      const mockInstances = [{ id: 'db-1', name: 'Database 1', type: 'postgresql' }];
      databaseSyncService.getInstances.mockResolvedValue(mockInstances);

      await databaseController.getInstances(mockReq, mockRes, mockNext);

      expect(databaseSyncService.getInstances).toHaveBeenCalledWith('postgresql');
    });

    it('should return error for invalid type', async () => {
      mockReq.query.type = 'mysql';

      await databaseController.getInstances(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should handle errors', async () => {
      databaseSyncService.getInstances.mockRejectedValue(new Error('DB error'));

      await databaseController.getInstances(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getInstanceById', () => {
    it('should return instance by ID', async () => {
      mockReq.params.instanceId = 'db-1';
      const mockInstance = { id: 'db-1', name: 'Database 1' };
      databaseSyncService.getInstanceById.mockResolvedValue(mockInstance);

      await databaseController.getInstanceById(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockInstance,
      });
    });

    it('should return 404 for non-existent instance', async () => {
      mockReq.params.instanceId = 'non-existent';
      databaseSyncService.getInstanceById.mockResolvedValue(null);

      await databaseController.getInstanceById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      mockReq.params.instanceId = 'db-1';
      databaseSyncService.getInstanceById.mockRejectedValue(new Error('DB error'));

      await databaseController.getInstanceById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getDatabases', () => {
    it('should return databases for instance', async () => {
      mockReq.params.instanceId = 'db-1';
      const mockInstance = { id: 'db-1', last_sync_at: new Date(), last_sync_status: 'success' };
      const mockDatabases = ['db1', 'db2', 'db3'];
      
      databaseSyncService.getInstanceById.mockResolvedValue(mockInstance);
      databaseSyncService.getDatabasesForInstance.mockResolvedValue(mockDatabases);

      await databaseController.getDatabases(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockDatabases,
        count: 3,
        source: 'cache',
      }));
    });

    it('should return 404 for non-existent instance', async () => {
      mockReq.params.instanceId = 'non-existent';
      databaseSyncService.getInstanceById.mockResolvedValue(null);

      await databaseController.getDatabases(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      mockReq.params.instanceId = 'db-1';
      databaseSyncService.getInstanceById.mockRejectedValue(new Error('DB error'));

      await databaseController.getDatabases(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('syncInstance', () => {
    it('should sync instance successfully', async () => {
      mockReq.params.instanceId = 'db-1';
      const mockInstance = { id: 'db-1', name: 'Database 1' };
      const mockResult = {
        success: true,
        databasesFound: 5,
        databasesAdded: 2,
        databasesDeactivated: 1,
        duration: 1000,
      };
      
      databaseSyncService.getInstanceById.mockResolvedValue(mockInstance);
      databaseSyncService.syncInstanceDatabases.mockResolvedValue(mockResult);

      await databaseController.syncInstance(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Database sync completed successfully',
      }));
    });

    it('should return 403 for non-admin users', async () => {
      mockReq.user.role = 'developer';
      mockReq.params.instanceId = 'db-1';

      await databaseController.syncInstance(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 for non-existent instance', async () => {
      mockReq.params.instanceId = 'non-existent';
      databaseSyncService.getInstanceById.mockResolvedValue(null);

      await databaseController.syncInstance(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle sync failure', async () => {
      mockReq.params.instanceId = 'db-1';
      const mockInstance = { id: 'db-1' };
      const mockResult = {
        success: false,
        error: 'Connection failed',
        duration: 500,
      };
      
      databaseSyncService.getInstanceById.mockResolvedValue(mockInstance);
      databaseSyncService.syncInstanceDatabases.mockResolvedValue(mockResult);

      await databaseController.syncInstance(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should handle errors', async () => {
      mockReq.params.instanceId = 'db-1';
      databaseSyncService.getInstanceById.mockRejectedValue(new Error('DB error'));

      await databaseController.syncInstance(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
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
      
      databaseSyncService.syncAllDatabases.mockResolvedValue(mockResults);

      await databaseController.syncAll(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          total: 3,
          successful: 2,
          failed: 1,
        }),
      }));
    });

    it('should return 403 for non-admin users', async () => {
      mockReq.user.role = 'developer';

      await databaseController.syncAll(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle errors', async () => {
      databaseSyncService.syncAllDatabases.mockRejectedValue(new Error('DB error'));

      await databaseController.syncAll(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getSyncHistory', () => {
    it('should return sync history', async () => {
      mockReq.params.instanceId = 'db-1';
      const mockHistory = [
        { id: 1, sync_type: 'manual', status: 'success' },
        { id: 2, sync_type: 'scheduled', status: 'success' },
      ];
      
      databaseSyncService.getSyncHistory.mockResolvedValue(mockHistory);

      await databaseController.getSyncHistory(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory,
        count: 2,
      });
    });

    it('should respect limit parameter', async () => {
      mockReq.params.instanceId = 'db-1';
      mockReq.query.limit = '5';
      
      databaseSyncService.getSyncHistory.mockResolvedValue([]);

      await databaseController.getSyncHistory(mockReq, mockRes, mockNext);

      expect(databaseSyncService.getSyncHistory).toHaveBeenCalledWith('db-1', 5);
    });

    it('should cap limit at 100', async () => {
      mockReq.params.instanceId = 'db-1';
      mockReq.query.limit = '200';
      
      databaseSyncService.getSyncHistory.mockResolvedValue([]);

      await databaseController.getSyncHistory(mockReq, mockRes, mockNext);

      expect(databaseSyncService.getSyncHistory).toHaveBeenCalledWith('db-1', 100);
    });

    it('should handle errors', async () => {
      mockReq.params.instanceId = 'db-1';
      databaseSyncService.getSyncHistory.mockRejectedValue(new Error('DB error'));

      await databaseController.getSyncHistory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getBlacklist', () => {
    it('should return blacklist entries', async () => {
      const mockEntries = [
        { id: 1, pattern: 'test_*', pattern_type: 'prefix' },
        { id: 2, pattern: 'temp_db', pattern_type: 'exact' },
      ];
      
      databaseSyncService.getBlacklistEntries.mockResolvedValue(mockEntries);

      await databaseController.getBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockEntries,
        count: 2,
      });
    });

    it('should handle errors', async () => {
      databaseSyncService.getBlacklistEntries.mockRejectedValue(new Error('DB error'));

      await databaseController.getBlacklist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('addToBlacklist', () => {
    it('should add pattern to blacklist', async () => {
      mockReq.body = { pattern: 'test_*', patternType: 'prefix', reason: 'Test databases' };
      const mockEntry = { id: 1, pattern: 'test_*', pattern_type: 'prefix' };
      
      databaseSyncService.addToBlacklist.mockResolvedValue(mockEntry);

      await databaseController.addToBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockEntry,
      }));
    });

    it('should return 403 for non-admin users', async () => {
      mockReq.user.role = 'developer';
      mockReq.body = { pattern: 'test_*' };

      await databaseController.addToBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for missing pattern', async () => {
      mockReq.body = {};

      await databaseController.addToBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid patternType', async () => {
      mockReq.body = { pattern: 'test', patternType: 'invalid' };

      await databaseController.addToBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should use default patternType', async () => {
      mockReq.body = { pattern: 'test_db' };
      
      databaseSyncService.addToBlacklist.mockResolvedValue({ id: 1 });

      await databaseController.addToBlacklist(mockReq, mockRes, mockNext);

      expect(databaseSyncService.addToBlacklist).toHaveBeenCalledWith(
        'test_db',
        'exact',
        undefined,
        'user-123'
      );
    });

    it('should handle errors', async () => {
      mockReq.body = { pattern: 'test_*' };
      databaseSyncService.addToBlacklist.mockRejectedValue(new Error('DB error'));

      await databaseController.addToBlacklist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('removeFromBlacklist', () => {
    it('should remove pattern from blacklist', async () => {
      mockReq.params.id = '1';
      databaseSyncService.removeFromBlacklist.mockResolvedValue(true);

      await databaseController.removeFromBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Pattern removed from blacklist',
      });
    });

    it('should return 403 for non-admin users', async () => {
      mockReq.user.role = 'developer';
      mockReq.params.id = '1';

      await databaseController.removeFromBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 for non-existent entry', async () => {
      mockReq.params.id = '999';
      databaseSyncService.removeFromBlacklist.mockResolvedValue(false);

      await databaseController.removeFromBlacklist(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      mockReq.params.id = '1';
      databaseSyncService.removeFromBlacklist.mockRejectedValue(new Error('DB error'));

      await databaseController.removeFromBlacklist(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
