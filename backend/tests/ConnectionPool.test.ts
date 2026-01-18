/**
 * ConnectionPool Tests
 * Tests for singleton connection pool manager
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import { ConnectionPool } from '../src/services/queryExecution/ConnectionPool';
import logger from '../src/utils/logger';

// Mock dependencies
jest.mock('pg');
jest.mock('mongodb');
jest.mock('../src/utils/logger');

describe('ConnectionPool', () => {
    let mockPgPool: any;
    let mockMongoClient: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset singleton instance
        (ConnectionPool as any).instance = undefined;

        // Setup PG Mock
        mockPgPool = {
            on: jest.fn(),
            end: jest.fn<any>().mockResolvedValue(undefined),
            totalCount: 10,
            idleCount: 5,
            waitingCount: 2,
        };
        (Pool as unknown as jest.Mock).mockImplementation(() => mockPgPool);

        // Setup Mongo Mock
        mockMongoClient = {
            connect: jest.fn<any>().mockResolvedValue(undefined),
            close: jest.fn<any>().mockResolvedValue(undefined),
            topology: {
                isConnected: jest.fn().mockReturnValue(true),
            },
        };
        (MongoClient as unknown as jest.Mock).mockImplementation(() => mockMongoClient);
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = ConnectionPool.getInstance();
            const instance2 = ConnectionPool.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('getPgPool', () => {
        it('should create a new pool if one does not exist', () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { host: 'localhost', port: 5432, id: 'db1', name: 'DB1', type: 'postgresql' as any, databases: [] };

            const pool = poolManager.getPgPool('db1', config as any, 'mydb');

            expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
                host: 'localhost',
                port: 5432,
                database: 'mydb',
            }));
            expect(pool).toBe(mockPgPool);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Created new PG connection pool'), expect.anything());
        });

        it('should reuse existing pool for same key', () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { host: 'localhost', port: 5432, id: 'db1', name: 'DB1', type: 'postgresql' as any, databases: [] };

            const pool1 = poolManager.getPgPool('db1', config as any, 'mydb');
            const pool2 = poolManager.getPgPool('db1', config as any, 'mydb');

            expect(Pool).toHaveBeenCalledTimes(1);
            expect(pool1).toBe(pool2);
        });

        it('should create different pools for different databases on same instance', () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { host: 'localhost', port: 5432, id: 'db1', name: 'DB1', type: 'postgresql' as any, databases: [] };

            poolManager.getPgPool('db1', config as any, 'db_A');
            poolManager.getPgPool('db1', config as any, 'db_B');

            expect(Pool).toHaveBeenCalledTimes(2);
        });

        it('should handle idle client errors', () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { host: 'localhost', port: 5432, id: 'db1', name: 'DB1', type: 'postgresql' as any, databases: [] };

            poolManager.getPgPool('db1', config as any, 'mydb');

            // Get the error handler passed to pool.on
            const calls = mockPgPool.on.mock.calls;
            const errorCallback = calls.find((call: any[]) => call[0] === 'error')?.[1];

            expect(errorCallback).toBeDefined();

            // Simulate error
            errorCallback(new Error('Idle client error'));

            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error on idle client'), expect.anything());
        });

        it('should use environment variables for credentials if not provided', () => {
            process.env.PG_TEST_DB_USER = 'env_user';
            process.env.PG_TEST_DB_PASSWORD = 'env_password';

            const poolManager = ConnectionPool.getInstance();
            const config = { host: 'localhost', port: 5432, id: 'test-db', name: 'Test DB', type: 'postgresql' as any, databases: [] };

            poolManager.getPgPool('test-db', config as any, 'mydb');

            expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
                user: 'env_user',
                password: 'env_password',
            }));

            // Cleanup
            delete process.env.PG_TEST_DB_USER;
            delete process.env.PG_TEST_DB_PASSWORD;
        });
    });

    describe('getMongoClient', () => {
        it('should create a new client with URI if provided', async () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { uri: 'mongodb://localhost:27017', id: 'mongo1', name: 'Mongo1', type: 'mongodb' as any, databases: [] };

            const client = await poolManager.getMongoClient('mongo1', config as any);

            expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017', expect.anything());
            expect(mockMongoClient.connect).toHaveBeenCalled();
            expect(client).toBe(mockMongoClient);
        });

        it('should construct URI from host/port if URI not provided', async () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { host: 'mongo-host', port: 27017, id: 'mongo1', name: 'Mongo1', type: 'mongodb' as any, databases: [] };

            await poolManager.getMongoClient('mongo1', config as any);

            expect(MongoClient).toHaveBeenCalledWith(expect.stringContaining('mongodb://'), expect.anything());
            expect(MongoClient).toHaveBeenCalledWith(expect.stringContaining('mongo-host:27017'), expect.anything());
        });

        it('should reuse existing client', async () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { uri: 'mongodb://localhost:27017', id: 'mongo1', name: 'Mongo1', type: 'mongodb' as any, databases: [] };

            const client1 = await poolManager.getMongoClient('mongo1', config as any);
            const client2 = await poolManager.getMongoClient('mongo1', config as any);

            expect(MongoClient).toHaveBeenCalledTimes(1);
            expect(client1).toBe(client2);
        });

        it('should throw error if config invalid', async () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { id: 'mongo1', name: 'Mongo1', type: 'mongodb' as any, databases: [] }; // Missing uri and host/port

            await expect(poolManager.getMongoClient('mongo1', config as any)).rejects.toThrow('missing uri or host/port');
        });

        it('should handle connection failure', async () => {
            const poolManager = ConnectionPool.getInstance();
            const config = { uri: 'mongodb://bad', id: 'mongo1', name: 'Mongo1', type: 'mongodb' as any, databases: [] };

            mockMongoClient.connect.mockRejectedValue(new Error('Connection failed'));

            await expect(poolManager.getMongoClient('mongo1', config as any)).rejects.toThrow('Connection failed');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should use env vars for auth if constructing URI', async () => {
            process.env.MONGO_TEST_MONGO_USER = 'm_user';
            process.env.MONGO_TEST_MONGO_PASSWORD = 'm_pass';

            const poolManager = ConnectionPool.getInstance();
            const config = { host: 'h', port: 123, id: 'test-mongo', name: 'M', type: 'mongodb' as any, databases: [] };

            await poolManager.getMongoClient('test-mongo', config as any);

            // Check if URI contains credentials
            const constructorCall = (MongoClient as unknown as jest.Mock).mock.calls[0];
            const uri = constructorCall[0] as string;

            expect(uri).toContain('m_user');
            expect(uri).toContain('m_pass');

            delete process.env.MONGO_TEST_MONGO_USER;
            delete process.env.MONGO_TEST_MONGO_PASSWORD;
        });
    });

    describe('getStats', () => {
        it('should return stats for active pools', async () => {
            const poolManager = ConnectionPool.getInstance();

            // Setup PG pool
            poolManager.getPgPool('pg1', { host: 'h', port: 1, id: 'pg1', name: 'P', type: 'postgres' as any, databases: [] } as any, 'db');

            // Setup Mongo client
            await poolManager.getMongoClient('m1', { uri: 'u', id: 'm1', name: 'M', type: 'mongo' as any, databases: [] } as any);

            const stats = poolManager.getStats();

            expect(stats.postgresql).toHaveProperty('pg1:db');
            expect(stats.mongodb).toHaveProperty('m1');
            expect(stats.totalCount).toBe(1);
            expect(stats.connected).toBe(true);
        });
    });

    describe('disconnect', () => {
        it('should disconnect all if no key provided', async () => {
            const poolManager = ConnectionPool.getInstance();

            poolManager.getPgPool('pg1', { host: 'h', port: 1, id: 'pg1', name: 'P', type: 'postgres' as any, databases: [] } as any, 'db');
            await poolManager.getMongoClient('m1', { uri: 'u', id: 'm1', name: 'M', type: 'mongo' as any, databases: [] } as any);

            await poolManager.disconnect();

            expect(mockPgPool.end).toHaveBeenCalled();
            expect(mockMongoClient.close).toHaveBeenCalled();

            const stats = poolManager.getStats();
            expect(stats.totalCount).toBe(0);
            expect(stats.connected).toBe(false);
        });

        it('should disconnect specific pg pool', async () => {
            const poolManager = ConnectionPool.getInstance();
            poolManager.getPgPool('pg1', { host: 'h', port: 1, id: 'pg1', name: 'P', type: 'postgres' as any, databases: [] } as any, 'db');

            await poolManager.disconnect('pg1:db');

            expect(mockPgPool.end).toHaveBeenCalled();
            const stats = poolManager.getStats();
            expect(stats.totalCount).toBe(0);
        });

        it('should disconnect specific mongo client', async () => {
            const poolManager = ConnectionPool.getInstance();
            await poolManager.getMongoClient('m1', { uri: 'u', id: 'm1', name: 'M', type: 'mongo' as any, databases: [] } as any);

            await poolManager.disconnect('m1');

            expect(mockMongoClient.close).toHaveBeenCalled();
            const stats = poolManager.getStats();
            expect(stats.connected).toBe(false);
        });

        it('should do nothing if key not found', async () => {
            const poolManager = ConnectionPool.getInstance();
            await poolManager.disconnect('non-existent');
            // Should just not throw
        });
    });
});
