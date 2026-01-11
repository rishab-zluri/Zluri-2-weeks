/**
 * Query Execution Service - IMPROVED VERSION
 * Execute queries against PostgreSQL and MongoDB databases
 * 
 * SECURITY NOTE: This service executes DATABASE queries (SQL/MongoDB commands),
 * NOT JavaScript code. The database engine handles execution, not Node.js.
 * 
 * For JavaScript SCRIPT execution (.js files), use scriptExecutionService.js with vm2 sandbox.
 * 
 * IMPROVEMENTS OVER ORIGINAL:
 * 1. Query validation with length limits
 * 2. Dangerous query pattern detection (warnings for audit)
 * 3. Result set size limits (prevent memory exhaustion)
 * 4. Read-only transaction option
 * 5. Better connection pool management
 * 6. Connection testing utility
 * 7. Pool statistics for monitoring
 * 8. Improved audit logging
 * 9. Proper client release in finally blocks
 * 10. Configurable via environment variables
 */

const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { getInstanceById } = require('../config/staticData');
const logger = require('../utils/logger');
const { QueryExecutionError, ValidationError } = require('../utils/errors');

// Connection pools cache
const pgPools = new Map();
const mongoClients = new Map();

// ============================================================================
// CONFIGURATION
// ============================================================================

const QUERY_CONFIG = {
  // Maximum query execution time (ms)
  statementTimeout: parseInt(process.env.QUERY_TIMEOUT_MS, 10) || 30000,
  
  // Maximum rows to return (prevents memory exhaustion)
  maxRows: parseInt(process.env.QUERY_MAX_ROWS, 10) || 10000,
  
  // Maximum query length (characters)
  maxQueryLength: parseInt(process.env.QUERY_MAX_LENGTH, 10) || 100000,
  
  // Enable dangerous query warnings (not blocking, just logging for audit)
  warnOnDangerousQueries: process.env.WARN_DANGEROUS_QUERIES !== 'false',
  
  // Enable read-only mode by default (wraps in read-only transaction)
  defaultReadOnly: process.env.QUERY_DEFAULT_READONLY === 'true',
};

// ============================================================================
// DANGEROUS PATTERN DETECTION (FOR AUDIT TRAIL, NOT BLOCKING)
// ============================================================================

// Dangerous SQL patterns - logged for audit, not blocked
// (Managers approved these queries, so we execute them but log warnings)
const DANGEROUS_SQL_PATTERNS = [
  { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)/i, description: 'DROP statement' },
  { pattern: /\bTRUNCATE\s+/i, description: 'TRUNCATE statement' },
  { pattern: /\bDELETE\s+FROM\s+\w+\s*(?:;|$)/i, description: 'DELETE without WHERE clause' },
  { pattern: /\bUPDATE\s+\w+\s+SET\s+[^;]*(?:;|$)(?!.*WHERE)/is, description: 'UPDATE without WHERE clause' },
  { pattern: /\bALTER\s+(TABLE|DATABASE)/i, description: 'ALTER statement' },
  { pattern: /\bGRANT\s+/i, description: 'GRANT statement' },
  { pattern: /\bREVOKE\s+/i, description: 'REVOKE statement' },
  { pattern: /\bCREATE\s+(USER|ROLE)/i, description: 'CREATE USER/ROLE statement' },
];

// Dangerous MongoDB operations - logged for audit
const DANGEROUS_MONGO_OPERATIONS = [
  'drop', 'dropDatabase', 'dropIndexes', 'dropIndex',
  'renameCollection', 'convertToCapped',
];

// ============================================================================
// QUERY VALIDATION
// ============================================================================

/**
 * Validate and analyze query for potential issues
 * Returns warnings for audit trail, does NOT block execution
 * (Queries are manager-approved, so we trust them but log concerns)
 * 
 * @param {string} queryContent - Query to analyze
 * @param {string} databaseType - 'postgresql' or 'mongodb'
 * @returns {Object} Validation result with warnings
 */
const validateQuery = (queryContent, databaseType) => {
  const warnings = [];
  
  // Check query length (this DOES block - prevent memory issues)
  if (queryContent.length > QUERY_CONFIG.maxQueryLength) {
    throw new ValidationError(
      `Query exceeds maximum length of ${QUERY_CONFIG.maxQueryLength} characters`
    );
  }

  // Check for empty query
  if (!queryContent || !queryContent.trim()) {
    throw new ValidationError('Query cannot be empty');
  }

  // Check for dangerous patterns (warnings only, not blocking)
  if (QUERY_CONFIG.warnOnDangerousQueries && databaseType === 'postgresql') {
    for (const { pattern, description } of DANGEROUS_SQL_PATTERNS) {
      if (pattern.test(queryContent)) {
        warnings.push({
          type: 'dangerous_pattern',
          description,
          severity: 'warning',
        });
      }
    }
  }

  return { valid: true, warnings };
};

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Get or create PostgreSQL connection pool
 * @param {string} instanceId - Instance identifier
 * @param {Object} connectionConfig - Instance connection config (host, port, user, password)
 * @param {string} databaseName - Target database name
 */
const getPgPool = (instanceId, connectionConfig, databaseName) => {
  const poolKey = `${instanceId}:${databaseName}`;
  
  if (!pgPools.has(poolKey)) {
    const envPrefix = `PG_${instanceId.toUpperCase().replace(/-/g, '_')}`;
    
    const pool = new Pool({
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: databaseName,
      // Use instance credentials first, then env vars, then defaults
      user: connectionConfig.user || process.env[`${envPrefix}_USER`] || process.env.PG_DEFAULT_USER || process.env.DB_DEFAULT_USER || 'postgres',
      password: connectionConfig.password || process.env[`${envPrefix}_PASSWORD`] || process.env.PG_DEFAULT_PASSWORD || process.env.DB_DEFAULT_PASSWORD || '',
      // Connection pool settings
      max: parseInt(process.env.PG_POOL_MAX, 10) || 5,
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT, 10) || 10000,
      // Statement timeout at pool level
      statement_timeout: QUERY_CONFIG.statementTimeout,
    });

    pool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { 
        instanceId, 
        databaseName, 
        error: err.message,
        code: err.code,
      });
    });

    pgPools.set(poolKey, pool);
  }

  return pgPools.get(poolKey);
};

/**
 * Get or create MongoDB client
 */
const getMongoClient = async (instanceId, connectionString) => {
  if (!mongoClients.has(instanceId)) {
    // Mask credentials in logs
    const maskedUri = connectionString.replace(
      /\/\/([^:]+):([^@]+)@/,
      '//***:***@'
    );
    logger.debug('Creating MongoDB client', { instanceId, uri: maskedUri });

    const client = new MongoClient(connectionString, {
      maxPoolSize: parseInt(process.env.MONGO_POOL_MAX, 10) || 5,
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_TIMEOUT, 10) || 10000,
      connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT, 10) || 10000,
      socketTimeoutMS: QUERY_CONFIG.statementTimeout,
    });

    await client.connect();
    mongoClients.set(instanceId, client);
  }

  return mongoClients.get(instanceId);
};

// ============================================================================
// POSTGRESQL QUERY EXECUTION
// ============================================================================

/**
 * Execute PostgreSQL query
 */
const executePostgresQuery = async (instanceId, databaseName, queryContent, options = {}) => {
  const instance = getInstanceById(instanceId);
  
  if (!instance) {
    throw new ValidationError(`Instance not found: ${instanceId}`);
  }

  if (instance.type !== 'postgresql') {
    throw new ValidationError('Instance is not a PostgreSQL database');
  }

  // Validate query
  const validation = validateQuery(queryContent, 'postgresql');
  
  // Log warnings for audit trail
  if (validation.warnings.length > 0) {
    logger.warn('Query contains potentially dangerous patterns', {
      instanceId,
      databaseName,
      warnings: validation.warnings,
      queryPreview: queryContent.substring(0, 200),
    });
  }

  // FIXED: Pass instance directly (not instance._connection)
  const pool = getPgPool(instanceId, instance, databaseName);
  const startTime = Date.now();
  const readOnly = options.readOnly ?? QUERY_CONFIG.defaultReadOnly;

  let client;
  try {
    client = await pool.connect();
    
    // Set session timeout
    await client.query(`SET statement_timeout = ${QUERY_CONFIG.statementTimeout}`);
    
    // Wrap in read-only transaction if configured
    if (readOnly) {
      await client.query('BEGIN READ ONLY');
    }

    // Execute query
    const result = await client.query(queryContent);

    if (readOnly) {
      await client.query('COMMIT');
    }

    const duration = Date.now() - startTime;

    // Truncate results if too many rows
    let rows = result.rows;
    let truncated = false;
    if (rows.length > QUERY_CONFIG.maxRows) {
      rows = rows.slice(0, QUERY_CONFIG.maxRows);
      truncated = true;
    }

    logger.info('PostgreSQL query executed', {
      instanceId,
      databaseName,
      duration,
      rowCount: result.rowCount,
      returnedRows: rows.length,
      truncated,
      command: result.command,
    });

    return {
      success: true,
      rowCount: result.rowCount,
      rows,
      fields: result.fields?.map((f) => ({
        name: f.name,
        dataType: f.dataTypeID,
      })),
      duration,
      command: result.command,
      truncated,
      warnings: validation.warnings,
    };
  } catch (error) {
    // Rollback if in transaction
    if (readOnly && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Ignore rollback errors
      }
    }

    logger.error('PostgreSQL query execution failed', {
      instanceId,
      databaseName,
      error: error.message,
      code: error.code,
    });

    throw new QueryExecutionError(`Query execution failed: ${error.message}`, {
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
    });
  } finally {
    // IMPORTANT: Always release client back to pool
    if (client) {
      client.release();
    }
  }
};

// ============================================================================
// MONGODB QUERY EXECUTION
// ============================================================================

/**
 * Execute MongoDB query
 */
const executeMongoQuery = async (instanceId, databaseName, queryContent, options = {}) => {
  // =========================================================================
  // STEP 1: Validate instance FIRST - before any MongoDB operations
  // =========================================================================
  const instance = getInstanceById(instanceId);
  
  if (!instance) {
    throw new ValidationError(`Instance not found: ${instanceId}`);
  }

  if (instance.type !== 'mongodb') {
    throw new ValidationError('Instance is not a MongoDB database');
  }

  // CRITICAL FIX: Validate instance.uri exists BEFORE passing to getMongoClient
  // This prevents "Cannot read properties of undefined (reading 'replace')" error
  if (!instance.uri) {
    throw new ValidationError(`Instance ${instanceId} is missing URI configuration`);
  }

  // =========================================================================
  // STEP 2: Validate query content BEFORE any database operations
  // =========================================================================
  if (!queryContent || typeof queryContent !== 'string') {
    throw new ValidationError('Query content is required and must be a string');
  }

  const validation = validateQuery(queryContent, 'mongodb');

  // =========================================================================
  // STEP 3: Parse query BEFORE connecting - fail fast on invalid queries
  // =========================================================================
  let parsedQuery;
  try {
    parsedQuery = parseMongoQuery(queryContent);
  } catch (parseError) {
    throw new ValidationError(`Invalid MongoDB query format: ${parseError.message}`);
  }

  // Check for dangerous operations (warning only, for audit trail)
  if (QUERY_CONFIG.warnOnDangerousQueries && 
      DANGEROUS_MONGO_OPERATIONS.includes(parsedQuery.method)) {
    validation.warnings.push({
      type: 'dangerous_operation',
      description: `Dangerous operation: ${parsedQuery.method}`,
      severity: 'warning',
    });
    logger.warn('MongoDB query contains dangerous operation', {
      instanceId,
      databaseName,
      method: parsedQuery.method,
    });
  }

  // =========================================================================
  // STEP 4: Now safe to connect and execute
  // =========================================================================
  const startTime = Date.now();

  try {
    const client = await getMongoClient(instanceId, instance.uri);
    const db = client.db(databaseName);

    let result;

    if (parsedQuery.type === 'command') {
      result = await db.command(parsedQuery.command);
    } else if (parsedQuery.type === 'operation') {
      const collection = db.collection(parsedQuery.collection);
      result = await executeMongoOperation(collection, parsedQuery);
    } else {
      throw new ValidationError('Invalid query format');
    }

    const duration = Date.now() - startTime;

    // Truncate results if too many documents
    let truncated = false;
    if (Array.isArray(result) && result.length > QUERY_CONFIG.maxRows) {
      result = result.slice(0, QUERY_CONFIG.maxRows);
      truncated = true;
    }

    logger.info('MongoDB query executed', {
      instanceId,
      databaseName,
      duration,
      method: parsedQuery.method,
      collection: parsedQuery.collection,
      documentCount: Array.isArray(result) ? result.length : 1,
      truncated,
    });

    return {
      success: true,
      result,
      duration,
      documentCount: Array.isArray(result) ? result.length : (typeof result === 'number' ? result : 1),
      truncated,
      warnings: validation.warnings,
    };
  } catch (error) {
    // Re-throw our custom errors as-is
    if (error instanceof ValidationError || error instanceof QueryExecutionError) {
      throw error;
    }

    logger.error('MongoDB query execution failed', {
      instanceId,
      databaseName,
      error: error.message,
      code: error.code,
    });

    throw new QueryExecutionError(`Query execution failed: ${error.message}`, {
      code: error.code,
      codeName: error.codeName,
    });
  }
};

/**
 * Execute MongoDB collection operation
 */
const executeMongoOperation = async (collection, parsedQuery) => {
  const maxRows = QUERY_CONFIG.maxRows;

  switch (parsedQuery.method) {
    case 'find':
      return collection
        .find(parsedQuery.query || {})
        .limit(Math.min(parsedQuery.limit || maxRows, maxRows))
        .toArray();
    
    case 'findOne':
      return collection.findOne(parsedQuery.query || {});
    
    case 'aggregate': {
      // Add $limit stage if not present (prevent unbounded results)
      const pipeline = [...(parsedQuery.pipeline || [])];
      const hasOutputStage = pipeline.some(stage => stage.$out || stage.$merge);
      const hasLimitStage = pipeline.some(stage => stage.$limit);
      
      if (!hasOutputStage && !hasLimitStage) {
        pipeline.push({ $limit: maxRows });
      }
      
      return collection.aggregate(pipeline).toArray();
    }
    
    case 'count':
    case 'countDocuments':
      return collection.countDocuments(parsedQuery.query || {});
    
    case 'estimatedDocumentCount':
      return collection.estimatedDocumentCount();
    
    case 'distinct':
      return collection.distinct(parsedQuery.field, parsedQuery.query || {});
    
    case 'insertOne':
      return collection.insertOne(parsedQuery.document);
    
    case 'insertMany':
      return collection.insertMany(parsedQuery.documents);
    
    case 'updateOne':
      return collection.updateOne(parsedQuery.filter, parsedQuery.update, parsedQuery.options);
    
    case 'updateMany':
      return collection.updateMany(parsedQuery.filter, parsedQuery.update, parsedQuery.options);
    
    case 'deleteOne':
      return collection.deleteOne(parsedQuery.filter);
    
    case 'deleteMany':
      return collection.deleteMany(parsedQuery.filter);
    
    case 'findOneAndUpdate':
      return collection.findOneAndUpdate(
        parsedQuery.filter,
        parsedQuery.update,
        parsedQuery.options || { returnDocument: 'after' }
      );
    
    case 'findOneAndDelete':
      return collection.findOneAndDelete(parsedQuery.filter, parsedQuery.options);
    
    default:
      throw new ValidationError(`Unsupported MongoDB method: ${parsedQuery.method}`);
  }
};

// ============================================================================
// MONGODB QUERY PARSING
// ============================================================================

/**
 * Parse MongoDB query string
 * Supports formats:
 * - db.collection.method({...})
 * - db["collection"].method({...})
 * - JSON command object
 */
const parseMongoQuery = (queryContent) => {
  const trimmed = queryContent.trim();

  // Try to parse as JSON command first
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      return { type: 'command', command: parsed };
    }
  } catch (e) {
    // Not JSON, continue
  }

  // Match pattern: db.collection.method(...)
  const dotMatch = trimmed.match(/^db\.(\w+)\.(\w+)\(([\s\S]*)\)$/);
  if (dotMatch) {
    return parseMatchedQuery(dotMatch[1], dotMatch[2], dotMatch[3]);
  }

  // Match pattern: db["collection"].method(...)
  const bracketMatch = trimmed.match(/^db\["([^"]+)"\]\.(\w+)\(([\s\S]*)\)$/);
  if (bracketMatch) {
    return parseMatchedQuery(bracketMatch[1], bracketMatch[2], bracketMatch[3]);
  }

  // Match pattern: db['collection'].method(...)
  const singleQuoteMatch = trimmed.match(/^db\['([^']+)'\]\.(\w+)\(([\s\S]*)\)$/);
  if (singleQuoteMatch) {
    return parseMatchedQuery(singleQuoteMatch[1], singleQuoteMatch[2], singleQuoteMatch[3]);
  }

  throw new Error(
    'Query must be in format: db.collection.method(...) or valid JSON command'
  );
};

/**
 * Parse matched query parts
 */
const parseMatchedQuery = (collection, method, argsStr) => {
  const result = {
    type: 'operation',
    collection,
    method,
  };

  const args = argsStr.trim();
  
  if (!args) {
    return result;
  }

  try {
    const parsedArgs = parseArguments(args);
    
    switch (method) {
      case 'find':
      case 'findOne':
        result.query = parsedArgs[0] || {};
        if (parsedArgs[1]) {
          result.projection = parsedArgs[1];
        }
        break;
      
      case 'count':
      case 'countDocuments':
      case 'deleteOne':
      case 'deleteMany':
        result.query = parsedArgs[0] || {};
        result.filter = parsedArgs[0] || {};
        break;
      
      case 'aggregate':
        result.pipeline = parsedArgs[0] || [];
        if (parsedArgs[1]) {
          result.options = parsedArgs[1];
        }
        break;
      
      case 'distinct':
        result.field = parsedArgs[0];
        result.query = parsedArgs[1] || {};
        break;
      
      case 'insertOne':
        result.document = parsedArgs[0];
        break;
      
      case 'insertMany':
        result.documents = parsedArgs[0];
        break;
      
      case 'updateOne':
      case 'updateMany':
        result.filter = parsedArgs[0] || {};
        result.update = parsedArgs[1] || {};
        if (parsedArgs[2]) {
          result.options = parsedArgs[2];
        }
        break;
      
      case 'findOneAndUpdate':
      case 'findOneAndDelete':
        result.filter = parsedArgs[0] || {};
        result.update = parsedArgs[1];
        if (parsedArgs[2]) {
          result.options = parsedArgs[2];
        }
        break;
      
      default:
        result.args = parsedArgs;
    }
  } catch (e) {
    throw new Error(`Failed to parse query arguments: ${e.message}`);
  }

  return result;
};

/**
 * Parse query arguments
 */
const parseArguments = (argsStr) => {
  try {
    return JSON.parse(`[${argsStr}]`);
  } catch (e) {
    try {
      return [JSON.parse(argsStr)];
    } catch (e2) {
      throw new Error('Arguments must be valid JSON');
    }
  }
};

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Execute query based on database type
 * @param {Object} request - Query request object
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Execution result
 */
const executeQuery = async (request, options = {}) => {
  const { databaseType, instanceId, databaseName, queryContent } = request;

  // Audit log
  logger.info('Query execution requested', {
    databaseType,
    instanceId,
    databaseName,
    queryLength: queryContent?.length,
    userId: request.userId,
    requestId: request.requestId,
  });

  if (databaseType === 'postgresql') {
    return executePostgresQuery(instanceId, databaseName, queryContent, options);
  } else if (databaseType === 'mongodb') {
    return executeMongoQuery(instanceId, databaseName, queryContent, options);
  } else {
    throw new ValidationError(`Unsupported database type: ${databaseType}`);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Test database connection
 */
const testConnection = async (databaseType, instanceId, databaseName) => {
  const startTime = Date.now();

  try {
    if (databaseType === 'postgresql') {
      await executePostgresQuery(
        instanceId,
        databaseName,
        'SELECT 1 as connected',
        { readOnly: true }
      );
      return {
        success: true,
        latency: Date.now() - startTime,
        message: 'PostgreSQL connection successful',
      };
    } else if (databaseType === 'mongodb') {
      await executeMongoQuery(
        instanceId,
        databaseName,
        '{"ping": 1}',
        {}
      );
      return {
        success: true,
        latency: Date.now() - startTime,
        message: 'MongoDB connection successful',
      };
    } else {
      throw new ValidationError(`Unsupported database type: ${databaseType}`);
    }
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime,
      message: error.message,
      error: error.code || 'CONNECTION_FAILED',
    };
  }
};

/**
 * Close all database connections (for graceful shutdown)
 */
const closeAllConnections = async () => {
  const closePromises = [];

  // Close PostgreSQL pools
  for (const [key, pool] of pgPools) {
    closePromises.push(
      pool.end()
        .then(() => logger.info('PostgreSQL pool closed', { key }))
        .catch((error) => logger.error('Error closing PostgreSQL pool', { key, error: error.message }))
    );
  }
  pgPools.clear();

  // Close MongoDB clients
  for (const [key, client] of mongoClients) {
    closePromises.push(
      client.close()
        .then(() => logger.info('MongoDB client closed', { key }))
        .catch((error) => logger.error('Error closing MongoDB client', { key, error: error.message }))
    );
  }
  mongoClients.clear();

  await Promise.allSettled(closePromises);
  logger.info('All database connections closed');
};

/**
 * Get connection pool statistics (for monitoring)
 */
const getPoolStats = () => {
  const stats = {
    postgresql: {},
    mongodb: {},
  };

  for (const [key, pool] of pgPools) {
    stats.postgresql[key] = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  }

  for (const [key] of mongoClients) {
    stats.mongodb[key] = { connected: true };
  }

  return stats;
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  executePostgresQuery,
  executeMongoQuery,
  executeQuery,
  testConnection,
  closeAllConnections,
  getPoolStats,
  validateQuery,
  QUERY_CONFIG,
};