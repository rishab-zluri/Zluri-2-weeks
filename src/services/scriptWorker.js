/* istanbul ignore file - Worker runs in child process, tested via integration */
/**
 * Script Worker - Child Process Execution Environment
 * 
 * This worker runs in a separate child process for true OS-level isolation.
 * It receives script content via IPC and executes it with database access.
 * 
 * @module services/scriptWorker
 */

const { Client } = require('pg');
const { MongoClient } = require('mongodb');

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT CAPTURE
// ═══════════════════════════════════════════════════════════════════════════════

const output = [];

function addOutput(type, data) {
  output.push({
    type,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSOLE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

const sandboxConsole = {
  log: (...args) => {
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
  error: (...args) => {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addOutput('error', { message });
  },
  warn: (...args) => {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addOutput('warn', { message });
  },
  info: (...args) => {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addOutput('info', { message });
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE WRAPPERS
// ═══════════════════════════════════════════════════════════════════════════════

function createPostgresWrapper(client) {
  let queryNum = 0;

  return {
    query: async (queryText, params = []) => {
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
        }

        if (['INSERT', 'UPDATE', 'DELETE'].includes(queryType)) {
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
        addOutput('error', {
          queryNumber: queryNum,
          message: `Query ${queryNum} failed: ${error.message}`,
          error: error.message,
          code: error.code,
          position: error.position,
          detail: error.detail,
          hint: error.hint,
        });
        throw error;
      }
    },
  };
}

function createMongoWrapper(db) {
  let opNum = 0;

  const logOp = (operation, details) => {
    opNum++;
    addOutput('operation', {
      opNumber: opNum,
      operation,
      ...details,
    });
  };

  const wrapCollection = (name) => {
    const collection = db.collection(name);

    return {
      find: async (query = {}, options = {}) => {
        const startTime = Date.now();
        const safeOptions = { ...options, limit: options.limit || 1000 };
        const results = await collection.find(query, safeOptions).toArray();
        const duration = Date.now() - startTime;

        logOp('find', {
          collection: name,
          message: `find(): ${results.length} document(s) returned in ${duration}ms`,
          query: JSON.stringify(query).substring(0, 100),
          count: results.length,
          duration: `${duration}ms`,
        });

        if (results.length > 0) {
          addOutput('data', {
            message: `Returned ${results.length} document(s)`,
            preview: results.slice(0, 5),
            totalDocs: results.length,
          });
        }

        return results;
      },

      findOne: async (query = {}) => {
        const startTime = Date.now();
        const result = await collection.findOne(query);
        const duration = Date.now() - startTime;

        logOp('findOne', {
          collection: name,
          message: `findOne(): ${result ? '1 document found' : 'No document found'} in ${duration}ms`,
          query: JSON.stringify(query).substring(0, 100),
          found: !!result,
          duration: `${duration}ms`,
        });

        if (result) {
          addOutput('data', {
            message: 'Document found',
            preview: [result],
          });
        }

        return result;
      },

      countDocuments: async (query = {}) => {
        const startTime = Date.now();
        const count = await collection.countDocuments(query);
        const duration = Date.now() - startTime;

        logOp('countDocuments', {
          collection: name,
          message: `countDocuments(): ${count} document(s) in ${duration}ms`,
          count,
          duration: `${duration}ms`,
        });

        return count;
      },

      aggregate: async (pipeline = []) => {
        const startTime = Date.now();
        const safePipeline = [...pipeline];
        if (!safePipeline.some(stage => '$limit' in stage)) {
          safePipeline.push({ $limit: 1000 });
        }
        const results = await collection.aggregate(safePipeline).toArray();
        const duration = Date.now() - startTime;

        logOp('aggregate', {
          collection: name,
          message: `aggregate(): ${results.length} result(s) in ${duration}ms`,
          stages: safePipeline.length,
          count: results.length,
          duration: `${duration}ms`,
        });

        if (results.length > 0) {
          addOutput('data', {
            message: `Aggregation returned ${results.length} result(s)`,
            preview: results.slice(0, 5),
          });
        }

        return results;
      },

      insertOne: async (doc) => {
        const startTime = Date.now();
        const result = await collection.insertOne(doc);
        const duration = Date.now() - startTime;

        logOp('insertOne', {
          collection: name,
          message: `insertOne(): 1 document inserted in ${duration}ms`,
          insertedId: result.insertedId,
          duration: `${duration}ms`,
        });

        return result;
      },

      insertMany: async (docs) => {
        const startTime = Date.now();
        const result = await collection.insertMany(docs);
        const duration = Date.now() - startTime;

        logOp('insertMany', {
          collection: name,
          message: `insertMany(): ${result.insertedCount} document(s) inserted in ${duration}ms`,
          insertedCount: result.insertedCount,
          duration: `${duration}ms`,
        });

        return result;
      },

      updateOne: async (filter, update) => {
        const startTime = Date.now();
        const result = await collection.updateOne(filter, update);
        const duration = Date.now() - startTime;

        logOp('updateOne', {
          collection: name,
          message: `updateOne(): ${result.modifiedCount} document(s) modified in ${duration}ms`,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          duration: `${duration}ms`,
        });

        return result;
      },

      updateMany: async (filter, update) => {
        const startTime = Date.now();
        const result = await collection.updateMany(filter, update);
        const duration = Date.now() - startTime;

        logOp('updateMany', {
          collection: name,
          message: `updateMany(): ${result.modifiedCount} document(s) modified in ${duration}ms`,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          duration: `${duration}ms`,
        });

        return result;
      },

      deleteOne: async (filter) => {
        const startTime = Date.now();
        const result = await collection.deleteOne(filter);
        const duration = Date.now() - startTime;

        logOp('deleteOne', {
          collection: name,
          message: `deleteOne(): ${result.deletedCount} document(s) deleted in ${duration}ms`,
          deletedCount: result.deletedCount,
          duration: `${duration}ms`,
        });

        return result;
      },

      deleteMany: async (filter) => {
        const startTime = Date.now();
        const isEmptyFilter = !filter || Object.keys(filter).length === 0;
        
        if (isEmptyFilter) {
          logOp('deleteMany', {
            collection: name,
            message: '🔴 CRITICAL: deleteMany({}) - Will delete ALL documents in collection',
            riskLevel: 'critical',
            warning: 'Empty filter will affect ALL documents',
          });
        }
        
        const result = await collection.deleteMany(filter);
        const duration = Date.now() - startTime;

        logOp('deleteMany', {
          collection: name,
          message: `deleteMany(): ${result.deletedCount} document(s) deleted in ${duration}ms`,
          deletedCount: result.deletedCount,
          duration: `${duration}ms`,
        });

        return result;
      },

      drop: async () => {
        logOp('drop', {
          collection: name,
          message: '🔴 CRITICAL: drop() - Collection will be permanently deleted',
          riskLevel: 'critical',
          reversible: false,
        });
        const result = await collection.drop();
        logOp('drop', {
          collection: name,
          message: 'Collection dropped successfully',
          result: true,
        });
        return result;
      },

      createIndex: async (keys, options = {}) => {
        logOp('createIndex', {
          collection: name,
          message: '🟡 MEDIUM: createIndex() - Creating index on collection',
          riskLevel: 'medium',
          keys: JSON.stringify(keys),
        });
        const result = await collection.createIndex(keys, options);
        logOp('createIndex', {
          collection: name,
          message: `Index created: ${result}`,
          indexName: result,
        });
        return result;
      },

      dropIndex: async (indexName) => {
        logOp('dropIndex', {
          collection: name,
          message: '🟡 MEDIUM: dropIndex() - Dropping index from collection',
          riskLevel: 'medium',
          indexName,
        });
        const result = await collection.dropIndex(indexName);
        logOp('dropIndex', {
          collection: name,
          message: 'Index dropped successfully',
          result,
        });
        return result;
      },

      dropIndexes: async () => {
        logOp('dropIndexes', {
          collection: name,
          message: '🟠 HIGH: dropIndexes() - Dropping ALL indexes from collection',
          riskLevel: 'high',
          reversible: true,
        });
        const result = await collection.dropIndexes();
        logOp('dropIndexes', {
          collection: name,
          message: 'All indexes dropped successfully',
          result,
        });
        return result;
      },
    };
  };

  return {
    collection: wrapCollection,
    
    dropDatabase: async () => {
      logOp('dropDatabase', {
        message: '🔴 CRITICAL: dropDatabase() - Entire database will be permanently deleted',
        riskLevel: 'critical',
        reversible: false,
      });
      const result = await db.dropDatabase();
      logOp('dropDatabase', {
        message: 'Database dropped successfully',
        result: true,
      });
      return result;
    },

    createCollection: async (name, options = {}) => {
      logOp('createCollection', {
        message: '🔵 LOW: createCollection() - Creating new collection',
        riskLevel: 'low',
        collectionName: name,
      });
      const result = await db.createCollection(name, options);
      logOp('createCollection', {
        message: `Collection "${name}" created successfully`,
      });
      return result;
    },
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function executeInWorker(config) {
  const { scriptContent, databaseType, instance, databaseName, timeout } = config;
  let dbClient = null;
  let mongoClient = null;

  addOutput('info', { message: `Starting script execution...`, database: databaseName, databaseType });

  try {
    // Create database connection
    let dbWrapper;

    addOutput('info', { message: `Connecting to ${databaseType} database: ${databaseName}...` });

    if (databaseType === 'postgresql') {
      dbClient = new Client({
        host: instance.host,
        port: instance.port || 5432,
        database: databaseName,
        user: instance.user,
        password: instance.password,
        connectionTimeoutMillis: 10000,
        query_timeout: timeout,
      });
      await dbClient.connect();
      dbWrapper = createPostgresWrapper(dbClient);
      addOutput('info', { message: 'PostgreSQL connection established' });
    } else if (databaseType === 'mongodb') {
      mongoClient = new MongoClient(instance.uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: timeout,
      });
      await mongoClient.connect();
      const db = mongoClient.db(databaseName);
      dbWrapper = createMongoWrapper(db);
      addOutput('info', { message: 'MongoDB connection established' });
    }

    // Process script for async patterns
    let processedScript = scriptContent;
    
    if (/async\s+function\s+main\s*\(/.test(scriptContent) && /\bmain\s*\(\s*\)\s*;?\s*$/.test(scriptContent.trim())) {
      processedScript = scriptContent.replace(/\bmain\s*\(\s*\)\s*;?\s*$/, 'await main();');
    }
    
    const commonFuncPattern = /async\s+function\s+(run|execute|start|init)\s*\(/;
    const funcMatch = scriptContent.match(commonFuncPattern);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const callPattern = new RegExp(`\\b${funcName}\\s*\\(\\s*\\)\\s*;?\\s*$`);
      if (callPattern.test(scriptContent.trim())) {
        processedScript = scriptContent.replace(callPattern, `await ${funcName}();`);
      }
    }

    // Create execution context with limited globals
    const context = {
      db: dbWrapper,
      pgClient: databaseType === 'postgresql' ? dbWrapper : undefined,
      mongodb: databaseType === 'mongodb' ? dbWrapper : undefined,
      console: sandboxConsole,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5000)),
      clearTimeout,
    };

    // Create async function with context
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);
    
    const wrappedScript = `
      try {
        ${processedScript}
      } catch (e) {
        console.error('Script Error:', e.message);
        throw e;
      }
    `;

    addOutput('info', { message: 'Executing script...' });

    const scriptFn = new AsyncFunction(...contextKeys, wrappedScript);
    const result = await scriptFn(...contextValues);

    addOutput('info', { message: 'Script completed successfully' });

    return { success: true, result, output };

  } catch (error) {
    addOutput('error', {
      message: `Script failed: ${error.message}`,
      errorType: error.name || 'Error',
    });

    return {
      success: false,
      error: {
        type: error.name || 'Error',
        message: error.message,
      },
      output,
    };

  } finally {
    if (dbClient) {
      try {
        await dbClient.end();
        addOutput('info', { message: 'PostgreSQL connection closed' });
      } catch (e) {
        // Ignore close errors
      }
    }

    if (mongoClient) {
      try {
        await mongoClient.close();
        addOutput('info', { message: 'MongoDB connection closed' });
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IPC MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

process.on('message', async (message) => {
  if (message.type === 'execute') {
    try {
      const result = await executeInWorker(message.config);
      process.send({ type: 'result', data: result });
    } catch (error) {
      process.send({
        type: 'result',
        data: {
          success: false,
          error: { type: 'WorkerError', message: error.message },
          output,
        },
      });
    }
  }
});

// Signal ready
process.send({ type: 'ready' });
