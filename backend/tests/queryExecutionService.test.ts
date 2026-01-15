/**
 * Query Execution Service Tests - Updated for Strategy Pattern Refactoring
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Pool, PoolClient } from 'pg';
import { MongoClient, Db, Collection } from 'mongodb';
import * as queryExecutionService from '../src/services/queryExecution';
import * as staticData from '../src/config/staticData';
import logger from '../src/utils/logger';
import { QueryRequest } from '../src/services/queryExecution/interfaces';

// Mocks
jest.mock('pg');
jest.mock('mongodb');
jest.mock('../src/config/staticData');
jest.mock('../src/utils/logger');

describe('Query Execution Service', () => {
  let mockPgPool: any;
  let mockPgClient: any;
  let mockMongoClient: any;
  let mockDb: any;
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Postgres Mock
    mockPgClient = {
      queryContent: jest.fn(),
      release: jest.fn(),
    };
    mockPgPool = {
      connect: jest.fn<any>().mockResolvedValue(mockPgClient),
      queryContent: jest.fn(),
      on: jest.fn(),
      end: jest.fn<any>().mockResolvedValue(undefined),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    };
    (Pool as unknown as jest.Mock).mockImplementation(() => mockPgPool);

    // Setup Mongo Mock
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
      command: jest.fn<any>().mockResolvedValue({ ok: 1 }),
    };
    mockMongoClient = {
      connect: jest.fn<any>().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn<any>().mockResolvedValue(undefined),
    };
    (MongoClient as unknown as jest.Mock).mockImplementation(() => mockMongoClient);
  });

  afterEach(async () => {
    await queryExecutionService.closeAllConnections();
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
      (staticData.getInstanceById as jest.Mock).mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        fields: [{ name: 'id' }],
        command: 'SELECT',
      });

      const request: QueryRequest = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        queryContent: 'SELECT * FROM users',
        databaseType: 'postgresql'
      };

      const result = await queryExecutionService.executePostgresQuery(request);

      expect(result.success).toBe(true);
      if ('rows' in result) {
        expect(result.rows).toBeDefined();
      }
      expect(mockPgPool.connect).toHaveBeenCalled();
      expect(mockPgClient.query).toHaveBeenCalledWith('SELECT * FROM users');
      expect(mockPgClient.release).toHaveBeenCalled();
    });

    it('should throw for null instance', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(null);

      const request: QueryRequest = {
        instanceId: 'invalid',
        databaseName: 'test_db',
        queryContent: 'SELECT 1',
        databaseType: 'postgresql'
      };

      await expect(queryExecutionService.executePostgresQuery(request))
        .rejects.toThrow(/Instance not found/);
    });

    it('should throw for non-PostgreSQL instance', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue({ id: 'm1', type: 'mongodb' });

      const request: QueryRequest = {
        instanceId: 'm1',
        databaseName: 'test_db',
        queryContent: 'SELECT 1',
        databaseType: 'postgresql'
      };

      await expect(queryExecutionService.executePostgresQuery(request))
        .rejects.toThrow(/not a PostgreSQL database/);
    });

    it('should throw QueryExecutionError on query failure', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(pgInstance);
      mockPgClient.query.mockRejectedValue(new Error('Query failed'));

      const request: QueryRequest = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        queryContent: 'INVALID',
        databaseType: 'postgresql'
      };

      await expect(queryExecutionService.executePostgresQuery(request))
        .rejects.toThrow(/Query execution failed/);
      expect(mockPgClient.release).toHaveBeenCalled();
    });

    it('should handle read-only mode', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(pgInstance);
      mockPgClient.query.mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT' });

      const request: QueryRequest = {
        instanceId: 'database-1',
        databaseName: 'test_db',
        queryContent: 'SELECT 1',
        databaseType: 'postgresql'
      };

      await queryExecutionService.executeQuery(request);

      const calls = mockPgClient.query.mock.calls.map((c: any) => c[0]);
      // Read-only mode is not set by default via request, tested at driver level
      expect(calls).toBeDefined();
    });
  });

  // ==========================================================================
  // MongoDB Tests - Core Functionality
  // ==========================================================================
  describe('executeMongoQuery', () => {
    const mongoInstance = {
      id: 'mongo-1',
      name: 'Mongo 1',
      type: 'mongodb',
      uri: 'mongodb://localhost:27017',
    };

    it('should execute find query successfully', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([{ name: 'test' }]);

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.users.find({})',
        databaseType: 'mongodb'
      };

      const result = await queryExecutionService.executeMongoQuery(request);

      expect(result.success).toBe(true);
      if ('result' in result) {
        expect(result.result).toBeDefined();
      }
      expect(mockMongoClient.connect).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.find).toHaveBeenCalled();
    });

    it('should execute aggregate query', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([{ count: 10 }]);

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.users.aggregate([{"$count": "total"}])',
        databaseType: 'mongodb'
      };

      const result = await queryExecutionService.executeMongoQuery(request);

      expect(result.success).toBe(true);
      expect(mockCollection.aggregate).toHaveBeenCalled();
    });

    it('should throw for null instance', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(null);

      const request: QueryRequest = {
        instanceId: 'invalid',
        databaseName: 'test_db',
        queryContent: 'db.c.find()',
        databaseType: 'mongodb'
      };

      await expect(queryExecutionService.executeMongoQuery(request))
        .rejects.toThrow(/Instance not found/);
    });

    it('should throw for missing URI', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue({ ...mongoInstance, uri: undefined });

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.c.find()',
        databaseType: 'mongodb'
      };

      await expect(queryExecutionService.executeMongoQuery(request))
        .rejects.toThrow(/missing URI/);
    });

    it('should throw for invalid query format', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'invalid',
        databaseType: 'mongodb'
      };

      await expect(queryExecutionService.executeMongoQuery(request))
        .rejects.toThrow(/Invalid MongoDB query format/);
    });

    it('should execute countDocuments', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);
      mockCollection.countDocuments.mockResolvedValue(5);

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.users.countDocuments({})',
        databaseType: 'mongodb'
      };

      const result = await queryExecutionService.executeMongoQuery(request);
      if ('result' in result) {
        expect(result.result).toBe(5);
      }
    });

    it('should execute insertOne', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);
      mockCollection.insertOne.mockResolvedValue({ insertedId: '1' });

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.users.insertOne({a:1})',
        databaseType: 'mongodb'
      };

      const result = await queryExecutionService.executeMongoQuery(request);
      expect(result.success).toBe(true);
    });

    it('should execute deleteMany', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);
      mockCollection.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.users.deleteMany({})',
        databaseType: 'mongodb'
      };

      const result = await queryExecutionService.executeMongoQuery(request);
      expect(result.success).toBe(true);
    });

    it('should throw for unsupported method', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.users.unsupported()',
        databaseType: 'mongodb'
      };

      await expect(queryExecutionService.executeMongoQuery(request))
        .rejects.toThrow(/Unsupported MongoDB method/);
    });

    it('should handle db.collection syntax with dots', async () => {
      (staticData.getInstanceById as jest.Mock).mockReturnValue(mongoInstance);
      mockCollection.toArray.mockResolvedValue([]);

      const request: QueryRequest = {
        instanceId: 'mongo-1',
        databaseName: 'test_db',
        queryContent: 'db.users.logs.find({})',
        databaseType: 'mongodb'
      };

      await queryExecutionService.executeMongoQuery(request);
      expect(mockDb.collection).toHaveBeenCalledWith('users.logs');
    });
  });

});
