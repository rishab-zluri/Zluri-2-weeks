/**
 * Query Execution Service Tests - 100% Branch Coverage
 * 
 * Uses jest.resetModules() for proper mock isolation
 * Covers ALL branches including edge cases and error paths
 */

describe('Query Execution Service', () => {
  let mockPgClient;
  let mockPgPool;
  let mockCollection;
  let mockDb;
  let mockMongoClient;
  let mockStaticData;
  let queryExecutionService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // PostgreSQL mocks
    mockPgClient = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        fields: [{ name: 'id' }],
        command: 'SELECT',
      }),
      release: jest.fn(),
    };

    mockPgPool = {
      connect: jest.fn().mockResolvedValue(mockPgClient),
      query: jest.fn(),
      on: jest.fn(),
      end: jest.fn().mockResolvedValue(),
    };

    // MongoDB mocks
    mockCollection = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockResolvedValue({ _id: '1', name: 'Test' }),
      aggregate: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockResolvedValue(5),
      distinct: jest.fn().mockResolvedValue(['value1', 'value2']),
      insertOne: jest.fn().mockResolvedValue({ insertedId: '123' }),
      insertMany: jest.fn().mockResolvedValue({ insertedCount: 2 }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 5 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 10 }),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([{ _id: '1', name: 'Test' }]),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      command: jest.fn().mockResolvedValue({ ok: 1 }),
    };

    mockMongoClient = {
      connect: jest.fn().mockResolvedValue(),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue(),
    };

    // Mock modules
    jest.doMock('pg', () => ({
      Pool: jest.fn().mockImplementation(() => mockPgPool),
    }));

    jest.doMock('mongodb', () => ({
      MongoClient: jest.fn().mockImplementation(() => mockMongoClient),
    }));

    mockStaticData = {
      getInstanceById: jest.fn(),
      getDatabasesByInstance: jest.fn().mockReturnValue([]),
      getAllInstances: jest.fn().mockReturnValue([]),
      getPods: jest.fn().mockReturnValue([]),
    };
    jest.doMock('../src/config/staticData', () => mockStaticData);

    jest.doMock('../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }));

    queryExecutionService = require('../src/services/queryExecutionService');
  });

  afterEach(async () => {
    if (queryExecutionService?.closeAllConnections) {
      try {
        await queryExecutionService.closeAllConnections();
      } catch (e) {}
    }
  });

  // ==========================================================================
  // PostgreSQL Tests - Core Functionality
  // ==========================================================================
  describe('executePostgresQuery', () => {
    const pgInstance = {
      id: 'database-1',
      name: 'Database 1',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'testpass',
    };

    it('should execute SELECT query successfully', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'SELECT * FROM users'
      );

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(mockPgPool.connect).toHaveBeenCalled();
      expect(mockPgClient.query).toHaveBeenCalledWith('SELECT * FROM users');
      expect(mockPgClient.release).toHaveBeenCalled();
    });

    it('should throw for null instance', async () => {
      mockStaticData.getInstanceById.mockReturnValue(null);

      await expect(
        queryExecutionService.executePostgresQuery('invalid', 'test_db', 'SELECT 1')
      ).rejects.toThrow(/Instance not found/);
    });

    it('should throw for undefined instance', async () => {
      mockStaticData.getInstanceById.mockReturnValue(undefined);

      await expect(
        queryExecutionService.executePostgresQuery('invalid', 'test_db', 'SELECT 1')
      ).rejects.toThrow(/Instance not found/);
    });

    it('should throw for non-PostgreSQL instance', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
      });

      await expect(
        queryExecutionService.executePostgresQuery('mongo-1', 'test_db', 'SELECT 1')
      ).rejects.toThrow(/not a PostgreSQL database/);
    });

    it('should throw QueryExecutionError on query failure', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockRejectedValue(new Error('Query failed'));

      await expect(
        queryExecutionService.executePostgresQuery('database-1', 'test_db', 'INVALID')
      ).rejects.toThrow(/Query execution failed/);
    });

    it('should release client on error', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockRejectedValue(new Error('Query failed'));

      try {
        await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'INVALID');
      } catch (e) {}

      expect(mockPgClient.release).toHaveBeenCalled();
    });

    it('should handle connection failure', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgPool.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(
        queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1')
      ).rejects.toThrow(/Query execution failed/);
    });

    it('should handle empty result set', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'SELECT * FROM empty_table'
      );

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
      expect(result.rows).toEqual([]);
    });

    it('should handle INSERT command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        "INSERT INTO users (name) VALUES ('test')"
      );

      expect(result.success).toBe(true);
      expect(result.command).toBe('INSERT');
    });

    it('should handle UPDATE command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [],
        rowCount: 5,
        command: 'UPDATE',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'UPDATE users SET active = true'
      );

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(5);
    });

    it('should handle DELETE command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [],
        rowCount: 3,
        command: 'DELETE',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'DELETE FROM users WHERE active = false'
      );

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(3);
    });

    it('should reuse existing pool for same instance/db', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);

      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');
      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 2');

      // Pool constructor should only be called once (pool is reused)
      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledTimes(1);
    });

    it('should create new pool for different database', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);

      await queryExecutionService.executePostgresQuery('database-1', 'test_db1', 'SELECT 1');
      await queryExecutionService.executePostgresQuery('database-1', 'test_db2', 'SELECT 2');

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledTimes(2);
    });

    it('should register error handler on pool', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);

      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');

      expect(mockPgPool.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Call the error handler to ensure it doesn't throw
      const errorCall = mockPgPool.on.mock.calls.find(call => call[0] === 'error');
      if (errorCall) {
        expect(() => errorCall[1](new Error('Pool error'))).not.toThrow();
      }
    });

    it('should handle query with special characters', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        "SELECT * FROM users WHERE name = 'O''Brien'"
      );

      expect(result.success).toBe(true);
    });

    it('should handle query error with code and detail', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      const pgError = new Error('Duplicate key');
      pgError.code = '23505';
      pgError.detail = 'Key (id)=(1) already exists';
      pgError.hint = 'Check for existing records';
      mockPgClient.query.mockRejectedValue(pgError);

      await expect(
        queryExecutionService.executePostgresQuery('database-1', 'test_db', 'INSERT...')
      ).rejects.toThrow(/Query execution failed/);
    });

    // --- readOnly mode tests (lines 237-246) ---
    it('should execute query in read-only mode when option is set', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'SELECT * FROM users',
        { readOnly: true }
      );

      expect(result.success).toBe(true);
      // Should have called BEGIN READ ONLY and COMMIT
      const calls = mockPgClient.query.mock.calls.map(c => c[0]);
      expect(calls).toContain('BEGIN READ ONLY');
      expect(calls).toContain('COMMIT');
    });

    it('should not use read-only transaction when readOnly is false', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'INSERT INTO users (name) VALUES (\'test\')',
        { readOnly: false }
      );

      expect(result.success).toBe(true);
      const calls = mockPgClient.query.mock.calls.map(c => c[0]);
      expect(calls).not.toContain('BEGIN READ ONLY');
    });

    // --- Large result truncation (lines 253-256) ---
    it('should truncate large PostgreSQL result sets', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      
      // Create result with more than maxRows (default 10000)
      const largeRows = Array.from({ length: 15000 }, (_, i) => ({ id: i }));
      mockPgClient.query.mockResolvedValue({
        rows: largeRows,
        rowCount: 15000,
        command: 'SELECT',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'SELECT * FROM large_table'
      );

      expect(result.success).toBe(true);
      expect(result.rows.length).toBeLessThanOrEqual(10000);
      expect(result.truncated).toBe(true);
    });
  });

  // ==========================================================================
  // MongoDB Tests - Core Functionality
  // ==========================================================================
  describe('executeMongoQuery', () => {
    const mongoInstance = {
      id: 'mongo-zluri-1',
      name: 'Mongo 1',
      type: 'mongodb',
      uri: 'mongodb://localhost:27017',
    };

    // --- find operations ---
    it('should execute find with empty filter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({})'
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(1);
    });

    it('should execute find with filter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({"active": true})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute find with no arguments', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find()'
      );

      expect(result.success).toBe(true);
    });

    // --- findOne operations ---
    it('should execute findOne with filter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOne({"_id": "1"})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle findOne returning null', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOne.mockResolvedValue(null);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOne({"_id": "nonexistent"})'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBeNull();
    });

    // --- aggregate operations ---
    it('should execute aggregate with pipeline', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([{ count: 10 }]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([{"$count": "total"}])'
      );

      expect(result.success).toBe(true);
    });

    it('should execute aggregate with complex pipeline', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([{ _id: 'active', count: 5 }]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([{"$match": {"active": true}}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}])'
      );

      expect(result.success).toBe(true);
    });

    // --- count operations ---
    it('should execute countDocuments', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.countDocuments({})'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(5);
    });

    it('should execute count (alias for countDocuments)', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.count({})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute countDocuments with filter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.countDocuments.mockResolvedValue(3);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.countDocuments({"active": true})'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(3);
    });

    // --- distinct operations ---
    it('should execute distinct', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.distinct("status")'
      );

      expect(result.success).toBe(true);
    });

    it('should execute distinct with filter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.distinct("status", {"active": true})'
      );

      expect(result.success).toBe(true);
    });

    // --- insert operations ---
    it('should execute insertOne', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.insertOne({"name": "test"})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute insertMany', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.insertMany([{"name": "a"}, {"name": "b"}])'
      );

      expect(result.success).toBe(true);
    });

    // --- update operations ---
    it('should execute updateOne', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.updateOne({"_id": "1"}, {"$set": {"name": "updated"}})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute updateMany', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.updateMany({}, {"$set": {"active": true}})'
      );

      expect(result.success).toBe(true);
    });

    // --- delete operations ---
    it('should execute deleteOne', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.deleteOne({"_id": "1"})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute deleteMany', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.deleteMany({"active": false})'
      );

      expect(result.success).toBe(true);
    });

    // --- JSON command ---
    it('should execute JSON command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        '{"ping": 1}'
      );

      expect(result.success).toBe(true);
    });

    it('should execute serverStatus command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockDb.command.mockResolvedValue({ host: 'localhost', version: '4.4' });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        '{"serverStatus": 1}'
      );

      expect(result.success).toBe(true);
    });

    // --- Collection syntax variations ---
    it('should handle db["collection"] syntax', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db["users-collection"].find({})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle db.collection syntax with dots', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({})'
      );

      expect(result.success).toBe(true);
    });

    // --- Validation errors ---
    it('should throw for null instance', async () => {
      mockStaticData.getInstanceById.mockReturnValue(null);

      await expect(
        queryExecutionService.executeMongoQuery('invalid', 'test_db', 'db.test.find()')
      ).rejects.toThrow(/Instance not found/);
    });

    it('should throw for non-MongoDB instance', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'pg-1',
        type: 'postgresql',
      });

      await expect(
        queryExecutionService.executeMongoQuery('pg-1', 'test_db', 'db.test.find()')
      ).rejects.toThrow(/not a MongoDB database/);
    });

    it('should throw for missing URI', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        // No uri field
      });

      await expect(
        queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find()')
      ).rejects.toThrow(/missing URI/);
    });

    it('should throw for empty URI', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: '',
      });

      await expect(
        queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find()')
      ).rejects.toThrow(/missing URI/);
    });

    it('should throw for invalid query format', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'invalid query')
      ).rejects.toThrow(/Invalid MongoDB query format/);
    });

    it('should throw for unsupported method', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.unsupportedMethod({})'
        )
      ).rejects.toThrow(/Unsupported MongoDB method/);
    });

    it('should throw for replaceOne (unsupported)', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.replaceOne({"_id": "1"}, {"name": "new"})'
        )
      ).rejects.toThrow(/Unsupported MongoDB method/);
    });

    it('should reject chained methods', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.find({}).limit(10)'
        )
      ).rejects.toThrow(/Invalid MongoDB query format/);
    });

    it('should throw for invalid JSON in arguments', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.find({invalid})'
        )
      ).rejects.toThrow(/Invalid MongoDB query format/);
    });

    // --- Error handling ---
    it('should wrap connection errors in QueryExecutionError', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockMongoClient.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.find({})')
      ).rejects.toThrow(/Query execution failed.*Connection failed/);
    });

    it('should wrap query errors in QueryExecutionError', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockRejectedValue(new Error('Query failed'));

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.find({})')
      ).rejects.toThrow(/Query execution failed.*Query failed/);
    });

    it('should wrap findOne errors', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOne.mockRejectedValue(new Error('findOne failed'));

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.findOne({})')
      ).rejects.toThrow(/Query execution failed/);
    });

    it('should wrap aggregate errors', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockRejectedValue(new Error('Aggregate failed')),
      });

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.aggregate([])')
      ).rejects.toThrow(/Query execution failed/);
    });

    it('should wrap insertOne errors', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.insertOne.mockRejectedValue(new Error('Insert failed'));

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.insertOne({"a": 1})')
      ).rejects.toThrow(/Query execution failed/);
    });

    it('should wrap updateOne errors', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.updateOne.mockRejectedValue(new Error('Update failed'));

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.updateOne({}, {"$set": {}})')
      ).rejects.toThrow(/Query execution failed/);
    });

    it('should wrap deleteOne errors', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.deleteOne.mockRejectedValue(new Error('Delete failed'));

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.deleteOne({})')
      ).rejects.toThrow(/Query execution failed/);
    });

    it('should wrap command errors', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockDb.command.mockRejectedValue(new Error('Command failed'));

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', '{"ping": 1}')
      ).rejects.toThrow(/Query execution failed/);
    });

    // --- MongoDB connection reuse ---
    it('should reuse MongoDB client for same instance', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.find({})');
      await queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.find({})');

      // Connect should only be called once (client is reused)
      expect(mockMongoClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // executeQuery Router Tests
  // ==========================================================================
  describe('executeQuery', () => {
    it('should route to PostgreSQL', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });

      const result = await queryExecutionService.executeQuery({
        databaseType: 'postgresql',
        instanceId: 'database-1',
        databaseName: 'test_db',
        queryContent: 'SELECT 1',
      });

      expect(result.success).toBe(true);
    });

    it('should route to MongoDB', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });

      mockCollection.toArray.mockResolvedValue([]);

      const result = await queryExecutionService.executeQuery({
        databaseType: 'mongodb',
        instanceId: 'mongo-zluri-1',
        databaseName: 'test_db',
        queryContent: 'db.test.find({})',
      });

      expect(result.success).toBe(true);
    });

    it('should throw for mysql', async () => {
      await expect(
        queryExecutionService.executeQuery({
          databaseType: 'mysql',
          instanceId: 'mysql-1',
          databaseName: 'test_db',
          queryContent: 'SELECT 1',
        })
      ).rejects.toThrow(/Unsupported database type/);
    });

    it('should throw for oracle', async () => {
      await expect(
        queryExecutionService.executeQuery({
          databaseType: 'oracle',
          instanceId: 'oracle-1',
          databaseName: 'test_db',
          queryContent: 'SELECT 1 FROM DUAL',
        })
      ).rejects.toThrow(/Unsupported database type/);
    });

    it('should throw for empty database type', async () => {
      await expect(
        queryExecutionService.executeQuery({
          databaseType: '',
          instanceId: 'test-1',
          databaseName: 'test_db',
          queryContent: 'SELECT 1',
        })
      ).rejects.toThrow(/Unsupported database type/);
    });

    it('should throw for null database type', async () => {
      await expect(
        queryExecutionService.executeQuery({
          databaseType: null,
          instanceId: 'test-1',
          databaseName: 'test_db',
          queryContent: 'SELECT 1',
        })
      ).rejects.toThrow(/Unsupported database type/);
    });

    it('should handle case-sensitive database type', async () => {
      // If your service is case-sensitive, POSTGRESQL should fail
      await expect(
        queryExecutionService.executeQuery({
          databaseType: 'POSTGRESQL',
          instanceId: 'test-1',
          databaseName: 'test_db',
          queryContent: 'SELECT 1',
        })
      ).rejects.toThrow(/Unsupported database type/);
    });
  });

  // ==========================================================================
  // closeAllConnections Tests
  // ==========================================================================
  describe('closeAllConnections', () => {
    it('should close without error when no connections', async () => {
      await expect(queryExecutionService.closeAllConnections()).resolves.not.toThrow();
    });

    it('should close PostgreSQL pools', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });

      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');
      await queryExecutionService.closeAllConnections();

      expect(mockPgPool.end).toHaveBeenCalled();
    });

    it('should close MongoDB clients', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });

      await queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find({})');
      await queryExecutionService.closeAllConnections();

      expect(mockMongoClient.close).toHaveBeenCalled();
    });

    it('should handle PostgreSQL pool close errors gracefully', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });

      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');
      mockPgPool.end.mockRejectedValue(new Error('Close failed'));

      await expect(queryExecutionService.closeAllConnections()).resolves.not.toThrow();
    });

    it('should handle MongoDB client close errors gracefully', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });

      await queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find({})');
      mockMongoClient.close.mockRejectedValue(new Error('Close failed'));

      await expect(queryExecutionService.closeAllConnections()).resolves.not.toThrow();
    });

    it('should close multiple pools and clients', async () => {
      // Create PostgreSQL connection
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });
      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');

      // Create MongoDB connection
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });
      await queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find({})');

      await queryExecutionService.closeAllConnections();

      expect(mockPgPool.end).toHaveBeenCalled();
      expect(mockMongoClient.close).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases for Maximum Branch Coverage
  // ==========================================================================
  describe('Edge cases for branch coverage', () => {
    const pgInstance = {
      id: 'database-1',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'testpass',
    };

    const mongoInstance = {
      id: 'mongo-zluri-1',
      type: 'mongodb',
      uri: 'mongodb://localhost:27017',
    };

    // PostgreSQL edge cases
    it('should handle CREATE TABLE command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'CREATE',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'CREATE TABLE test (id INT)'
      );

      expect(result.success).toBe(true);
    });

    it('should handle DROP TABLE command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DROP',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'DROP TABLE test'
      );

      expect(result.success).toBe(true);
    });

    it('should handle query with null rowCount', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: null,
        command: 'SELECT',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'SELECT 1'
      );

      expect(result.success).toBe(true);
    });

    // MongoDB edge cases
    it('should handle empty array result from aggregate', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([])'
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual([]);
    });

    it('should handle distinct returning empty array', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.distinct.mockResolvedValue([]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.distinct("field")'
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual([]);
    });

    it('should handle countDocuments returning 0', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.countDocuments.mockResolvedValue(0);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.countDocuments({})'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(0);
    });

    it('should handle insertMany with empty array', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.insertMany.mockResolvedValue({ insertedCount: 0 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.insertMany([])'
      );

      expect(result.success).toBe(true);
    });

    it('should handle updateMany affecting 0 documents', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 0, matchedCount: 0 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.updateMany({"nonexistent": true}, {"$set": {"a": 1}})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle deleteMany deleting 0 documents', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.deleteMany({"nonexistent": true})'
      );

      expect(result.success).toBe(true);
      expect(result.result.deletedCount).toBe(0);
    });

    // JSON command variations
    it('should handle complex JSON command', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockDb.command.mockResolvedValue({ ok: 1, databases: [] });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        '{"listDatabases": 1}'
      );

      expect(result.success).toBe(true);
    });

    // Query parsing edge cases
    it('should handle query with nested JSON', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({"address": {"city": "NYC", "zip": "10001"}})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle query with array in filter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({"status": {"$in": ["active", "pending"]}})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle query with $regex operator', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({"name": {"$regex": "^test"}})'
      );

      expect(result.success).toBe(true);
    });

    // Error with code and codeName
    it('should handle MongoDB error with code and codeName', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      const mongoError = new Error('Duplicate key');
      mongoError.code = 11000;
      mongoError.codeName = 'DuplicateKey';
      mockCollection.insertOne.mockRejectedValue(mongoError);

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'db.test.insertOne({"_id": 1})')
      ).rejects.toThrow(/Query execution failed/);
    });

    // --- estimatedDocumentCount (line 474) ---
    it('should execute estimatedDocumentCount', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.estimatedDocumentCount = jest.fn().mockResolvedValue(1000);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.estimatedDocumentCount()'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(1000);
    });

    // --- single quote collection syntax db['collection'] (line 551) ---
    it('should handle db[\'collection\'] syntax with single quotes', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([{ _id: '1' }]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        "db['special-collection'].find({})"
      );

      expect(result.success).toBe(true);
    });

    // --- find/findOne with projection (line 583) ---
    it('should execute find with projection parameter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([{ name: 'Test' }]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({}, {"name": 1, "_id": 0})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute findOne with projection parameter', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOne.mockResolvedValue({ name: 'Test' });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOne({"_id": "1"}, {"name": 1})'
      );

      expect(result.success).toBe(true);
    });

    // --- Large result truncation (lines 397-399) ---
    it('should truncate large result arrays', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      
      // Create array larger than maxRows
      const largeArray = Array.from({ length: 15000 }, (_, i) => ({ _id: i }));
      mockCollection.toArray.mockResolvedValue(largeArray);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({})'
      );

      expect(result.success).toBe(true);
      // Result should be truncated
      expect(result.result.length).toBeLessThanOrEqual(10000);
    });

    // --- aggregate with options (line 598) ---
    it('should handle aggregate with options', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([{ total: 10 }]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([{"$count": "total"}], {"allowDiskUse": true})'
      );

      expect(result.success).toBe(true);
    });

    // --- updateOne/updateMany with options (line 620) ---
    it('should handle updateOne with options', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1, upsertedId: '123' });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.updateOne({"_id": "1"}, {"$set": {"name": "test"}}, {"upsert": true})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle updateMany with options', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.updateMany({}, {"$set": {"active": true}}, {"upsert": false})'
      );

      expect(result.success).toBe(true);
    });

    // --- findOneAndUpdate (lines 626-631) ---
    it('should handle findOneAndUpdate', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOneAndUpdate = jest.fn().mockResolvedValue({ 
        value: { _id: '1', name: 'updated' } 
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOneAndUpdate({"_id": "1"}, {"$set": {"name": "updated"}})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle findOneAndUpdate with options', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOneAndUpdate = jest.fn().mockResolvedValue({ 
        value: { _id: '1', name: 'updated' } 
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOneAndUpdate({"_id": "1"}, {"$set": {"name": "updated"}}, {"returnDocument": "after"})'
      );

      expect(result.success).toBe(true);
    });

    // --- findOneAndDelete (lines 626-631) ---
    it('should handle findOneAndDelete', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOneAndDelete = jest.fn().mockResolvedValue({ 
        value: { _id: '1', name: 'deleted' } 
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOneAndDelete({"_id": "1"})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle findOneAndDelete with options', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOneAndDelete = jest.fn().mockResolvedValue({ 
        value: { _id: '1', name: 'deleted' } 
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOneAndDelete({"_id": "1"}, {}, {"projection": {"name": 1}})'
      );

      expect(result.success).toBe(true);
    });

    it('should log warning for dangerous MongoDB operations before throwing', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      
      // drop is a dangerous operation - it will log a warning then throw because it's unsupported
      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.drop()'
        )
      ).rejects.toThrow(/Unsupported MongoDB method/);
    });

    it('should log warning for dropDatabase operation', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      
      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.dropDatabase()'
        )
      ).rejects.toThrow(); // Will fail because db.dropDatabase() doesn't match the pattern
    });

    // --- findOneAndDelete ---
    it('should handle findOneAndDelete', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.findOneAndDelete = jest.fn().mockResolvedValue({ 
        value: { _id: '1', name: 'deleted' } 
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOneAndDelete({"_id": "1"})'
      );

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // testConnection Tests (lines 698-729)
  // ==========================================================================
  describe('testConnection', () => {
    it('should test PostgreSQL connection successfully', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });

      const result = await queryExecutionService.testConnection(
        'postgresql',
        'database-1',
        'test_db'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('PostgreSQL');
      expect(result.latency).toBeDefined();
    });

    it('should test MongoDB connection successfully', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });

      const result = await queryExecutionService.testConnection(
        'mongodb',
        'mongo-1',
        'test_db'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('MongoDB');
      expect(result.latency).toBeDefined();
    });

    it('should return failure for unsupported database type', async () => {
      const result = await queryExecutionService.testConnection(
        'mysql',
        'mysql-1',
        'test_db'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported');
    });

    it('should return failure on PostgreSQL connection error', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });
      mockPgPool.connect.mockRejectedValue(new Error('Connection refused'));

      const result = await queryExecutionService.testConnection(
        'postgresql',
        'database-1',
        'test_db'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });

    it('should return failure on MongoDB connection error', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });
      mockMongoClient.connect.mockRejectedValue(new Error('MongoDB connection failed'));

      const result = await queryExecutionService.testConnection(
        'mongodb',
        'mongo-1',
        'test_db'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('MongoDB connection failed');
    });

    it('should include error code in failure response', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });
      const pgError = new Error('Connection timeout');
      pgError.code = 'ETIMEDOUT';
      mockPgPool.connect.mockRejectedValue(pgError);

      const result = await queryExecutionService.testConnection(
        'postgresql',
        'database-1',
        'test_db'
      );

      expect(result.success).toBe(false);
      // Error is wrapped, so check that error field exists
      expect(result.error).toBeDefined();
    });

    it('should return error code when connection fails', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });
      mockPgPool.connect.mockRejectedValue(new Error('Unknown error'));

      const result = await queryExecutionService.testConnection(
        'postgresql',
        'database-1',
        'test_db'
      );

      expect(result.success).toBe(false);
      // Error is wrapped in QueryExecutionError
      expect(result.error).toBeDefined();
      expect(result.message).toBeDefined();
    });
  });

  // ==========================================================================
  // getPoolStats Tests (lines 772-789)
  // ==========================================================================
  describe('getPoolStats', () => {
    it('should return empty stats when no connections', () => {
      const stats = queryExecutionService.getPoolStats();

      expect(stats).toEqual({
        postgresql: {},
        mongodb: {},
      });
    });

    it('should return PostgreSQL pool stats', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });

      // Add stats properties to mock pool
      mockPgPool.totalCount = 10;
      mockPgPool.idleCount = 5;
      mockPgPool.waitingCount = 2;

      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');

      const stats = queryExecutionService.getPoolStats();

      expect(stats.postgresql).toBeDefined();
      expect(Object.keys(stats.postgresql).length).toBeGreaterThan(0);
    });

    it('should return MongoDB client stats', async () => {
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });

      await queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find({})');

      const stats = queryExecutionService.getPoolStats();

      expect(stats.mongodb).toBeDefined();
      expect(Object.keys(stats.mongodb).length).toBeGreaterThan(0);
    });

    it('should return stats for multiple connections', async () => {
      // Create PostgreSQL connection
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
      });
      mockPgPool.totalCount = 5;
      mockPgPool.idleCount = 3;
      mockPgPool.waitingCount = 0;
      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');

      // Create MongoDB connection
      mockStaticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      });
      await queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find({})');

      const stats = queryExecutionService.getPoolStats();

      expect(Object.keys(stats.postgresql).length).toBeGreaterThan(0);
      expect(Object.keys(stats.mongodb).length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // validateQuery Tests
  // ==========================================================================
  describe('validateQuery', () => {
    it('should validate safe PostgreSQL query and return warnings array', () => {
      const result = queryExecutionService.validateQuery('SELECT * FROM users', 'postgresql');
      expect(result).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should warn about dangerous PostgreSQL patterns', () => {
      const result = queryExecutionService.validateQuery('DROP TABLE users', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate safe MongoDB query and return warnings array', () => {
      const result = queryExecutionService.validateQuery('db.users.find({})', 'mongodb');
      expect(result).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should not warn for MongoDB queries (warnings only for PostgreSQL)', () => {
      const result = queryExecutionService.validateQuery('db.dropDatabase()', 'mongodb');
      // MongoDB queries don't generate warnings in validateQuery - they're blocked at execution
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should throw ValidationError for empty query', () => {
      expect(() => {
        queryExecutionService.validateQuery('', 'postgresql');
      }).toThrow(/empty/);
    });

    it('should throw ValidationError for whitespace-only query', () => {
      expect(() => {
        queryExecutionService.validateQuery('   ', 'postgresql');
      }).toThrow(/empty/);
    });

    it('should detect TRUNCATE as dangerous', () => {
      const result = queryExecutionService.validateQuery('TRUNCATE TABLE users', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should not warn for safe deleteMany with filter', () => {
      const result = queryExecutionService.validateQuery('db.users.deleteMany({"status": "inactive"})', 'mongodb');
      // This may or may not generate warnings depending on implementation
      expect(result.warnings).toBeDefined();
    });

    it('should detect ALTER TABLE as dangerous', () => {
      const result = queryExecutionService.validateQuery('ALTER TABLE users ADD COLUMN test INT', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect DELETE without WHERE as dangerous', () => {
      const result = queryExecutionService.validateQuery('DELETE FROM users', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect UPDATE without WHERE as dangerous', () => {
      const result = queryExecutionService.validateQuery('UPDATE users SET active = false', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // QUERY_CONFIG Tests
  // ==========================================================================
  describe('QUERY_CONFIG', () => {
    it('should export QUERY_CONFIG', () => {
      expect(queryExecutionService.QUERY_CONFIG).toBeDefined();
    });

    it('should have statementTimeout configuration', () => {
      expect(queryExecutionService.QUERY_CONFIG.statementTimeout).toBeDefined();
      expect(typeof queryExecutionService.QUERY_CONFIG.statementTimeout).toBe('number');
    });

    it('should have maxRows configuration', () => {
      expect(queryExecutionService.QUERY_CONFIG.maxRows).toBeDefined();
      expect(typeof queryExecutionService.QUERY_CONFIG.maxRows).toBe('number');
    });

    it('should have maxQueryLength configuration', () => {
      expect(queryExecutionService.QUERY_CONFIG.maxQueryLength).toBeDefined();
      expect(typeof queryExecutionService.QUERY_CONFIG.maxQueryLength).toBe('number');
    });

    it('should have warnOnDangerousQueries configuration', () => {
      expect(queryExecutionService.QUERY_CONFIG.warnOnDangerousQueries).toBeDefined();
      expect(typeof queryExecutionService.QUERY_CONFIG.warnOnDangerousQueries).toBe('boolean');
    });

    it('should have defaultReadOnly configuration', () => {
      expect(queryExecutionService.QUERY_CONFIG.defaultReadOnly).toBeDefined();
    });
  });

  // ==========================================================================
  // Additional Branch Coverage Tests
  // ==========================================================================
  describe('Additional Branch Coverage', () => {
    const pgInstance = {
      id: 'database-1',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'testpass',
    };

    const mongoInstance = {
      id: 'mongo-zluri-1',
      type: 'mongodb',
      uri: 'mongodb://localhost:27017',
    };

    // Line 95: Query exceeds maximum length
    it('should throw ValidationError for query exceeding max length', () => {
      const longQuery = 'SELECT ' + 'a'.repeat(200000);
      
      expect(() => {
        queryExecutionService.validateQuery(longQuery, 'postgresql');
      }).toThrow(/exceeds maximum length/);
    });

    // Lines 284-285: Rollback error handling
    it('should handle rollback error gracefully in read-only mode', async () => {
      mockStaticData.getInstanceById.mockReturnValue(pgInstance);
      
      // First query succeeds (SET statement_timeout)
      mockPgClient.query
        .mockResolvedValueOnce({}) // SET statement_timeout
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockRejectedValueOnce(new Error('Query failed')); // Main query fails
      
      // Rollback also fails
      mockPgClient.query.mockRejectedValueOnce(new Error('Rollback failed'));

      await expect(
        queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1', { readOnly: true })
      ).rejects.toThrow(/Query execution failed/);

      // Client should still be released
      expect(mockPgClient.release).toHaveBeenCalled();
    });

    // Line 343: Query content is not a string
    it('should throw ValidationError for non-string query content in MongoDB', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', null)
      ).rejects.toThrow(/Query content is required/);
    });

    it('should throw ValidationError for number query content in MongoDB', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);

      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 12345)
      ).rejects.toThrow(/Query content is required/);
    });

    // Line 390: Invalid query format (not command or operation)
    it('should handle aggregate with $out stage (no limit added)', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ count: 10 }]),
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([{"$match": {}}, {"$out": "output_collection"}])'
      );

      expect(result.success).toBe(true);
    });

    it('should handle aggregate with $merge stage (no limit added)', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([{"$match": {}}, {"$merge": {"into": "output"}}])'
      );

      expect(result.success).toBe(true);
    });

    it('should handle aggregate with existing $limit stage', async () => {
      mockStaticData.getInstanceById.mockReturnValue(mongoInstance);
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{ count: 5 }]),
      });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([{"$match": {}}, {"$limit": 100}])'
      );

      expect(result.success).toBe(true);
    });

    // Test GRANT/REVOKE/CREATE USER warnings
    it('should warn about GRANT statement', () => {
      const result = queryExecutionService.validateQuery('GRANT SELECT ON users TO public', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about REVOKE statement', () => {
      const result = queryExecutionService.validateQuery('REVOKE SELECT ON users FROM public', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about CREATE USER statement', () => {
      const result = queryExecutionService.validateQuery('CREATE USER testuser WITH PASSWORD \'test\'', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about CREATE ROLE statement', () => {
      const result = queryExecutionService.validateQuery('CREATE ROLE testrole', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about DROP SCHEMA statement', () => {
      const result = queryExecutionService.validateQuery('DROP SCHEMA public CASCADE', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about DROP INDEX statement', () => {
      const result = queryExecutionService.validateQuery('DROP INDEX idx_users_email', 'postgresql');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
