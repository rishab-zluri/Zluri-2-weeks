/**
 * Query Execution Service Tests
 * Tests for PostgreSQL and MongoDB query execution
 */

// Mock dependencies
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  })),
}));

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    db: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('../src/config/staticData');

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const staticData = require('../src/config/staticData');
const queryExecutionService = require('../src/services/queryExecutionService');
const { ValidationError, QueryExecutionError } = require('../src/utils/errors');

describe('Query Execution Service', () => {
  let mockPgPool;
  let mockMongoClient;
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup PostgreSQL mock
    mockPgPool = {
      query: jest.fn(),
      on: jest.fn(),
      end: jest.fn().mockResolvedValue(),
    };
    Pool.mockImplementation(() => mockPgPool);

    // Setup MongoDB mock
    mockCollection = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      aggregate: jest.fn().mockReturnThis(),
      countDocuments: jest.fn(),
      distinct: jest.fn(),
      insertOne: jest.fn(),
      insertMany: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      command: jest.fn(),
    };

    mockMongoClient = {
      connect: jest.fn().mockResolvedValue(),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue(),
    };

    MongoClient.mockImplementation(() => mockMongoClient);
  });

  afterEach(async () => {
    // Clear connection pools to ensure fresh mocks for each test
    await queryExecutionService.closeAllConnections();
  });

  describe('executePostgresQuery', () => {
    it('should execute PostgreSQL query successfully', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        name: 'Database 1',
        type: 'postgresql',
        _connection: {
          host: 'localhost',
          port: 5432,
        },
      });

      mockPgPool.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        fields: [{ name: 'id', dataTypeID: 23 }],
        command: 'SELECT',
      });

      const result = await queryExecutionService.executePostgresQuery(
        'database-1',
        'test_db',
        'SELECT * FROM users'
      );

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
      expect(result.rows).toHaveLength(1);
    });

    it('should throw ValidationError for invalid instance', async () => {
      staticData.getInstanceById.mockReturnValue(null);

      await expect(
        queryExecutionService.executePostgresQuery('invalid', 'test_db', 'SELECT 1')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-PostgreSQL instance', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
      });

      await expect(
        queryExecutionService.executePostgresQuery('mongo-1', 'test_db', 'SELECT 1')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw QueryExecutionError on query failure', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        _connection: { host: 'localhost', port: 5432 },
      });

      mockPgPool.query.mockRejectedValue(new Error('Query failed'));

      await expect(
        queryExecutionService.executePostgresQuery('database-1', 'test_db', 'INVALID')
      ).rejects.toThrow(QueryExecutionError);
    });
  });

  describe('executeMongoQuery', () => {
    beforeEach(() => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        name: 'Mongo 1',
        type: 'mongodb',
        _connection: {
          connectionString: 'mongodb://localhost:27017',
        },
      });
    });

    it('should execute find query successfully', async () => {
      mockCollection.toArray.mockResolvedValue([
        { _id: '1', name: 'Test' },
      ]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find({})'
      );

      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(1);
    });

    it('should execute findOne query', async () => {
      mockCollection.findOne.mockResolvedValue({ _id: '1', name: 'Test' });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOne({"_id": "1"})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute aggregate query', async () => {
      mockCollection.toArray.mockResolvedValue([{ count: 10 }]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.aggregate([{"$count": "total"}])'
      );

      expect(result.success).toBe(true);
    });

    it('should execute countDocuments query', async () => {
      mockCollection.countDocuments.mockResolvedValue(5);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.countDocuments({})'
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(5);
    });

    it('should execute distinct query', async () => {
      mockCollection.distinct.mockResolvedValue(['value1', 'value2']);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.distinct("field", {})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute insertOne query', async () => {
      mockCollection.insertOne.mockResolvedValue({ insertedId: '123' });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.insertOne({"name": "test"})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute insertMany query', async () => {
      mockCollection.insertMany.mockResolvedValue({ insertedCount: 2 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.insertMany([{"name": "a"}, {"name": "b"}])'
      );

      expect(result.success).toBe(true);
    });

    it('should execute updateOne query', async () => {
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.updateOne({"_id": "1"}, {"$set": {"name": "updated"}})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute updateMany query', async () => {
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.updateMany({}, {"$set": {"active": true}})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute deleteOne query', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.deleteOne({"_id": "1"})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute deleteMany query', async () => {
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 10 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.deleteMany({"active": false})'
      );

      expect(result.success).toBe(true);
    });

    it('should execute JSON command', async () => {
      mockDb.command.mockResolvedValue({ ok: 1 });

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        '{"ping": 1}'
      );

      expect(result.success).toBe(true);
    });

    it('should handle db["collection"] syntax', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db["users-collection"].find({})'
      );

      expect(result.success).toBe(true);
    });

    it('should throw ValidationError for invalid instance', async () => {
      staticData.getInstanceById.mockReturnValue(null);

      await expect(
        queryExecutionService.executeMongoQuery('invalid', 'test_db', 'db.test.find()')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-MongoDB instance', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'pg-1',
        type: 'postgresql',
      });

      await expect(
        queryExecutionService.executeMongoQuery('pg-1', 'test_db', 'db.test.find()')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid query format', async () => {
      await expect(
        queryExecutionService.executeMongoQuery('mongo-zluri-1', 'test_db', 'invalid query')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for unsupported method', async () => {
      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.unsupportedMethod({})'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('executeQuery', () => {
    it('should route PostgreSQL queries correctly', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        _connection: { host: 'localhost', port: 5432 },
      });

      mockPgPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
      });

      const result = await queryExecutionService.executeQuery({
        databaseType: 'postgresql',
        instanceId: 'database-1',
        databaseName: 'test_db',
        queryContent: 'SELECT 1',
      });

      expect(result.success).toBe(true);
    });

    it('should route MongoDB queries correctly', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
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

    it('should throw ValidationError for unsupported database type', async () => {
      await expect(
        queryExecutionService.executeQuery({
          databaseType: 'mysql',
          instanceId: 'mysql-1',
          databaseName: 'test_db',
          queryContent: 'SELECT 1',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('closeAllConnections', () => {
    it('should close all connections', async () => {
      // This test verifies the function runs without error
      await expect(queryExecutionService.closeAllConnections()).resolves.not.toThrow();
    });

    it('should handle PostgreSQL pool close errors', async () => {
      // First create a connection
      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        _connection: { host: 'localhost', port: 5432 },
      });

      mockPgPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
      });

      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');

      // Now make close throw an error
      mockPgPool.end.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(queryExecutionService.closeAllConnections()).resolves.not.toThrow();
    });

    it('should handle MongoDB client close errors', async () => {
      // First create a connection
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      mockCollection.toArray.mockResolvedValue([]);
      
      await queryExecutionService.executeMongoQuery('mongo-1', 'test_db', 'db.test.find({})');

      // Now make close throw an error
      mockMongoClient.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(queryExecutionService.closeAllConnections()).resolves.not.toThrow();
    });
  });

  describe('parseMongoQuery - additional coverage', () => {
    it('should handle count method (alias)', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      mockCollection.countDocuments.mockResolvedValue(10);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.count({})'
      );

      expect(result.success).toBe(true);
    });

    it('should handle empty arguments', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      mockCollection.toArray.mockResolvedValue([]);

      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.find()'
      );

      expect(result.success).toBe(true);
    });

    it('should handle invalid JSON arguments', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.find({invalid json})'
        )
      ).rejects.toThrow(/Arguments must be valid JSON/);
    });

    it('should handle default case in parseMatchedQuery', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      // Use an unknown method that will hit the default case
      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.users.someUnknownMethod({"arg": 1})'
        )
      ).rejects.toThrow(/Unsupported MongoDB method/);
    });

    it('should throw error for invalid query type', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      // Empty braces is not a valid command format
      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'random text that is not valid'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('PostgreSQL pool error handler', () => {
    it('should register error handler on pool', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'database-1',
        type: 'postgresql',
        _connection: { host: 'localhost', port: 5432 },
      });

      mockPgPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
      });

      await queryExecutionService.executePostgresQuery('database-1', 'test_db', 'SELECT 1');

      // Verify error handler was registered
      expect(mockPgPool.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Get the error handler and call it
      const errorHandler = mockPgPool.on.mock.calls.find(call => call[0] === 'error')[1];
      expect(() => errorHandler(new Error('Pool error'))).not.toThrow();
    });
  });

  describe('MongoDB re-throw behavior', () => {
    it('should re-throw ValidationError from MongoDB execution', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      // An invalid query format will cause ValidationError
      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'not a valid format'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should wrap generic MongoDB errors in QueryExecutionError', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      mockMongoClient.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(
        queryExecutionService.executeMongoQuery(
          'mongo-zluri-1',
          'test_db',
          'db.test.find({})'
        )
      ).rejects.toThrow(QueryExecutionError);
    });
  });

  describe('parseArguments edge cases', () => {
    it('should handle single JSON object arguments', async () => {
      staticData.getInstanceById.mockReturnValue({
        id: 'mongo-zluri-1',
        type: 'mongodb',
        _connection: { connectionString: 'mongodb://localhost:27017' },
      });

      mockCollection.findOne.mockResolvedValue({ _id: '1' });

      // Single object argument
      const result = await queryExecutionService.executeMongoQuery(
        'mongo-zluri-1',
        'test_db',
        'db.users.findOne({"name": "test"})'
      );

      expect(result.success).toBe(true);
    });
  });
});
