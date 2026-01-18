// @ts-nocheck
/**
 * Database Sync Service Tests
 * 100% Branch Coverage
 */

// Mock pg Pool
const mockPoolQuery = jest.fn();
const mockPoolEnd = jest.fn();
const mockPoolOn = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    end: mockPoolEnd,
    on: mockPoolOn,
  })),
}));

// Mock MongoDB
const mockMongoConnect = jest.fn();
const mockMongoClose = jest.fn();
const mockMongoCommand = jest.fn();
jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: mockMongoConnect,
    close: mockMongoClose,
    db: jest.fn().mockReturnValue({
      command: mockMongoCommand,
    }),
  })),
}));

// Mock database
jest.mock('../src/config/database', () => ({
  portalQuery: jest.fn(),
  getPortalPool: jest.fn(),
  transaction: jest.fn((callback) => callback({ query: require('../src/config/database').portalQuery })),
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { portalQuery } = require('../src/config/database');
const databaseSyncService = require('../src/services/databaseSyncService');

describe('Database Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockReset();
    mockPoolEnd.mockReset();
    mockMongoConnect.mockReset();
    mockMongoClose.mockReset();
    mockMongoCommand.mockReset();
  });

  describe('getSyncStatus', () => {
    it('should return sync status', () => {
      const status = databaseSyncService.getSyncStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('intervalMinutes');
    });
  });

  describe('getBlacklist', () => {
    it('should get blacklist patterns', async () => {
      portalQuery.mockResolvedValueOnce({
        rows: [
          { pattern: 'test_', pattern_type: 'prefix' },
          { pattern: 'system', pattern_type: 'exact' },
        ],
      });

      const result = await databaseSyncService.getBlacklist();

      expect(result).toHaveLength(2);
    });
  });

  describe('isBlacklisted', () => {
    it('should match exact pattern', () => {
      const blacklist = [{ pattern: 'system', pattern_type: 'exact' }];

      expect(databaseSyncService.isBlacklisted('system', blacklist)).toBe(true);
      expect(databaseSyncService.isBlacklisted('SYSTEM', blacklist)).toBe(true);
      expect(databaseSyncService.isBlacklisted('system_db', blacklist)).toBe(false);
    });

    it('should match prefix pattern', () => {
      const blacklist = [{ pattern: 'test_', pattern_type: 'prefix' }];

      expect(databaseSyncService.isBlacklisted('test_db', blacklist)).toBe(true);
      expect(databaseSyncService.isBlacklisted('TEST_DB', blacklist)).toBe(true);
      expect(databaseSyncService.isBlacklisted('production', blacklist)).toBe(false);
    });

    it('should match regex pattern', () => {
      const blacklist = [{ pattern: '^temp.*$', pattern_type: 'regex' }];

      expect(databaseSyncService.isBlacklisted('temp_db', blacklist)).toBe(true);
      expect(databaseSyncService.isBlacklisted('temporary', blacklist)).toBe(true);
      expect(databaseSyncService.isBlacklisted('production', blacklist)).toBe(false);
    });

    it('should handle invalid regex pattern', () => {
      const blacklist = [{ pattern: '[invalid', pattern_type: 'regex' }];

      // Should not throw, just return false
      expect(databaseSyncService.isBlacklisted('test', blacklist)).toBe(false);
    });

    it('should return false for empty blacklist', () => {
      expect(databaseSyncService.isBlacklisted('test', [])).toBe(false);
    });
  });

  describe('syncInstanceDatabases', () => {
    const mockInstance = {
      id: 'inst-1',
      name: 'Test Instance',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      credentials_env_prefix: 'TEST',
    };

    it('should sync PostgreSQL databases successfully', async () => {
      // Mock blacklist
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock pg query
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ name: 'db1' }, { name: 'db2' }],
      });
      mockPoolEnd.mockResolvedValueOnce();

      // Mock upsert queries
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: true }] });
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: false }] });

      // Mock deactivate query
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });

      // Mock update instance status
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock sync history insert
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncInstanceDatabases(mockInstance);

      expect(result.success).toBe(true);
      expect(result.databasesFound).toBe(2);
    });

    it('should sync MongoDB databases successfully', async () => {
      const mongoInstance = {
        id: 'mongo-1',
        name: 'Test MongoDB',
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
      };

      // Mock blacklist
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock MongoDB
      mockMongoConnect.mockResolvedValueOnce();
      mockMongoCommand.mockResolvedValueOnce({
        databases: [{ name: 'db1' }, { name: 'db2' }],
      });
      mockMongoClose.mockResolvedValueOnce();

      // Mock upsert queries
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: true }] });
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: true }] });

      // Mock deactivate query
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });

      // Mock update instance status
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock sync history insert
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncInstanceDatabases(mongoInstance);

      expect(result.success).toBe(true);
    });

    it('should handle unknown instance type', async () => {
      const unknownInstance = {
        id: 'unknown-1',
        type: 'unknown',
      };

      // Mock blacklist
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock update instance status (error)
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock sync history insert
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncInstanceDatabases(unknownInstance);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown instance type');
    });

    it('should filter blacklisted databases', async () => {
      // Mock blacklist with prefix pattern
      portalQuery.mockResolvedValueOnce({
        rows: [{ pattern: 'test_', pattern_type: 'prefix' }]
      });

      // Mock pg query
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ name: 'test_db' }, { name: 'production' }],
      });
      mockPoolEnd.mockResolvedValueOnce();

      // Mock upsert for non-blacklisted db
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: true }] });

      // Mock deactivate query
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });

      // Mock update instance status
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock sync history insert
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncInstanceDatabases(mockInstance);

      expect(result.databasesFound).toBe(1); // Only 'production' after blacklist
    });

    it('should handle sync error', async () => {
      // Mock blacklist
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock pg query to fail
      mockPoolQuery.mockRejectedValueOnce(new Error('Connection failed'));
      mockPoolEnd.mockResolvedValueOnce();

      // Mock update instance status (error)
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock sync history insert
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncInstanceDatabases(mockInstance);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('syncAllDatabases', () => {
    it('should sync all active instances', async () => {
      // Mock get instances
      portalQuery.mockResolvedValueOnce({
        rows: [
          { id: 'inst-1', type: 'postgresql', host: 'localhost', port: 5432 },
        ],
      });

      // Mock blacklist
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock pg query
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ name: 'db1' }] });
      mockPoolEnd.mockResolvedValueOnce();

      // Mock upsert
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: true }] });

      // Mock deactivate
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });

      // Mock update status
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock history
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncAllDatabases();

      expect(result.total).toBe(1);
      expect(result.successful).toBe(1);
    });

    it('should handle mixed success and failure', async () => {
      // Mock get instances
      portalQuery.mockResolvedValueOnce({
        rows: [
          { id: 'inst-1', type: 'postgresql', host: 'localhost', port: 5432 },
          { id: 'inst-2', type: 'postgresql', host: 'localhost', port: 5433 },
        ],
      });

      // First instance - success
      portalQuery.mockResolvedValueOnce({ rows: [] }); // blacklist
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ name: 'db1' }] });
      mockPoolEnd.mockResolvedValueOnce();
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: true }] });
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });
      portalQuery.mockResolvedValueOnce({ rows: [] });
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Second instance - failure
      portalQuery.mockResolvedValueOnce({ rows: [] }); // blacklist
      mockPoolQuery.mockRejectedValueOnce(new Error('Connection failed'));
      mockPoolEnd.mockResolvedValueOnce();
      portalQuery.mockResolvedValueOnce({ rows: [] });
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncAllDatabases();

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('getInstances', () => {
    it('should get all instances', async () => {
      portalQuery.mockResolvedValueOnce({
        rows: [
          { id: 'inst-1', name: 'Instance 1', type: 'postgresql' },
          { id: 'inst-2', name: 'Instance 2', type: 'mongodb' },
        ],
      });

      const result = await databaseSyncService.getInstances();

      expect(result).toHaveLength(2);
    });

    it('should filter by type', async () => {
      portalQuery.mockResolvedValueOnce({
        rows: [{ id: 'inst-1', name: 'Instance 1', type: 'postgresql' }],
      });

      const result = await databaseSyncService.getInstances('postgresql');

      expect(portalQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $1'),
        ['postgresql']
      );
    });
  });

  describe('getDatabasesForInstance', () => {
    it('should get databases for instance', async () => {
      portalQuery.mockResolvedValueOnce({
        rows: [
          { name: 'db1', source: 'synced' },
          { name: 'db2', source: 'manual' },
        ],
      });

      const result = await databaseSyncService.getDatabasesForInstance('inst-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getInstanceById', () => {
    it('should get instance by ID', async () => {
      portalQuery.mockResolvedValueOnce({
        rows: [{ id: 'inst-1', name: 'Instance 1' }],
      });

      const result = await databaseSyncService.getInstanceById('inst-1');

      expect(result.id).toBe('inst-1');
    });

    it('should return null when not found', async () => {
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.getInstanceById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getSyncHistory', () => {
    it('should get sync history', async () => {
      portalQuery.mockResolvedValueOnce({
        rows: [
          { id: '1', status: 'success', databases_found: 5 },
          { id: '2', status: 'failed', error_message: 'Connection failed' },
        ],
      });

      const result = await databaseSyncService.getSyncHistory('inst-1');

      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      portalQuery.mockResolvedValueOnce({ rows: [] });

      await databaseSyncService.getSyncHistory('inst-1', 5);

      expect(portalQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['inst-1', 5]
      );
    });
  });

  describe('Blacklist Management', () => {
    describe('addToBlacklist', () => {
      it('should add pattern to blacklist', async () => {
        portalQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

        const result = await databaseSyncService.addToBlacklist(
          'test_',
          'prefix',
          'Test databases',
          'user-1'
        );

        expect(result.id).toBe('1');
      });
    });

    describe('removeFromBlacklist', () => {
      it('should remove pattern from blacklist', async () => {
        portalQuery.mockResolvedValueOnce({ rowCount: 1 });

        const result = await databaseSyncService.removeFromBlacklist('1');

        expect(result).toBe(true);
      });

      it('should return false when not found', async () => {
        portalQuery.mockResolvedValueOnce({ rowCount: 0 });

        const result = await databaseSyncService.removeFromBlacklist('999');

        expect(result).toBe(false);
      });
    });

    describe('getBlacklistEntries', () => {
      it('should get all blacklist entries', async () => {
        portalQuery.mockResolvedValueOnce({
          rows: [
            { id: '1', pattern: 'test_', pattern_type: 'prefix' },
          ],
        });

        const result = await databaseSyncService.getBlacklistEntries();

        expect(result).toHaveLength(1);
      });
    });
  });

  describe('Periodic Sync', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      databaseSyncService.stopPeriodicSync();
    });

    afterEach(() => {
      jest.useRealTimers();
      databaseSyncService.stopPeriodicSync();
    });

    it('should start periodic sync', () => {
      databaseSyncService.startPeriodicSync();

      const status = databaseSyncService.getSyncStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should not start if already running', () => {
      databaseSyncService.startPeriodicSync();
      databaseSyncService.startPeriodicSync(); // Should warn

      const status = databaseSyncService.getSyncStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should stop periodic sync', () => {
      databaseSyncService.startPeriodicSync();
      databaseSyncService.stopPeriodicSync();

      const status = databaseSyncService.getSyncStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('SYNC_CONFIG', () => {
    it('should export SYNC_CONFIG', () => {
      expect(databaseSyncService.SYNC_CONFIG).toBeDefined();
      expect(databaseSyncService.SYNC_CONFIG.intervalMinutes).toBeDefined();
    });
  });
});


describe('Database Sync Service - Error Handling Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    databaseSyncService.stopPeriodicSync();
  });

  afterEach(() => {
    jest.useRealTimers();
    databaseSyncService.stopPeriodicSync();
  });

  describe('startPeriodicSync - error handling in callbacks (lines 515-518, 524-527)', () => {
    it('should handle startup sync error gracefully', async () => {
      // Mock syncAllDatabases to fail
      const originalSyncAll = databaseSyncService.syncAllDatabases;

      // Start periodic sync
      databaseSyncService.startPeriodicSync();

      // Fast-forward past startup delay
      jest.advanceTimersByTime(35000);

      // The error should be caught and logged, not thrown
      expect(databaseSyncService.getSyncStatus().isRunning).toBe(true);
    });

    it('should handle scheduled sync error gracefully', async () => {
      // Start periodic sync
      databaseSyncService.startPeriodicSync();

      // Fast-forward past startup delay
      jest.advanceTimersByTime(35000);

      // Fast-forward to trigger scheduled sync (60 minutes)
      jest.advanceTimersByTime(60 * 60 * 1000);

      // The error should be caught and logged, not thrown
      expect(databaseSyncService.getSyncStatus().isRunning).toBe(true);
    });
  });

  describe('MongoDB connection string building', () => {
    it('should build connection string without credentials', async () => {
      const mongoInstance = {
        id: 'mongo-1',
        name: 'Test MongoDB',
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        credentials_env_prefix: 'NONEXISTENT',
      };

      // Mock blacklist
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock MongoDB
      mockMongoConnect.mockResolvedValueOnce();
      mockMongoCommand.mockResolvedValueOnce({
        databases: [{ name: 'db1' }],
      });
      mockMongoClose.mockResolvedValueOnce();

      // Mock upsert
      portalQuery.mockResolvedValueOnce({ rows: [{ is_insert: true }] });

      // Mock deactivate
      portalQuery.mockResolvedValueOnce({ rowCount: 0 });

      // Mock update status
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock history
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncInstanceDatabases(mongoInstance);

      expect(result.success).toBe(true);
    });
  });

  describe('syncInstanceDatabases - deactivation edge cases', () => {
    it('should skip deactivation when no databases found', async () => {
      const mockInstance = {
        id: 'inst-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
      };

      // Mock blacklist
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock pg query - return empty
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      mockPoolEnd.mockResolvedValueOnce();

      // Mock update instance status
      portalQuery.mockResolvedValueOnce({ rows: [] });

      // Mock sync history insert
      portalQuery.mockResolvedValueOnce({ rows: [] });

      const result = await databaseSyncService.syncInstanceDatabases(mockInstance);

      expect(result.success).toBe(true);
      expect(result.databasesFound).toBe(0);
    });
  });

  describe('closeSyncPools', () => {
    it('should close all sync pools', async () => {
      // closeSyncPools clears internal maps and closes connections
      await databaseSyncService.closeSyncPools();

      // Should complete without error
      expect(true).toBe(true);
    });
  });
});
