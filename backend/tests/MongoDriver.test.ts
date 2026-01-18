/**
 * MongoDriver Tests
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Define mocks before imports
const mockGetMongoClient = jest.fn<any>();
const mockDisconnect = jest.fn<any>();
const mockGetStats = jest.fn<any>();
const mockGetInstance = jest.fn<any>();

// Mock the ConnectionPool module with a factory
jest.mock('../src/services/queryExecution/ConnectionPool', () => {
    return {
        ConnectionPool: {
            getInstance: mockGetInstance
        }
    };
});

jest.mock('../src/config/staticData');
jest.mock('../src/utils/logger');
jest.mock('mongodb');

import { MongoDriver } from '../src/services/queryExecution/strategies/MongoDriver';
import { getInstanceById } from '../src/config/staticData';
import { ValidationError, QueryExecutionError } from '../src/utils/errors';
import { MongoExecutionResult } from '../src/services/queryExecution/interfaces';

describe('MongoDriver', () => {
    let driver: MongoDriver;
    let mockClient: any;
    let mockDb: any;
    let mockCollection: any;

    const mockInstance = {
        id: 'mongo-1',
        name: 'Test Mongo',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
        host: 'localhost',
        port: 27017
    };

    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, QUERY_MAX_ROWS: '10000' };

        // Setup ConnectionPool mock return
        mockGetInstance.mockReturnValue({
            getMongoClient: mockGetMongoClient,
            disconnect: mockDisconnect,
            getStats: mockGetStats
        });

        // Setup Mocks
        mockCollection = {
            find: jest.fn<any>().mockReturnThis(),
            limit: jest.fn<any>().mockReturnThis(),
            toArray: jest.fn<any>().mockResolvedValue([]),
            findOne: jest.fn<any>().mockResolvedValue(null),
            countDocuments: jest.fn<any>().mockResolvedValue(0),
            estimatedDocumentCount: jest.fn<any>().mockResolvedValue(0),
            distinct: jest.fn<any>().mockResolvedValue([]),
            insertOne: jest.fn<any>().mockResolvedValue({ insertedId: '1', acknowledged: true }),
            insertMany: jest.fn<any>().mockResolvedValue({ insertedCount: 1, acknowledged: true }),
            updateOne: jest.fn<any>().mockResolvedValue({ modifiedCount: 1, acknowledged: true }),
            updateMany: jest.fn<any>().mockResolvedValue({ modifiedCount: 2, acknowledged: true }),
            deleteOne: jest.fn<any>().mockResolvedValue({ deletedCount: 1, acknowledged: true }),
            deleteMany: jest.fn<any>().mockResolvedValue({ deletedCount: 2, acknowledged: true }),
            findOneAndUpdate: jest.fn<any>().mockResolvedValue({ value: {} }),
            findOneAndDelete: jest.fn<any>().mockResolvedValue({ value: {} }),
            aggregate: jest.fn<any>().mockReturnThis(),
        };

        mockDb = {
            collection: jest.fn<any>().mockReturnValue(mockCollection),
            command: jest.fn<any>().mockResolvedValue({ ok: 1 }),
        };

        mockClient = {
            db: jest.fn<any>().mockReturnValue(mockDb),
            close: jest.fn<any>(),
        };

        // Wire up client return
        mockGetMongoClient.mockResolvedValue(mockClient);

        (getInstanceById as jest.Mock).mockReturnValue(mockInstance);

        // Init driver
        driver = new MongoDriver();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Query Parsing', () => {
        it('should parse simple find query', async () => {
            const query = 'db.users.find({})';
            await driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: query,
                databaseType: 'mongodb'
            });

            expect(mockGetMongoClient).toHaveBeenCalled();
            expect(mockDb.collection).toHaveBeenCalledWith('users');
            expect(mockCollection.find).toHaveBeenCalledWith({});
        });

        it('should parse collection with bracket notation (double quotes)', async () => {
            const query = 'db["my-users"].find({})';
            await driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: query,
                databaseType: 'mongodb'
            });

            expect(mockDb.collection).toHaveBeenCalledWith('my-users');
        });

        it('should parse collection with bracket notation (single quotes)', async () => {
            const query = "db['my-users'].find({})";
            await driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: query,
                databaseType: 'mongodb'
            });

            expect(mockDb.collection).toHaveBeenCalledWith('my-users');
        });

        it('should parse valid JSON command', async () => {
            const query = '{ "ping": 1 }';
            await driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: query,
                databaseType: 'mongodb'
            });

            expect(mockDb.command).toHaveBeenCalledWith({ ping: 1 });
        });

        it('should throw on invalid format', async () => {
            const query = 'invalid query';
            await expect(driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: query,
                databaseType: 'mongodb'
            })).rejects.toThrow();
        });

        it('should throw on invalid arguments JSON', async () => {
            const query = 'db.users.find({ invalid json })';
            await expect(driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: query,
                databaseType: 'mongodb'
            })).rejects.toThrow(/Failed to parse query arguments/);
        });
    });

    describe('Method Mapping', () => {
        const testCases = [
            { method: 'findOne', query: 'db.c.findOne({"a":1})', expected: 'findOne' },
            { method: 'estimatedDocumentCount', query: 'db.c.estimatedDocumentCount()', expected: 'estimatedDocumentCount' },
            { method: 'distinct', query: 'db.c.distinct("field")', expected: 'distinct' },
            { method: 'insertOne', query: 'db.c.insertOne({"a":1})', expected: 'insertOne' },
            { method: 'insertMany', query: 'db.c.insertMany([{"a":1}])', expected: 'insertMany' },
            { method: 'updateOne', query: 'db.c.updateOne({"a":1}, {"$set":{"b":1}})', expected: 'updateOne' },
            { method: 'updateMany', query: 'db.c.updateMany({"a":1}, {"$set":{"b":1}})', expected: 'updateMany' },
            { method: 'deleteOne', query: 'db.c.deleteOne({"a":1})', expected: 'deleteOne' },
            { method: 'deleteMany', query: 'db.c.deleteMany({"a":1})', expected: 'deleteMany' },
            { method: 'findOneAndUpdate', query: 'db.c.findOneAndUpdate({"a":1}, {"$set":{"b":1}})', expected: 'findOneAndUpdate' },
            { method: 'findOneAndDelete', query: 'db.c.findOneAndDelete({"a":1})', expected: 'findOneAndDelete' },
        ];

        testCases.forEach(({ method, query, expected }) => {
            it(`should execute ${method}`, async () => {
                await driver.execute({
                    instanceId: 'mongo-1',
                    databaseName: 'test',
                    queryContent: query,
                    databaseType: 'mongodb'
                });
                expect(mockCollection[expected]).toHaveBeenCalled();
            });
        });
    });

    describe('Validation', () => {
        it('should warn on dangerous operations', () => {
            const result = driver.validate('db.c.drop()');
            expect(result.valid).toBe(true);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].type).toBe('dangerous_operation');
        });

        it('should fail if query too long', () => {
            const longQuery = 'x'.repeat(100001);
            expect(() => driver.validate(longQuery)).toThrow(ValidationError);
        });

        it('should fail if query empty', () => {
            expect(() => driver.validate('')).toThrow(ValidationError);
        });
    });

    describe('Execution Results', () => {
        it('should detect truncation', async () => {
            mockCollection.toArray.mockResolvedValue(new Array(10000).fill({}));

            const result = (await driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: 'db.c.find({})',
                databaseType: 'mongodb'
            })) as MongoExecutionResult;

            expect(result.truncated).toBe(true);
            expect(result.documentCount).toBe(10000);
        });

        it('should handle insertOne result count', async () => {
            const result = (await driver.execute({
                instanceId: 'mongo-1',
                databaseName: 'test',
                queryContent: 'db.c.insertOne({"a":1})',
                databaseType: 'mongodb'
            })) as MongoExecutionResult;
            expect(result.documentCount).toBe(1);
        });
    });

    describe('Connection Test', () => {
        it('should return success on valid connection', async () => {
            const result = await driver.testConnection(mockInstance, 'test');
            expect(result.success).toBe(true);
            expect(mockDb.command).toHaveBeenCalledWith({ ping: 1 });
        });

        it('should return failure on error', async () => {
            mockGetMongoClient.mockRejectedValueOnce(new Error('Connect failed'));

            const result = await driver.testConnection(mockInstance, 'test');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Connect failed');
        });
    });
});
