// @ts-nocheck
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { ConnectionPool } from '../src/services/queryExecution/ConnectionPool';
import { PostgresDriver } from '../src/services/queryExecution/strategies/PostgresDriver';
import { MongoDriver } from '../src/services/queryExecution/strategies/MongoDriver';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';

// Mock pg and mongodb
jest.mock('pg');
jest.mock('mongodb');
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));
jest.mock('../src/config/staticData', () => ({
    getInstanceById: jest.fn((id) => {
        if (id === 'test-pg') return { id: 'test-pg', type: 'postgresql', host: 'localhost', port: 5432 };
        if (id === 'test-mongo') return { id: 'test-mongo', type: 'mongodb', uri: 'mongodb://localhost:27017' };
        if (id === 'test-mongo-host') return { id: 'test-mongo-host', type: 'mongodb', host: 'localhost', port: 27017 };
        return null;
    }),
}));

describe('Query Execution Coverage', () => {
    let mockPgPool: any;
    let mockMongoClient: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup Pool Mock
        mockPgPool = {
            connect: jest.fn(),
            query: jest.fn(), // Added pool.query mock
            end: jest.fn(),
            on: jest.fn(),
            totalCount: 5,
            idleCount: 2,
            waitingCount: 0,
        };
        (Pool as unknown as jest.Mock).mockImplementation(() => mockPgPool);

        // Setup Mongo Mock
        mockMongoClient = {
            connect: jest.fn().mockResolvedValue(undefined),
            db: jest.fn().mockReturnThis(),
            collection: jest.fn().mockReturnThis(),
            close: jest.fn(),
            topology: { isConnected: jest.fn().mockReturnValue(true) },
            // Operation mocks
            command: jest.fn().mockResolvedValue({ ok: 1 }),
            findOne: jest.fn(),
            distinct: jest.fn(),
            updateOne: jest.fn(),
            findOneAndDelete: jest.fn(),
        };
        (MongoClient as unknown as jest.Mock).mockImplementation(() => mockMongoClient);

        // Reset singleton
        // We can't easily reset private singleton, so we just get instance and clear maps if possible
        // Or we use a fresh instance logic if we could, but constructor is private.
        // We will rely on disconnect() to clear maps.
    });

    afterEach(async () => {
        await ConnectionPool.getInstance().disconnect();
    });

    describe('ConnectionPool', () => {
        const poolManager = ConnectionPool.getInstance();

        test('should use env vars for PG config if provided', () => {
            process.env.PG_DEFAULT_USER = 'env_user';

            poolManager.getPgPool('test-pg', {
                id: 'test-pg', type: 'postgresql', host: 'localhost', port: 5432
            }, 'test_db');

            expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
                user: 'env_user'
            }));

            delete process.env.PG_DEFAULT_USER;
        });

        test('should construct Mongo URI from host/port', async () => {
            await poolManager.getMongoClient('test-mongo-host', {
                id: 'test-mongo-host', type: 'mongodb', host: 'localhost', port: 27017, user: 'u', password: 'p'
            });

            expect(MongoClient).toHaveBeenCalledWith(
                expect.stringContaining('mongodb://u:p@localhost:27017'),
                expect.any(Object)
            );
        });

        test('should return stats', async () => {
            // Ensure pools exist
            poolManager.getPgPool('test-pg', { id: 'test-pg', type: 'postgresql', host: 'h', port: 1 }, 'db');
            await poolManager.getMongoClient('test-mongo', { id: 'test-mongo', type: 'mongodb', uri: 'u' });

            const stats = poolManager.getStats();
            expect(stats.postgresql).toBeDefined();
            expect(stats.mongodb).toBeDefined();
            expect(stats.totalCount).toBeGreaterThan(0);
        });

        test('should disconnect specific key', async () => {
            poolManager.getPgPool('test-pg', { id: 'test-pg', type: 'postgresql', host: 'h', port: 1 }, 'db');
            await poolManager.disconnect('test-pg:db'); // Key format is instanceId:dbName
            expect(mockPgPool.end).toHaveBeenCalled();
        });

        test('should disconnect mongo key', async () => {
            await poolManager.getMongoClient('test-mongo', { id: 'test-mongo', type: 'mongodb', uri: 'u' });
            await poolManager.disconnect('test-mongo');
            expect(mockMongoClient.close).toHaveBeenCalled();
        });
    });

    describe('MongoDriver Extra Operations', () => {
        const driver = new MongoDriver();

        test('should handle distinct', async () => {
            mockMongoClient.distinct.mockResolvedValue(['a', 'b']);

            const result = await driver.execute({
                instanceId: 'test-mongo',
                databaseName: 'test_db',
                queryContent: 'db.col.distinct("category")',
                databaseType: 'mongodb'
            });

            expect(result.success).toBe(true);
            expect(mockMongoClient.distinct).toHaveBeenCalled();
        });

        test('should handle updateOne', async () => {
            mockMongoClient.updateOne.mockResolvedValue({ modifiedCount: 1 });

            const result = await driver.execute({
                instanceId: 'test-mongo',
                databaseName: 'test_db',
                queryContent: 'db.col.updateOne({"id": 1}, {"$set": {"a": 2}})',
                databaseType: 'mongodb'
            });

            expect(result.success).toBe(true);
            expect(result.documentCount).toBe(1);
        });

        test('should parse bracket syntax', async () => {
            mockMongoClient.findOne.mockResolvedValue({ id: 1 });

            const result = await driver.execute({
                instanceId: 'test-mongo',
                databaseName: 'test_db',
                queryContent: 'db["col"].findOne({})',
                databaseType: 'mongodb'
            });

            expect(result.success).toBe(true);
        });

        test('should test connection success', async () => {
            const result = await driver.testConnection({
                id: 'test-mongo', type: 'mongodb', uri: 'u'
            }, 'admin');

            expect(result.success).toBe(true);
        });

        test('should test connection failure', async () => {
            mockMongoClient.db().command.mockRejectedValue(new Error('Auth failed'));

            const result = await driver.testConnection({
                id: 'test-mongo', type: 'mongodb', uri: 'u'
            }, 'admin');

            expect(result.success).toBe(false);
            expect(result.message).toContain('failed');
        });
    });

    describe('PostgresDriver Extra Operations', () => {
        const driver = new PostgresDriver();

        test('should test connection success', async () => {
            mockPgPool.connect.mockResolvedValue({
                query: jest.fn(),
                release: jest.fn()
            });

            const result = await driver.testConnection({
                id: 'test-pg', type: 'postgresql', host: 'h', port: 1
            }, 'postgres');

            expect(result.success).toBe(true);
        });

        test('should throw validation error for empty query', () => {
            expect(() => driver.validate('   ')).toThrow('Query cannot be empty');
        });
    });
});
