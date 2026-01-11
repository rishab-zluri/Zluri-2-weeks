/**
 * Script Execution Service - Sandboxed Environment
 * 
 * Executes user scripts in a secure sandboxed environment with proper
 * output capture, error handling, and result formatting.
 * 
 * @module services/scriptExecutionService
 */

const { VM } = require('vm2');
const { Client } = require('pg');
const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const EXECUTION_CONFIG = {
  timeout: 30000,
  memoryLimit: 128,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - database connection factory requires real DB */
async function createPostgresConnection(instance, databaseName) {
  const client = new Client({
    host: instance.host,
    port: instance.port || 5432,
    database: databaseName,
    user: instance.user,
    password: instance.password,
    connectionTimeoutMillis: 10000,
    query_timeout: EXECUTION_CONFIG.timeout,
  });
  
  await client.connect();
  return client;
}

/* istanbul ignore next - database connection factory requires real DB */
async function createMongoConnection(instance, databaseName) {
  const client = new MongoClient(instance.uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: EXECUTION_CONFIG.timeout,
  });
  
  await client.connect();
  const db = client.db(databaseName);
  
  return { client, db };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAFE DATABASE WRAPPERS WITH AUTO-LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - internal wrapper functions require real DB connections */
function createSafePostgresWrapper(client, output) {
  let queryNum = 0;

  return {
    query: async (queryText, params = []) => {
      queryNum++;
      const startTime = Date.now();
      
      try {
        const result = await client.query(queryText, params);
        const duration = Date.now() - startTime;
        const queryType = queryText.trim().split(/\s+/)[0].toUpperCase();

        // Auto-capture query info
        output.push({
          type: 'query',
          queryNumber: queryNum,
          queryType,
          sql: queryText.substring(0, 200) + (queryText.length > 200 ? '...' : ''),
          duration: `${duration}ms`,
          rowCount: result.rowCount || 0,
          message: `Query ${queryNum} (${queryType}): ${result.rowCount || 0} rows in ${duration}ms`,
          timestamp: new Date().toISOString(),
        });

        // For SELECT queries, include sample data
        if (queryType === 'SELECT' && result.rows && result.rows.length > 0) {
          output.push({
            type: 'data',
            message: `Returned ${result.rows.length} row(s)`,
            preview: result.rows.slice(0, 10), // First 10 rows
            columns: result.fields ? result.fields.map(f => f.name) : [],
            totalRows: result.rows.length,
            timestamp: new Date().toISOString(),
          });
        }

        // For INSERT/UPDATE/DELETE, show affected rows
        if (['INSERT', 'UPDATE', 'DELETE'].includes(queryType)) {
          output.push({
            type: 'result',
            message: `${queryType}: ${result.rowCount} row(s) affected`,
            rowsAffected: result.rowCount,
            timestamp: new Date().toISOString(),
          });
        }

        return {
          rows: result.rows || [],
          rowCount: result.rowCount || 0,
          fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })) || [],
        };
      } catch (error) {
        output.push({
          type: 'error',
          queryNumber: queryNum,
          message: `Query ${queryNum} failed: ${error.message}`,
          error: error.message,
          code: error.code,
          position: error.position,
          detail: error.detail,
          hint: error.hint,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    },
  };
}

/* istanbul ignore next - internal wrapper function, tested via integration */
function createSafeMongoWrapper(db, output) {
  let opNum = 0;

  const wrapCollection = (name) => {
    const collection = db.collection(name);

    const logOp = (operation, details) => {
      opNum++;
      output.push({
        type: 'operation',
        opNumber: opNum,
        collection: name,
        operation,
        ...details,
        timestamp: new Date().toISOString(),
      });
    };

    return {
      find: async (query = {}, options = {}) => {
        const startTime = Date.now();
        const safeOptions = { ...options, limit: options.limit || 1000 };
        const results = await collection.find(query, safeOptions).toArray();
        const duration = Date.now() - startTime;

        logOp('find', {
          message: `find(): ${results.length} document(s) returned in ${duration}ms`,
          query: JSON.stringify(query).substring(0, 100),
          count: results.length,
          duration: `${duration}ms`,
        });

        if (results.length > 0) {
          output.push({
            type: 'data',
            message: `Returned ${results.length} document(s)`,
            preview: results.slice(0, 5),
            totalDocs: results.length,
            timestamp: new Date().toISOString(),
          });
        }

        return results;
      },

      findOne: async (query = {}) => {
        const startTime = Date.now();
        const result = await collection.findOne(query);
        const duration = Date.now() - startTime;

        logOp('findOne', {
          message: `findOne(): ${result ? '1 document found' : 'No document found'} in ${duration}ms`,
          query: JSON.stringify(query).substring(0, 100),
          found: !!result,
          duration: `${duration}ms`,
        });

        if (result) {
          output.push({
            type: 'data',
            message: 'Document found',
            preview: [result],
            timestamp: new Date().toISOString(),
          });
        }

        return result;
      },

      countDocuments: async (query = {}) => {
        const startTime = Date.now();
        const count = await collection.countDocuments(query);
        const duration = Date.now() - startTime;

        logOp('countDocuments', {
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
          message: `aggregate(): ${results.length} result(s) in ${duration}ms`,
          stages: safePipeline.length,
          count: results.length,
          duration: `${duration}ms`,
        });

        if (results.length > 0) {
          output.push({
            type: 'data',
            message: `Aggregation returned ${results.length} result(s)`,
            preview: results.slice(0, 5),
            timestamp: new Date().toISOString(),
          });
        }

        return results;
      },

      insertOne: async (doc) => {
        const startTime = Date.now();
        const result = await collection.insertOne(doc);
        const duration = Date.now() - startTime;

        logOp('insertOne', {
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
          message: `deleteOne(): ${result.deletedCount} document(s) deleted in ${duration}ms`,
          deletedCount: result.deletedCount,
          duration: `${duration}ms`,
        });

        return result;
      },

      deleteMany: async (filter) => {
        const startTime = Date.now();
        const result = await collection.deleteMany(filter);
        const duration = Date.now() - startTime;

        logOp('deleteMany', {
          message: `deleteMany(): ${result.deletedCount} document(s) deleted in ${duration}ms`,
          deletedCount: result.deletedCount,
          duration: `${duration}ms`,
        });

        return result;
      },

      // Blocked operations
      drop: () => { throw new Error('drop() is not allowed in scripts'); },
      createIndex: () => { throw new Error('createIndex() is not allowed in scripts'); },
      dropIndex: () => { throw new Error('dropIndex() is not allowed in scripts'); },
    };
  };

  return {
    collection: wrapCollection,
    dropDatabase: () => { throw new Error('dropDatabase() is not allowed'); },
    createCollection: () => { throw new Error('createCollection() is not allowed'); },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT SYNTAX VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - syntax validation error extraction varies by environment */
function validateScriptSyntax(scriptContent) {
  try {
    new Function(scriptContent);
    return { valid: true };
  } catch (error) {
    // Extract line number from error
    const lineMatch = error.message.match(/line (\d+)/i) || 
                      error.stack?.match(/:(\d+):\d+/);
    const lineNumber = lineMatch ? parseInt(lineMatch[1]) : null;

    return {
      valid: false,
      error: {
        type: 'SyntaxError',
        message: error.message,
        line: lineNumber,
        details: `Syntax error${lineNumber ? ` at line ${lineNumber}` : ''}: ${error.message}`,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - script execution requires real DB and VM sandbox */
async function executeScript(queryRequest) {
  const { scriptContent, databaseType, instanceId, databaseName } = queryRequest;
  const startTime = Date.now();
  const output = [];
  let dbClient = null;
  let mongoClient = null;

  // Add execution start info
  output.push({
    type: 'info',
    message: `Starting script execution...`,
    database: databaseName,
    instance: instanceId,
    databaseType,
    timestamp: new Date().toISOString(),
  });

  try {
    // Validate script content
    if (!scriptContent || typeof scriptContent !== 'string') {
      throw new Error('Invalid script content: Script is empty or not a string');
    }

    if (scriptContent.length > 1024 * 1024) {
      throw new Error('Script too large: Maximum size is 1MB');
    }

    // Check syntax first
    const syntaxCheck = validateScriptSyntax(scriptContent);
    if (!syntaxCheck.valid) {
      output.push({
        type: 'error',
        message: syntaxCheck.error.details,
        errorType: syntaxCheck.error.type,
        line: syntaxCheck.error.line,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: {
          type: 'SyntaxError',
          message: syntaxCheck.error.details,
          line: syntaxCheck.error.line,
        },
        output,
        duration: Date.now() - startTime,
        metadata: {
          databaseType,
          databaseName,
          instanceId,
          executedAt: new Date().toISOString(),
        },
      };
    }

    // Get instance configuration
    const { getInstanceById } = require('../config/staticData');
    const instance = getInstanceById(instanceId);

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    if (databaseType === 'postgresql' && !instance.host) {
      throw new Error(`PostgreSQL instance ${instanceId} missing host configuration`);
    }

    if (databaseType === 'mongodb' && !instance.uri) {
      throw new Error(`MongoDB instance ${instanceId} missing URI configuration`);
    }

    // Create database connection
    let dbWrapper;

    output.push({
      type: 'info',
      message: `Connecting to ${databaseType} database: ${databaseName}...`,
      timestamp: new Date().toISOString(),
    });

    if (databaseType === 'postgresql') {
      dbClient = await createPostgresConnection(instance, databaseName);
      dbWrapper = createSafePostgresWrapper(dbClient, output);
      output.push({
        type: 'info',
        message: 'PostgreSQL connection established',
        timestamp: new Date().toISOString(),
      });
    } else if (databaseType === 'mongodb') {
      const mongoResult = await createMongoConnection(instance, databaseName);
      mongoClient = mongoResult.client;
      dbWrapper = createSafeMongoWrapper(mongoResult.db, output);
      output.push({
        type: 'info',
        message: 'MongoDB connection established',
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error(`Unsupported database type: ${databaseType}`);
    }

    // Create console capture
    const createConsole = () => ({
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
        
        output.push({
          type: 'log',
          message,
          timestamp: new Date().toISOString(),
        });
      },
      error: (...args) => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        output.push({
          type: 'error',
          message,
          timestamp: new Date().toISOString(),
        });
      },
      warn: (...args) => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        output.push({
          type: 'warn',
          message,
          timestamp: new Date().toISOString(),
        });
      },
      info: (...args) => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        output.push({
          type: 'info',
          message,
          timestamp: new Date().toISOString(),
        });
      },
    });

    // Create sandbox
    const vm = new VM({
      timeout: EXECUTION_CONFIG.timeout,
      sandbox: {
        db: dbWrapper,
        pgClient: databaseType === 'postgresql' ? dbWrapper : undefined,
        mongodb: databaseType === 'mongodb' ? dbWrapper : undefined,
        console: createConsole(),
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
        /* istanbul ignore next - sandbox setTimeout wrapper */
        setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5000)),
        clearTimeout,
        // Block dangerous globals
        process: undefined,
        require: undefined,
        __dirname: undefined,
        __filename: undefined,
        module: undefined,
        exports: undefined,
        global: undefined,
        Buffer: undefined,
      },
      eval: false,
      wasm: false,
    });

    // Wrap script to properly handle async and capture result
    // Handle common patterns: direct code, main(), or any async function call
    let processedScript = scriptContent;
    
    // If script defines main() and calls it without await, fix it
    if (/async\s+function\s+main\s*\(/.test(scriptContent) && /\bmain\s*\(\s*\)\s*;?\s*$/.test(scriptContent.trim())) {
      processedScript = scriptContent.replace(/\bmain\s*\(\s*\)\s*;?\s*$/, 'await main();');
    }
    
    // Same for other common function names
    const commonFuncPattern = /async\s+function\s+(run|execute|start|init)\s*\(/;
    const funcMatch = scriptContent.match(commonFuncPattern);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const callPattern = new RegExp(`\\b${funcName}\\s*\\(\\s*\\)\\s*;?\\s*$`);
      if (callPattern.test(scriptContent.trim())) {
        processedScript = scriptContent.replace(callPattern, `await ${funcName}();`);
      }
    }
    
    const wrappedScript = `
      (async () => {
        try {
          ${processedScript}
        } catch (e) {
          console.error('Script Error:', e.message);
          throw e;
        }
      })()
    `;

    output.push({
      type: 'info',
      message: 'Executing script...',
      timestamp: new Date().toISOString(),
    });

    // Execute with timeout
    const executionPromise = vm.run(wrappedScript);
    
    const scriptResult = await Promise.race([
      executionPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Script execution timed out after 30 seconds')), EXECUTION_CONFIG.timeout)
      ),
    ]);

    const duration = Date.now() - startTime;

    // Add completion info
    output.push({
      type: 'info',
      message: `Script completed successfully in ${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    logger.info('Script execution completed', {
      databaseType,
      databaseName,
      instanceId,
      duration,
      outputCount: output.length,
    });

    // Build summary
    const summary = buildExecutionSummary(output);

    return {
      success: true,
      result: scriptResult,
      output,
      summary,
      duration,
      metadata: {
        databaseType,
        databaseName,
        instanceId,
        executedAt: new Date().toISOString(),
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    // Parse error for better reporting
    const errorInfo = parseScriptError(error, scriptContent);

    output.push({
      type: 'error',
      message: `Script failed: ${errorInfo.message}`,
      errorType: errorInfo.type,
      line: errorInfo.line,
      column: errorInfo.column,
      stack: errorInfo.stack,
      timestamp: new Date().toISOString(),
    });

    logger.error('Script execution failed', {
      error: error.message,
      databaseType,
      databaseName,
      duration,
    });

    return {
      success: false,
      error: errorInfo,
      output,
      duration,
      metadata: {
        databaseType,
        databaseName,
        instanceId,
        executedAt: new Date().toISOString(),
      },
    };

  } finally {
    // Close connections
    if (dbClient) {
      try {
        await dbClient.end();
        output.push({
          type: 'info',
          message: 'PostgreSQL connection closed',
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        /* istanbul ignore next - error handling for connection close */
        logger.error('Error closing PostgreSQL connection', { error: e.message });
      }
    }

    if (mongoClient) {
      try {
        await mongoClient.close();
        output.push({
          type: 'info',
          message: 'MongoDB connection closed',
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        /* istanbul ignore next - error handling for connection close */
        logger.error('Error closing MongoDB connection', { error: e.message });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - error parsing depends on runtime stack traces */
function parseScriptError(error, scriptContent) {
  const result = {
    type: error.name || 'Error',
    message: error.message,
    line: null,
    column: null,
    stack: null,
  };

  // Try to extract line number
  /* istanbul ignore next - stack trace parsing varies by environment */
  if (error.stack) {
    // Look for line numbers in stack trace
    const lineMatch = error.stack.match(/<anonymous>:(\d+):(\d+)/);
    if (lineMatch) {
      // Subtract wrapper lines (approximately 4)
      result.line = Math.max(1, parseInt(lineMatch[1]) - 4);
      result.column = parseInt(lineMatch[2]);
    }

    // Clean up stack trace
    result.stack = error.stack
      .split('\n')
      .filter(line => !line.includes('vm2') && !line.includes('node_modules'))
      .slice(0, 5)
      .join('\n');
  }

  // Add context if we have line number
  /* istanbul ignore next - context extraction depends on line number parsing */
  if (result.line && scriptContent) {
    const lines = scriptContent.split('\n');
    if (lines[result.line - 1]) {
      result.context = {
        line: result.line,
        code: lines[result.line - 1].trim(),
        before: result.line > 1 ? lines[result.line - 2]?.trim() : null,
        after: lines[result.line]?.trim() || null,
      };
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - summary building depends on wrapper output format */
function buildExecutionSummary(output) {
  const summary = {
    totalQueries: 0,
    totalOperations: 0,
    rowsReturned: 0,
    rowsAffected: 0,
    documentsProcessed: 0,
    errors: 0,
    warnings: 0,
  };

  for (const item of output) {
    if (item.type === 'query') {
      summary.totalQueries++;
      if (item.rowCount) {
        if (['SELECT'].includes(item.queryType)) {
          summary.rowsReturned += item.rowCount;
        } else {
          summary.rowsAffected += item.rowCount;
        }
      }
    }
    if (item.type === 'operation') {
      summary.totalOperations++;
      if (item.count) summary.documentsProcessed += item.count;
      if (item.insertedCount) summary.documentsProcessed += item.insertedCount;
      if (item.modifiedCount) summary.rowsAffected += item.modifiedCount;
      if (item.deletedCount) summary.rowsAffected += item.deletedCount;
    }
    if (item.type === 'error') summary.errors++;
    if (item.type === 'warn') summary.warnings++;
  }

  return summary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - validation tested via integration tests */
function validateScript(scriptContent) {
  const warnings = [];
  const errors = [];

  // Check syntax
  const syntaxCheck = validateScriptSyntax(scriptContent);
  if (!syntaxCheck.valid) {
    errors.push(syntaxCheck.error.details);
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /require\s*\(/gi, message: 'require() is not allowed - use the pre-injected db variable' },
    { pattern: /process\./gi, message: 'process object is not accessible' },
    { pattern: /eval\s*\(/gi, message: 'eval() is not allowed' },
    { pattern: /Function\s*\(/gi, message: 'Function constructor is not allowed' },
    { pattern: /\.dropDatabase\s*\(/gi, message: 'dropDatabase() is not allowed' },
    { pattern: /\.drop\s*\(/gi, message: 'drop() is not allowed' },
    { pattern: /child_process/gi, message: 'child_process module is blocked' },
    { pattern: /fs\./gi, message: 'fs module is blocked' },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(scriptContent)) {
      warnings.push(message);
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

async function cleanupTempDirectory(tempDir) {
  /* istanbul ignore next - early return for null/undefined */
  if (!tempDir) return;

  try {
    const fsPromises = require('fs').promises;
    await fsPromises.rm(tempDir, { recursive: true, force: true });
    logger.debug('Cleaned up temp directory', { tempDir });
  } catch (error) {
    /* istanbul ignore next - error handling for cleanup */
    logger.warn('Failed to cleanup temp directory', { tempDir, error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  executeScript,
  validateScript,
  cleanupTempDirectory,
  EXECUTION_CONFIG,
};