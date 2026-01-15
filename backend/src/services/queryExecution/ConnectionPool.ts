/**
 * Connection Pool Manager
 * 
 * Manages singleton connection pools for database instances.
 * Prevents connection exhaustion by reusing connections.
 */

import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import { DatabaseInstance as DatabaseInstanceConfig } from '../../config/staticData';
import logger from '../../utils/logger';

export class ConnectionPool {
    private static instance: ConnectionPool;

    // PostgreSQL connection pools - Key: `${instanceId}:${databaseName}`
    private pgPools = new Map<string, Pool>();

    // MongoDB clients - Key: `${instanceId}`
    private mongoClients = new Map<string, MongoClient>();

    private constructor() { }

    public static getInstance(): ConnectionPool {
        if (!ConnectionPool.instance) {
            ConnectionPool.instance = new ConnectionPool();
        }
        return ConnectionPool.instance;
    }

    /**
     * Get or create PostgreSQL connection pool
     */
    public getPgPool(instanceId: string, connectionConfig: DatabaseInstanceConfig & { host: string; port: number; user?: string; password?: string }, databaseName: string): Pool {
        const poolKey = `${instanceId}:${databaseName}`;

        if (!this.pgPools.has(poolKey)) {
            const envPrefix = `PG_${instanceId.toUpperCase().replace(/-/g, '_')}`;

            const pool = new Pool({
                host: connectionConfig.host,
                port: connectionConfig.port,
                database: databaseName,
                // Use instance credentials first, then env vars, then defaults
                user: connectionConfig.user || process.env[`${envPrefix}_USER`] || process.env.PG_DEFAULT_USER || process.env.DB_DEFAULT_USER || 'postgres',
                password: connectionConfig.password || process.env[`${envPrefix}_PASSWORD`] || process.env.PG_DEFAULT_PASSWORD || process.env.DB_DEFAULT_PASSWORD || '',
                // Connection pool settings
                max: parseInt(process.env.PG_POOL_MAX || '5', 10) || 5,
                idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10) || 30000,
                connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT || '10000', 10) || 10000,
            });

            // Error handling for idle clients
            pool.on('error', (err) => {
                logger.error('Unexpected error on idle client', { error: err.message, poolKey });
                // Don't remove from pool, pg handles reconnection, but log it
            });

            this.pgPools.set(poolKey, pool);
            logger.info('Created new PG connection pool', { poolKey });
        }

        return this.pgPools.get(poolKey)!;
    }

    /**
     * Get or create MongoDB client
     */
    public async getMongoClient(instanceId: string, connectionConfig: DatabaseInstanceConfig & { host: string; port: number; user?: string; password?: string }): Promise<MongoClient> {
        if (!this.mongoClients.has(instanceId)) {
            const envPrefix = `MONGO_${instanceId.toUpperCase().replace(/-/g, '_')}`;

            // Construct URI
            const user = connectionConfig.user || process.env[`${envPrefix}_USER`] || process.env.MONGO_DEFAULT_USER || '';
            const password = connectionConfig.password || process.env[`${envPrefix}_PASSWORD`] || process.env.MONGO_DEFAULT_PASSWORD || '';

            let authPart = '';
            if (user && password) {
                authPart = `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`;
            }

            const uri = `mongodb://${authPart}${connectionConfig.host}:${connectionConfig.port}/?maxPoolSize=${process.env.MONGO_POOL_SIZE || '5'}`;

            const client = new MongoClient(uri, {
                connectTimeoutMS: 10000,
                serverSelectionTimeoutMS: 10000,
            });

            try {
                await client.connect();
                this.mongoClients.set(instanceId, client);
                logger.info('Created new Mongo client', { instanceId });
            } catch (error) {
                const err = error as Error;
                logger.error('Failed to connect to Mongo', { error: err.message, instanceId });
                throw error;
            }
        }

        return this.mongoClients.get(instanceId)!;
    }

    /**
     * Get pool statistics
     */
    public getStats() {
        // PG Stats
        const pgStats: Record<string, any> = {};
        for (const [key, pool] of this.pgPools.entries()) {
            pgStats[key] = {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount,
            };
        }

        // Mongo Stats (limited visibility in driver)
        const mongoStats: Record<string, any> = {};
        for (const [key, client] of this.mongoClients.entries()) {
            // @ts-ignore - topology property exists but is internal
            const isConnected = client.topology && client.topology.isConnected();
            mongoStats[key] = { connected: isConnected };
        }

        return {
            postgresql: pgStats,
            totalCount: this.pgPools.size,
            idleCount: Array.from(this.pgPools.values()).reduce((sum, p) => sum + p.idleCount, 0),
            waitingCount: Array.from(this.pgPools.values()).reduce((sum, p) => sum + p.waitingCount, 0),
            mongodb: mongoStats,
            connected: this.mongoClients.size > 0
        };
    }

    /**
     * Disconnect specific pool or all
     */
    public async disconnect(key?: string): Promise<void> {
        if (key) {
            // Try to find in PG
            if (this.pgPools.has(key)) {
                await this.pgPools.get(key)!.end();
                this.pgPools.delete(key);
                return;
            }
            // Try to find in Mongo (key is instanceId)
            if (this.mongoClients.has(key)) {
                await this.mongoClients.get(key)!.close();
                this.mongoClients.delete(key);
                return;
            }
        } else {
            // Close all
            for (const pool of this.pgPools.values()) {
                await pool.end();
            }
            this.pgPools.clear();

            for (const client of this.mongoClients.values()) {
                await client.close();
            }
            this.mongoClients.clear();
        }
    }
}
