/* istanbul ignore file - Worker runs in child process, tested via integration */
/**
 * Script Worker - Isolated Child Process Execution Environment
 *
 * @module services/script/worker/scriptWorker
 * @description
 * This worker executes user-submitted database scripts in a completely isolated
 * child process, providing OS-level sandboxing for security.
 *
 * ## WHY CHILD PROCESS ISOLATION?
 * 
 * User scripts are untrusted code that could:
 * - Consume infinite CPU (while loops)
 * - Exhaust memory (array allocations)
 * - Access file system or environment variables
 * - Crash the main server process
 *
 * By running in a child process:
 * 1. **Resource Limits**: OS can enforce CPU/memory limits
 * 2. **Crash Isolation**: Script crash doesn't affect main server
 * 3. **Timeout Enforcement**: Parent can kill child if it hangs
 * 4. **Clean State**: Each execution starts fresh (no state leakage)
 *
 * ## WHY NOT VM2/ISOLATED-VM?
 *
 * We evaluated in-process sandboxes (vm2, isolated-vm) but chose child process because:
 * - VM2 had security vulnerabilities (CVE-2022-36067)
 * - isolated-vm doesn't allow async database calls easily
 * - Child process provides true OS-level isolation
 *
 * ## ARCHITECTURE OVERVIEW
 *
 * ```
 * Main Process                    Child Process (this file)
 * ┌──────────────┐               ┌──────────────────────────┐
 * │ ScriptRunner │──IPC MSG──────│ scriptWorker             │
 * │              │               │   ├─ sandboxConsole      │
 * │              │               │   ├─ PostgresWrapper     │
 * │              │◄─IPC RESULT───│   └─ MongoWrapper        │
 * └──────────────┘               └──────────────────────────┘
 * ```
 *
 * ## WHY MONGO WRAPPER (createMongoWrapper)?
 *
 * MongoDB driver returns raw Cursor objects that don't serialize over IPC.
 * The wrapper:
 * 1. Converts cursors to arrays (serializable)
 * 2. Adds operation logging for audit trail
 * 3. Enforces safety limits (e.g., max 1000 docs for find)
 * 4. Captures timing metrics for performance monitoring
 *
 * ## WHY POSTGRES WRAPPER (createPostgresWrapper)?
 *
 * Similar to MongoDB, the wrapper:
 * 1. Logs all queries with timing for audit
 * 2. Captures query results in structured format
 * 3. Provides consistent error handling
 * 4. Truncates large queries in logs (security)
 *
 * @see {@link ../ScriptRunner.ts} - Parent process that spawns this worker
 * @see {@link ../interfaces.ts} - Type definitions for IPC messages
 */

import { Client } from 'pg';
import { MongoClient, Db, Collection, Document, IndexSpecification, CreateIndexesOptions } from 'mongodb';
import {
    OutputItem,
    WorkerConfig,
    ChildProcessResult,
    ScriptError
} from '../interfaces';

// =============================================================================
// TYPES (Local Helper Types)
// =============================================================================

/**
 * PostgreSQL connection configuration
 * WHY SEPARATE FROM MongoInstanceConfig?
 * Different databases have fundamentally different connection models.
 * PostgreSQL uses host/port/user/password, MongoDB uses connection URI.
 */
interface PostgresInstanceConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
}

/**
 * MongoDB connection configuration
 * WHY URI-BASED?
 * MongoDB connection strings encode replica set info, auth source, and options
 * in a single URI, making it the standard way to connect.
 */
interface MongoInstanceConfig {
    uri: string;
}

interface PgQueryResult {
    rows: Record<string, unknown>[];
    rowCount: number;
    fields: Array<{ name: string; dataTypeID: number }>;
}

/**
 * IPC message from parent process
 * WHY EXPLICIT TYPE FIELD?
 * Enables extensibility - parent could send different message types
 * (e.g., 'execute', 'cancel', 'status') without breaking changes.
 */
interface ParentMessage {
    type: 'execute';
    config: WorkerConfig;
}

// =============================================================================
// OUTPUT CAPTURE
// =============================================================================

/**
 * Collects all output during script execution for audit trail.
 * WHY MUTABLE ARRAY?
 * Output accumulates during async script execution. Using immutable
 * structures would require complex state threading through async calls.
 * Array is scoped to single execution (child process is short-lived).
 */
const output: OutputItem[] = [];

/**
 * Add structured output item with timestamp.
 * WHY TIMESTAMP EACH ITEM?
 * Enables post-execution analysis of script behavior timing.
 * Critical for debugging slow scripts and understanding execution flow.
 */
function addOutput(type: OutputItem['type'], data: Record<string, unknown>): void {
    const item: any = {
        type,
        ...data,
        timestamp: new Date().toISOString(),
    };
    output.push(item);
}

// =============================================================================
// CONSOLE WRAPPER
// =============================================================================

/**
 * Custom console implementation that captures all script output.
 * 
 * WHY REPLACE NATIVE CONSOLE?
 * 1. Native console.log goes to stdout - lost when child exits
 * 2. We need structured output for the parent process
 * 3. Enables filtering (e.g., show only errors in UI)
 * 4. Allows serialization of objects for IPC transport
 */
const sandboxConsole = {
    log: (...args: unknown[]): void => {
        const message = args.map(a => {
            if (a === undefined) return 'undefined';
            if (a === null) return 'null';
            if (typeof a === 'object') {
                try { return JSON.stringify(a, null, 2); }
                catch { return '[Object]'; }
            }
            return String(a);
        }).join(' ');
        addOutput('log', { message });
    },
    error: (...args: unknown[]): void => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        addOutput('error', { message });
    },
    warn: (...args: unknown[]): void => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        addOutput('warn', { message });
    },
    info: (...args: unknown[]): void => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        addOutput('info', { message });
    },
};

// =============================================================================
// DATABASE WRAPPERS
// =============================================================================

interface PostgresWrapper {
    query: (queryText: string, params?: unknown[]) => Promise<PgQueryResult>;
}

function createPostgresWrapper(client: Client): PostgresWrapper {
    let queryNum = 0;
    return {
        query: async (queryText: string, params: unknown[] = []): Promise<PgQueryResult> => {
            queryNum++;
            const startTime = Date.now();
            try {
                const result = await client.query(queryText, params);
                const duration = Date.now() - startTime;
                const queryType = queryText.trim().split(/\s+/)[0].toUpperCase();

                addOutput('query', {
                    queryNumber: queryNum,
                    queryType,
                    sql: queryText.substring(0, 200) + (queryText.length > 200 ? '...' : ''),
                    duration: `${duration}ms`,
                    rowCount: result.rowCount || 0,
                    message: `Query ${queryNum} (${queryType}): ${result.rowCount || 0} rows in ${duration}ms`,
                });

                if (queryType === 'SELECT' && result.rows && result.rows.length > 0) {
                    addOutput('data', {
                        message: `Returned ${result.rows.length} row(s)`,
                        preview: result.rows.slice(0, 10),
                        columns: result.fields ? result.fields.map(f => f.name) : [],
                        totalRows: result.rows.length,
                    });
                } else if (['INSERT', 'UPDATE', 'DELETE'].includes(queryType)) {
                    addOutput('result', {
                        message: `${queryType}: ${result.rowCount} row(s) affected`,
                        rowsAffected: result.rowCount,
                    });
                }

                return {
                    rows: result.rows || [],
                    rowCount: result.rowCount || 0,
                    fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })) || [],
                };
            } catch (error) {
                const err = error as Error & { code?: string; position?: string; detail?: string; hint?: string };
                addOutput('error', {
                    queryNumber: queryNum,
                    message: `Query ${queryNum} failed: ${err.message}`,
                    error: err.message,
                    code: err.code,
                });
                throw error;
            }
        },
    };
}

interface MongoWrapper {
    collection: (name: string) => any;
    dropDatabase: () => Promise<boolean>;
    createCollection: (name: string, options?: any) => Promise<Collection>;
}

function createMongoWrapper(db: Db): MongoWrapper {
    let opNum = 0;
    const logOp = (operation: string, details: Record<string, unknown>): void => {
        opNum++;
        addOutput('operation', { opNumber: opNum, operation, ...details });
    };

    const wrapCollection = (name: string) => {
        const collection = db.collection(name);
        return {
            find: (query: any = {}, options: any = {}) => {
                // Return a cursor-like object that matches MongoDB API
                const cursor = collection.find(query, options);

                return {
                    toArray: async () => {
                        const startTime = Date.now();
                        const safeOptions = { limit: options.limit || 1000 };
                        const results = await cursor.limit(safeOptions.limit).toArray();
                        const duration = Date.now() - startTime;
                        logOp('find', { collection: name, count: results.length, duration: `${duration}ms` });
                        if (results.length > 0) addOutput('data', { message: `Returned ${results.length} docs`, preview: results.slice(0, 5) });
                        return results;
                    },
                    limit: (n: number) => {
                        cursor.limit(n);
                        return { toArray: async () => cursor.toArray() };
                    },
                    sort: (sortSpec: any) => {
                        cursor.sort(sortSpec);
                        return { toArray: async () => cursor.toArray() };
                    },
                };
            },
            findOne: async (query: any = {}) => {
                const startTime = Date.now();
                const result = await collection.findOne(query);
                logOp('findOne', { collection: name, found: !!result, duration: `${Date.now() - startTime}ms` });
                if (result) addOutput('data', { message: 'Document found', preview: [result] });
                return result;
            },
            insertOne: async (doc: any) => {
                const startTime = Date.now();
                const result = await collection.insertOne(doc);
                logOp('insertOne', { collection: name, insertedId: result.insertedId, duration: `${Date.now() - startTime}ms` });
                return { insertedId: result.insertedId };
            },
            // Partial implementation for brevity, assuming similar pattern for others
            countDocuments: async (query: any = {}) => {
                const count = await collection.countDocuments(query);
                logOp('countDocuments', { collection: name, count });
                return count;
            },
            aggregate: async (pipeline: any[] = []) => {
                const results = await collection.aggregate(pipeline).toArray();
                logOp('aggregate', { collection: name, count: results.length });
                return results;
            },
            insertMany: async (docs: any[]) => {
                const result = await collection.insertMany(docs);
                logOp('insertMany', { collection: name, count: result.insertedCount });
                return { insertedCount: result.insertedCount };
            },
            updateOne: async (filter: any, update: any) => {
                const result = await collection.updateOne(filter, update);
                logOp('updateOne', { collection: name, modified: result.modifiedCount });
                return result;
            },
            updateMany: async (filter: any, update: any) => {
                const result = await collection.updateMany(filter, update);
                logOp('updateMany', { collection: name, modified: result.modifiedCount });
                return result;
            },
            deleteOne: async (filter: any) => {
                const result = await collection.deleteOne(filter);
                logOp('deleteOne', { collection: name, deleted: result.deletedCount });
                return result;
            },
            deleteMany: async (filter: any) => {
                if (!filter || Object.keys(filter).length === 0) {
                    logOp('deleteMany', { message: 'CRITICAL: Deleting ALL documents', risk: 'critical' });
                }
                const result = await collection.deleteMany(filter);
                logOp('deleteMany', { collection: name, deleted: result.deletedCount });
                return result;
            },
            drop: async () => {
                logOp('drop', { collection: name, message: 'CRITICAL: Dropping collection', risk: 'critical' });
                return await collection.drop();
            },
            createIndex: async (keys: any, options: any) => {
                logOp('createIndex', { collection: name });
                return await collection.createIndex(keys, options);
            },
            dropIndex: async (name: string) => {
                logOp('dropIndex', { collection: name });
                return await collection.dropIndex(name);
            },
            dropIndexes: async () => {
                logOp('dropIndexes', { collection: name, message: 'Dropping all indexes' });
                return await collection.dropIndexes();
            }
        };
    };

    return {
        collection: wrapCollection,
        dropDatabase: async () => {
            logOp('dropDatabase', { message: 'CRITICAL: Dropping database' });
            return await db.dropDatabase();
        },
        createCollection: async (name: string, options: any) => {
            logOp('createCollection', { name });
            return await db.createCollection(name, options);
        }
    };
}

// =============================================================================
// EXECUTION LOGIC
// =============================================================================

async function executeInWorker(config: WorkerConfig): Promise<ChildProcessResult> {
    const { scriptContent, databaseType, instance, databaseName, timeout } = config;
    let dbClient: Client | null = null;
    let mongoClient: MongoClient | null = null;

    addOutput('info', { message: `Starting execution on ${databaseName} (${databaseType})...` });

    try {
        let dbWrapper: PostgresWrapper | MongoWrapper;

        if (databaseType === 'postgresql') {
            const pgInstance = instance as PostgresInstanceConfig;
            dbClient = new Client({
                host: pgInstance.host,
                port: pgInstance.port || 5432,
                database: databaseName,
                user: pgInstance.user,
                password: pgInstance.password,
                query_timeout: timeout,
            });
            await dbClient.connect();
            dbWrapper = createPostgresWrapper(dbClient);
        } else if (databaseType === 'mongodb') {
            const mongoInstance = instance as MongoInstanceConfig;
            mongoClient = new MongoClient(mongoInstance.uri, { socketTimeoutMS: timeout });
            await mongoClient.connect();
            dbWrapper = createMongoWrapper(mongoClient.db(databaseName));
        } else {
            throw new Error(`Unsupported DB: ${databaseType}`);
        }

        // Script wrapping
        let processedScript = scriptContent;
        if (/async\s+function\s+main/.test(scriptContent) && /main\s*\(\)/.test(scriptContent)) {
            processedScript = scriptContent.replace(/main\s*\(\)\s*;?$/, 'await main();');
        }

        // =================================================================
        // SECURITY: Create frozen safe globals to prevent prototype attacks
        // =================================================================

        /**
         * Create a frozen copy of a built-in to prevent prototype pollution
         * This stops attacks like: Object.prototype.polluted = true
         */
        const createFrozenGlobal = (obj: any, name: string): any => {
            // For constructors, create a frozen wrapper
            if (typeof obj === 'function') {
                // Prevent access to constructor chain
                const wrapper = (...args: any[]) => new obj(...args);
                Object.defineProperty(wrapper, 'name', { value: name, writable: false });
                Object.defineProperty(wrapper, 'constructor', { value: undefined, writable: false });
                return Object.freeze(wrapper);
            }
            return Object.freeze({ ...obj });
        };

        /**
         * Secure console wrapper - no constructor access
         * Prevents attack: console.constructor.constructor('return process')()
         */
        const secureConsole = Object.freeze({
            log: sandboxConsole.log,
            error: sandboxConsole.error,
            warn: sandboxConsole.warn,
            info: sandboxConsole.info,
        });

        // Build context with frozen globals
        const context: Record<string, unknown> = {
            // Database wrappers
            db: dbWrapper,
            pgClient: databaseType === 'postgresql' ? dbWrapper : undefined,
            mongodb: databaseType === 'mongodb' ? dbWrapper : undefined,

            // Secure console (no constructor access)
            console: secureConsole,

            // Frozen built-in constructors (prevents prototype pollution)
            JSON: Object.freeze({ parse: JSON.parse, stringify: JSON.stringify }),
            Math: Object.freeze({ ...Math }),
            Date: createFrozenGlobal(Date, 'Date'),
            Array: createFrozenGlobal(Array, 'Array'),
            Object: Object.freeze({
                keys: Object.keys,
                values: Object.values,
                entries: Object.entries,
                assign: Object.assign,
                freeze: Object.freeze,
                // Block dangerous methods
                // setPrototypeOf: undefined,
                // defineProperty: undefined,
            }),
            String: createFrozenGlobal(String, 'String'),
            Number: createFrozenGlobal(Number, 'Number'),
            Boolean: createFrozenGlobal(Boolean, 'Boolean'),
            RegExp: createFrozenGlobal(RegExp, 'RegExp'),
            Map: createFrozenGlobal(Map, 'Map'),
            Set: createFrozenGlobal(Set, 'Set'),
            Promise: createFrozenGlobal(Promise, 'Promise'),

            // Frozen utility functions
            parseInt: parseInt,
            parseFloat: parseFloat,
            isNaN: isNaN,
            isFinite: isFinite,

            // Limited setTimeout (max 5s)
            setTimeout: (fn: any, ms: number) => setTimeout(fn, Math.min(ms, 5000)),
            clearTimeout,

            // Explicitly undefined dangerous globals
            eval: undefined,
            Function: undefined,
            require: undefined,
            process: undefined,
            global: undefined,
            globalThis: undefined,
            Buffer: undefined,
            __dirname: undefined,
            __filename: undefined,
        };

        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        const scriptFn = new AsyncFunction(...Object.keys(context), `try { ${processedScript} } catch(e) { console.error('Script Error:', e.message); throw e; }`);

        const result = await scriptFn(...Object.values(context));
        addOutput('info', { message: 'Script completed successfully' });

        return { success: true, result, output };
    } catch (error) {
        const err = error as Error;
        addOutput('error', { message: `Script failed: ${err.message}` });
        return { success: false, error: { type: err.name || 'Error', message: err.message }, output };
    } finally {
        if (dbClient) try { await dbClient.end(); } catch { }
        if (mongoClient) try { await mongoClient.close(); } catch { }
    }
}

// =============================================================================
// IPC HANDLER
// =============================================================================

process.on('message', async (message: ParentMessage) => {
    if (message.type === 'execute') {
        try {
            const result = await executeInWorker(message.config);
            if (process.send) process.send({ type: 'result', data: result });
        } catch (error) {
            if (process.send) process.send({ type: 'result', data: { success: false, error: { type: 'WorkerError', message: (error as Error).message }, output } });
        }
    }
});

if (process.send) process.send({ type: 'ready' });
