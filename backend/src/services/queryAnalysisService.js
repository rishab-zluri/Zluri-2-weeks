/**
 * Query Analysis Service
 * 
 * Analyzes SQL and MongoDB queries to:
 * 1. Classify operation type (DDL, DML, DQL, etc.)
 * 2. Assess risk level (critical, high, medium, low, safe)
 * 3. Estimate database impact
 * 4. Provide warnings and recommendations
 * 
 * NOTE: This service does NOT block queries - it provides information
 * for managers to make informed approval decisions.
 */

// =============================================================================
// RISK LEVELS
// =============================================================================

const RiskLevel = {
  CRITICAL: 'critical',   // Irreversible, affects entire database/schema
  HIGH: 'high',           // Potentially destructive, affects multiple records
  MEDIUM: 'medium',       // Modifies data, limited scope
  LOW: 'low',             // Read with potential performance impact
  SAFE: 'safe',           // Read-only, minimal impact
};

const RiskColors = {
  critical: '#DC2626',    // Red
  high: '#EA580C',        // Orange
  medium: '#CA8A04',      // Yellow
  low: '#2563EB',         // Blue
  safe: '#16A34A',        // Green
};

// =============================================================================
// OPERATION TYPES
// =============================================================================

const OperationType = {
  // SQL Categories
  DDL: 'DDL',   // Data Definition Language (CREATE, ALTER, DROP, TRUNCATE)
  DML: 'DML',   // Data Manipulation Language (INSERT, UPDATE, DELETE)
  DQL: 'DQL',   // Data Query Language (SELECT)
  DCL: 'DCL',   // Data Control Language (GRANT, REVOKE)
  TCL: 'TCL',   // Transaction Control Language (COMMIT, ROLLBACK)
  // MongoDB Categories
  CRUD_READ: 'CRUD_READ',
  CRUD_WRITE: 'CRUD_WRITE',
  AGGREGATION: 'AGGREGATION',
  INDEX: 'INDEX',
  ADMIN: 'ADMIN',
};

// =============================================================================
// POSTGRESQL QUERY PATTERNS
// =============================================================================

const POSTGRES_PATTERNS = {
  // DDL - Data Definition Language
  ddl: [
    {
      pattern: /^\s*DROP\s+DATABASE\s+/i,
      operation: 'DROP DATABASE',
      type: OperationType.DDL,
      risk: RiskLevel.CRITICAL,
      description: 'Permanently deletes entire database',
      impact: {
        scope: 'database',
        reversible: false,
        estimatedEffect: 'Complete data loss for entire database',
      },
    },
    {
      pattern: /^\s*DROP\s+SCHEMA\s+.*\s+CASCADE/i,
      operation: 'DROP SCHEMA CASCADE',
      type: OperationType.DDL,
      risk: RiskLevel.CRITICAL,
      description: 'Drops schema and ALL dependent objects',
      impact: {
        scope: 'schema',
        reversible: false,
        estimatedEffect: 'All tables, views, functions in schema will be deleted',
      },
    },
    {
      pattern: /^\s*DROP\s+TABLE\s+/i,
      operation: 'DROP TABLE',
      type: OperationType.DDL,
      risk: RiskLevel.CRITICAL,
      description: 'Permanently deletes table and all its data',
      impact: {
        scope: 'table',
        reversible: false,
        estimatedEffect: 'Complete data loss for table',
      },
    },
    {
      pattern: /^\s*TRUNCATE\s+/i,
      operation: 'TRUNCATE',
      type: OperationType.DDL,
      risk: RiskLevel.CRITICAL,
      description: 'Removes all rows from table instantly',
      impact: {
        scope: 'table',
        reversible: false,
        estimatedEffect: 'All rows deleted, cannot be rolled back',
      },
    },
    {
      pattern: /^\s*ALTER\s+TABLE\s+.*\s+DROP\s+COLUMN/i,
      operation: 'ALTER TABLE DROP COLUMN',
      type: OperationType.DDL,
      risk: RiskLevel.HIGH,
      description: 'Removes column and all its data',
      impact: {
        scope: 'column',
        reversible: false,
        estimatedEffect: 'Column data permanently lost',
      },
    },
    {
      pattern: /^\s*ALTER\s+TABLE\s+.*\s+ALTER\s+COLUMN.*TYPE/i,
      operation: 'ALTER COLUMN TYPE',
      type: OperationType.DDL,
      risk: RiskLevel.HIGH,
      description: 'Changes column data type',
      impact: {
        scope: 'column',
        reversible: false,
        estimatedEffect: 'Data may be truncated or converted with loss',
      },
    },
    {
      pattern: /^\s*ALTER\s+TABLE\s+.*\s+RENAME/i,
      operation: 'ALTER TABLE RENAME',
      type: OperationType.DDL,
      risk: RiskLevel.MEDIUM,
      description: 'Renames table or column',
      impact: {
        scope: 'table',
        reversible: true,
        estimatedEffect: 'May break application queries referencing old name',
      },
    },
    {
      pattern: /^\s*ALTER\s+TABLE\s+.*\s+ADD\s+COLUMN/i,
      operation: 'ALTER TABLE ADD COLUMN',
      type: OperationType.DDL,
      risk: RiskLevel.LOW,
      description: 'Adds new column to table',
      impact: {
        scope: 'column',
        reversible: true,
        estimatedEffect: 'New column added, existing data unaffected',
      },
    },
    {
      pattern: /^\s*CREATE\s+TABLE/i,
      operation: 'CREATE TABLE',
      type: OperationType.DDL,
      risk: RiskLevel.LOW,
      description: 'Creates new table',
      impact: {
        scope: 'table',
        reversible: true,
        estimatedEffect: 'New table created, no existing data affected',
      },
    },
    {
      pattern: /^\s*CREATE\s+INDEX/i,
      operation: 'CREATE INDEX',
      type: OperationType.DDL,
      risk: RiskLevel.MEDIUM,
      description: 'Creates index on table',
      impact: {
        scope: 'table',
        reversible: true,
        estimatedEffect: 'May lock table during creation, improves query performance',
      },
    },
    {
      pattern: /^\s*DROP\s+INDEX/i,
      operation: 'DROP INDEX',
      type: OperationType.DDL,
      risk: RiskLevel.MEDIUM,
      description: 'Removes index from table',
      impact: {
        scope: 'index',
        reversible: true,
        estimatedEffect: 'Query performance may degrade',
      },
    },
  ],

  // DML - Data Manipulation Language
  dml: [
    {
      pattern: /^\s*DELETE\s+FROM\s+.*\s+WHERE\s+/i,
      operation: 'DELETE (with WHERE)',
      type: OperationType.DML,
      risk: RiskLevel.HIGH,
      description: 'Deletes rows matching condition',
      impact: {
        scope: 'rows',
        reversible: false,
        estimatedEffect: 'Matching rows will be permanently deleted',
        rowEstimate: 'CONDITIONAL',
      },
    },
    {
      pattern: /^\s*DELETE\s+FROM\s+\w+\s*$/i,
      operation: 'DELETE (no WHERE)',
      type: OperationType.DML,
      risk: RiskLevel.CRITICAL,
      description: 'Deletes ALL rows from table',
      impact: {
        scope: 'table',
        reversible: false,
        estimatedEffect: 'All rows will be deleted',
        rowEstimate: 'ALL',
      },
    },
    {
      pattern: /^\s*DELETE\s+FROM\s+\w+\s*;?\s*$/i,
      operation: 'DELETE (no WHERE)',
      type: OperationType.DML,
      risk: RiskLevel.CRITICAL,
      description: 'Deletes ALL rows from table',
      impact: {
        scope: 'table',
        reversible: false,
        estimatedEffect: 'All rows will be deleted',
        rowEstimate: 'ALL',
      },
    },
    {
      pattern: /^\s*UPDATE\s+.*\s+WHERE\s+/i,
      operation: 'UPDATE (with WHERE)',
      type: OperationType.DML,
      risk: RiskLevel.HIGH,
      description: 'Updates rows matching condition',
      impact: {
        scope: 'rows',
        reversible: false,
        estimatedEffect: 'Matching rows will be modified',
        rowEstimate: 'CONDITIONAL',
      },
    },
    {
      pattern: /^\s*UPDATE\s+\w+\s+SET\s+[^;]*$/i,
      operation: 'UPDATE (no WHERE)',
      type: OperationType.DML,
      risk: RiskLevel.CRITICAL,
      description: 'Updates ALL rows in table',
      impact: {
        scope: 'table',
        reversible: false,
        estimatedEffect: 'All rows will be modified',
        rowEstimate: 'ALL',
      },
    },
    {
      pattern: /^\s*INSERT\s+INTO/i,
      operation: 'INSERT',
      type: OperationType.DML,
      risk: RiskLevel.MEDIUM,
      description: 'Inserts new rows',
      impact: {
        scope: 'rows',
        reversible: true,
        estimatedEffect: 'New rows added to table',
        rowEstimate: 'NEW',
      },
    },
    {
      pattern: /^\s*UPSERT|ON\s+CONFLICT.*DO\s+UPDATE/i,
      operation: 'UPSERT',
      type: OperationType.DML,
      risk: RiskLevel.MEDIUM,
      description: 'Insert or update on conflict',
      impact: {
        scope: 'rows',
        reversible: false,
        estimatedEffect: 'Rows inserted or existing rows updated',
        rowEstimate: 'CONDITIONAL',
      },
    },
  ],

  // DQL - Data Query Language
  // NOTE: More specific patterns (SELECT FOR UPDATE) must come BEFORE generic patterns (SELECT)
  dql: [
    {
      pattern: /^\s*SELECT\s+.*\s+FOR\s+UPDATE/i,
      operation: 'SELECT FOR UPDATE',
      type: OperationType.DQL,
      risk: RiskLevel.LOW,
      description: 'Reads and locks rows for update',
      impact: {
        scope: 'rows',
        reversible: true,
        estimatedEffect: 'Rows locked until transaction ends, may cause blocking',
      },
    },
    {
      pattern: /^\s*SELECT\s+.*\s+FROM\s+/i,
      operation: 'SELECT',
      type: OperationType.DQL,
      risk: RiskLevel.SAFE,
      description: 'Reads data from table(s)',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'Read-only, no data modification',
      },
    },
    {
      pattern: /^\s*EXPLAIN\s+/i,
      operation: 'EXPLAIN',
      type: OperationType.DQL,
      risk: RiskLevel.SAFE,
      description: 'Shows query execution plan',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'No data access, only plan analysis',
      },
    },
  ],

  // DCL - Data Control Language
  dcl: [
    {
      pattern: /^\s*GRANT\s+/i,
      operation: 'GRANT',
      type: OperationType.DCL,
      risk: RiskLevel.HIGH,
      description: 'Grants permissions',
      impact: {
        scope: 'permissions',
        reversible: true,
        estimatedEffect: 'User/role gains new permissions',
      },
    },
    {
      pattern: /^\s*REVOKE\s+/i,
      operation: 'REVOKE',
      type: OperationType.DCL,
      risk: RiskLevel.HIGH,
      description: 'Revokes permissions',
      impact: {
        scope: 'permissions',
        reversible: true,
        estimatedEffect: 'User/role loses permissions, may break application access',
      },
    },
  ],

  // TCL - Transaction Control Language
  tcl: [
    {
      pattern: /^\s*COMMIT/i,
      operation: 'COMMIT',
      type: OperationType.TCL,
      risk: RiskLevel.LOW,
      description: 'Commits transaction',
      impact: {
        scope: 'transaction',
        reversible: false,
        estimatedEffect: 'Makes all changes in transaction permanent',
      },
    },
    {
      pattern: /^\s*ROLLBACK/i,
      operation: 'ROLLBACK',
      type: OperationType.TCL,
      risk: RiskLevel.LOW,
      description: 'Rolls back transaction',
      impact: {
        scope: 'transaction',
        reversible: true,
        estimatedEffect: 'Undoes all changes in current transaction',
      },
    },
  ],
};


// =============================================================================
// MONGODB QUERY PATTERNS
// =============================================================================

const MONGODB_PATTERNS = {
  // Administrative Operations
  admin: [
    {
      pattern: /\.dropDatabase\s*\(/i,
      operation: 'dropDatabase',
      type: OperationType.ADMIN,
      risk: RiskLevel.CRITICAL,
      description: 'Drops entire database',
      impact: {
        scope: 'database',
        reversible: false,
        estimatedEffect: 'Complete database deletion, all collections lost',
      },
    },
    {
      pattern: /\.drop\s*\(\s*\)/i,
      operation: 'drop collection',
      type: OperationType.ADMIN,
      risk: RiskLevel.CRITICAL,
      description: 'Drops entire collection',
      impact: {
        scope: 'collection',
        reversible: false,
        estimatedEffect: 'All documents in collection permanently deleted',
      },
    },
    {
      pattern: /\.renameCollection\s*\(/i,
      operation: 'renameCollection',
      type: OperationType.ADMIN,
      risk: RiskLevel.MEDIUM,
      description: 'Renames collection',
      impact: {
        scope: 'collection',
        reversible: true,
        estimatedEffect: 'Collection name changed, may break application references',
      },
    },
  ],

  // Index Operations
  index: [
    {
      pattern: /\.createIndex\s*\(/i,
      operation: 'createIndex',
      type: OperationType.INDEX,
      risk: RiskLevel.MEDIUM,
      description: 'Creates index on collection',
      impact: {
        scope: 'collection',
        reversible: true,
        estimatedEffect: 'Index creation may take time for large collections',
      },
    },
    {
      pattern: /\.dropIndex\s*\(/i,
      operation: 'dropIndex',
      type: OperationType.INDEX,
      risk: RiskLevel.MEDIUM,
      description: 'Drops index from collection',
      impact: {
        scope: 'index',
        reversible: true,
        estimatedEffect: 'Query performance may degrade',
      },
    },
    {
      pattern: /\.dropIndexes\s*\(\s*\)/i,
      operation: 'dropIndexes (all)',
      type: OperationType.INDEX,
      risk: RiskLevel.HIGH,
      description: 'Drops ALL indexes from collection',
      impact: {
        scope: 'collection',
        reversible: true,
        estimatedEffect: 'All non-_id indexes removed, severe performance impact',
      },
    },
    {
      pattern: /\.reIndex\s*\(/i,
      operation: 'reIndex',
      type: OperationType.INDEX,
      risk: RiskLevel.MEDIUM,
      description: 'Rebuilds all indexes',
      impact: {
        scope: 'collection',
        reversible: true,
        estimatedEffect: 'Collection locked during reindex, may take significant time',
      },
    },
  ],

  // Write Operations
  write: [
    {
      pattern: /\.deleteMany\s*\(\s*\{\s*\}\s*\)/i,
      operation: 'deleteMany (empty filter)',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.CRITICAL,
      description: 'Deletes ALL documents in collection',
      impact: {
        scope: 'collection',
        reversible: false,
        estimatedEffect: 'All documents permanently deleted',
        documentEstimate: 'ALL',
      },
    },
    {
      pattern: /\.remove\s*\(\s*\{\s*\}\s*\)/i,
      operation: 'remove (empty filter)',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.CRITICAL,
      description: 'Removes ALL documents in collection',
      impact: {
        scope: 'collection',
        reversible: false,
        estimatedEffect: 'All documents permanently deleted',
        documentEstimate: 'ALL',
      },
    },
    {
      pattern: /\.deleteMany\s*\(/i,
      operation: 'deleteMany',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.HIGH,
      description: 'Deletes multiple documents matching filter',
      impact: {
        scope: 'documents',
        reversible: false,
        estimatedEffect: 'Matching documents permanently deleted',
        documentEstimate: 'CONDITIONAL',
      },
    },
    {
      pattern: /\.deleteOne\s*\(/i,
      operation: 'deleteOne',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.MEDIUM,
      description: 'Deletes single document',
      impact: {
        scope: 'document',
        reversible: false,
        estimatedEffect: 'One matching document deleted',
        documentEstimate: '1',
      },
    },
    {
      pattern: /\.updateMany\s*\(\s*\{\s*\}\s*,/i,
      operation: 'updateMany (empty filter)',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.CRITICAL,
      description: 'Updates ALL documents in collection',
      impact: {
        scope: 'collection',
        reversible: false,
        estimatedEffect: 'All documents will be modified',
        documentEstimate: 'ALL',
      },
    },
    {
      pattern: /\.updateMany\s*\(/i,
      operation: 'updateMany',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.HIGH,
      description: 'Updates multiple documents',
      impact: {
        scope: 'documents',
        reversible: false,
        estimatedEffect: 'Matching documents modified',
        documentEstimate: 'CONDITIONAL',
      },
    },
    {
      pattern: /\.updateOne\s*\(/i,
      operation: 'updateOne',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.MEDIUM,
      description: 'Updates single document',
      impact: {
        scope: 'document',
        reversible: false,
        estimatedEffect: 'One matching document modified',
        documentEstimate: '1',
      },
    },
    {
      pattern: /\.replaceOne\s*\(/i,
      operation: 'replaceOne',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.MEDIUM,
      description: 'Replaces entire document',
      impact: {
        scope: 'document',
        reversible: false,
        estimatedEffect: 'Document completely replaced (not merged)',
        documentEstimate: '1',
      },
    },
    {
      pattern: /\.insertOne\s*\(/i,
      operation: 'insertOne',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.LOW,
      description: 'Inserts single document',
      impact: {
        scope: 'document',
        reversible: true,
        estimatedEffect: 'New document added',
        documentEstimate: '1',
      },
    },
    {
      pattern: /\.insertMany\s*\(/i,
      operation: 'insertMany',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.MEDIUM,
      description: 'Inserts multiple documents',
      impact: {
        scope: 'documents',
        reversible: true,
        estimatedEffect: 'Multiple new documents added',
        documentEstimate: 'MULTIPLE',
      },
    },
    {
      pattern: /\.bulkWrite\s*\(/i,
      operation: 'bulkWrite',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.HIGH,
      description: 'Executes bulk write operations',
      impact: {
        scope: 'documents',
        reversible: false,
        estimatedEffect: 'Multiple operations executed atomically',
        documentEstimate: 'MULTIPLE',
      },
    },
    {
      pattern: /\.findOneAndDelete\s*\(/i,
      operation: 'findOneAndDelete',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.MEDIUM,
      description: 'Finds and deletes document',
      impact: {
        scope: 'document',
        reversible: false,
        estimatedEffect: 'One document found and deleted',
        documentEstimate: '1',
      },
    },
    {
      pattern: /\.findOneAndUpdate\s*\(/i,
      operation: 'findOneAndUpdate',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.MEDIUM,
      description: 'Finds and updates document',
      impact: {
        scope: 'document',
        reversible: false,
        estimatedEffect: 'One document found and modified',
        documentEstimate: '1',
      },
    },
    {
      pattern: /\.findOneAndReplace\s*\(/i,
      operation: 'findOneAndReplace',
      type: OperationType.CRUD_WRITE,
      risk: RiskLevel.MEDIUM,
      description: 'Finds and replaces document',
      impact: {
        scope: 'document',
        reversible: false,
        estimatedEffect: 'One document completely replaced',
        documentEstimate: '1',
      },
    },
  ],

  // Read Operations
  read: [
    {
      pattern: /\.find\s*\(/i,
      operation: 'find',
      type: OperationType.CRUD_READ,
      risk: RiskLevel.SAFE,
      description: 'Queries documents',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'Read-only, no data modification',
      },
    },
    {
      pattern: /\.findOne\s*\(/i,
      operation: 'findOne',
      type: OperationType.CRUD_READ,
      risk: RiskLevel.SAFE,
      description: 'Queries single document',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'Read-only, no data modification',
      },
    },
    {
      pattern: /\.countDocuments\s*\(/i,
      operation: 'countDocuments',
      type: OperationType.CRUD_READ,
      risk: RiskLevel.SAFE,
      description: 'Counts documents',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'Read-only count operation',
      },
    },
    {
      pattern: /\.estimatedDocumentCount\s*\(/i,
      operation: 'estimatedDocumentCount',
      type: OperationType.CRUD_READ,
      risk: RiskLevel.SAFE,
      description: 'Estimates document count',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'Fast metadata-based count estimate',
      },
    },
    {
      pattern: /\.distinct\s*\(/i,
      operation: 'distinct',
      type: OperationType.CRUD_READ,
      risk: RiskLevel.SAFE,
      description: 'Gets distinct values',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'Read-only, returns unique values',
      },
    },
  ],

  // Aggregation
  aggregation: [
    {
      pattern: /\.aggregate\s*\(/i,
      operation: 'aggregate',
      type: OperationType.AGGREGATION,
      risk: RiskLevel.SAFE,
      description: 'Aggregation pipeline',
      impact: {
        scope: 'none',
        reversible: true,
        estimatedEffect: 'Read-only data transformation',
      },
    },
    {
      pattern: /\$out\s*:/i,
      operation: 'aggregate with $out',
      type: OperationType.AGGREGATION,
      risk: RiskLevel.HIGH,
      description: 'Aggregation writes to collection',
      impact: {
        scope: 'collection',
        reversible: false,
        estimatedEffect: 'Output collection will be replaced entirely',
      },
    },
    {
      pattern: /\$merge\s*:/i,
      operation: 'aggregate with $merge',
      type: OperationType.AGGREGATION,
      risk: RiskLevel.HIGH,
      description: 'Aggregation merges to collection',
      impact: {
        scope: 'collection',
        reversible: false,
        estimatedEffect: 'Documents merged into target collection',
      },
    },
  ],
};


// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Analyze a PostgreSQL query
 * @param {string} query - The SQL query
 * @returns {Object} Analysis result
 */
const analyzePostgresQuery = (query) => {
  const trimmedQuery = query.trim();
  const analysis = {
    query: trimmedQuery,
    databaseType: 'postgresql',
    operations: [],
    overallRisk: RiskLevel.SAFE,
    riskColor: RiskColors.safe,
    warnings: [],
    recommendations: [],
    summary: '',
  };

  // Check patterns in order - for DML, take first match only
  const matchedTypes = new Set();
  
  // Check DDL patterns
  for (const patternDef of POSTGRES_PATTERNS.ddl) {
    if (patternDef.pattern.test(trimmedQuery)) {
      analysis.operations.push({
        operation: patternDef.operation,
        type: patternDef.type,
        risk: patternDef.risk,
        description: patternDef.description,
        impact: patternDef.impact,
      });
      matchedTypes.add('DDL');
      break; // Take first DDL match
    }
  }

  // Check DML patterns - take first match only
  if (!matchedTypes.has('DDL')) {
    for (const patternDef of POSTGRES_PATTERNS.dml) {
      if (patternDef.pattern.test(trimmedQuery)) {
        analysis.operations.push({
          operation: patternDef.operation,
          type: patternDef.type,
          risk: patternDef.risk,
          description: patternDef.description,
          impact: patternDef.impact,
        });
        matchedTypes.add('DML');
        break; // Take first DML match
      }
    }
  }

  // Check DQL patterns
  if (!matchedTypes.has('DDL') && !matchedTypes.has('DML')) {
    for (const patternDef of POSTGRES_PATTERNS.dql) {
      if (patternDef.pattern.test(trimmedQuery)) {
        analysis.operations.push({
          operation: patternDef.operation,
          type: patternDef.type,
          risk: patternDef.risk,
          description: patternDef.description,
          impact: patternDef.impact,
        });
        matchedTypes.add('DQL');
        break;
      }
    }
  }

  // Check DCL patterns
  for (const patternDef of POSTGRES_PATTERNS.dcl) {
    if (patternDef.pattern.test(trimmedQuery)) {
      analysis.operations.push({
        operation: patternDef.operation,
        type: patternDef.type,
        risk: patternDef.risk,
        description: patternDef.description,
        impact: patternDef.impact,
      });
      matchedTypes.add('DCL');
      break;
    }
  }

  // Check TCL patterns
  for (const patternDef of POSTGRES_PATTERNS.tcl) {
    if (patternDef.pattern.test(trimmedQuery)) {
      analysis.operations.push({
        operation: patternDef.operation,
        type: patternDef.type,
        risk: patternDef.risk,
        description: patternDef.description,
        impact: patternDef.impact,
      });
      matchedTypes.add('TCL');
      break;
    }
  }

  // If no patterns matched, mark as unknown
  if (analysis.operations.length === 0) {
    analysis.operations.push({
      operation: 'UNKNOWN',
      type: 'UNKNOWN',
      risk: RiskLevel.MEDIUM,
      description: 'Query type not recognized',
      impact: {
        scope: 'unknown',
        reversible: null,
        estimatedEffect: 'Unable to determine impact - review carefully',
      },
    });
  }

  // Calculate overall risk (highest of all operations)
  const riskOrder = [RiskLevel.SAFE, RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
  let highestRiskIndex = 0;

  for (const op of analysis.operations) {
    const riskIndex = riskOrder.indexOf(op.risk);
    if (riskIndex > highestRiskIndex) {
      highestRiskIndex = riskIndex;
    }
  }

  analysis.overallRisk = riskOrder[highestRiskIndex];
  analysis.riskColor = RiskColors[analysis.overallRisk];

  // Generate warnings based on patterns
  analysis.warnings = generatePostgresWarnings(trimmedQuery, analysis.operations);

  // Generate recommendations
  analysis.recommendations = generatePostgresRecommendations(trimmedQuery, analysis.operations);

  // Generate summary
  analysis.summary = generateSummary(analysis);

  return analysis;
};

/**
 * Analyze a MongoDB query
 * @param {string} query - The MongoDB query
 * @returns {Object} Analysis result
 */
const analyzeMongoQuery = (query) => {
  const trimmedQuery = query.trim();
  const analysis = {
    query: trimmedQuery,
    databaseType: 'mongodb',
    operations: [],
    overallRisk: RiskLevel.SAFE,
    riskColor: RiskColors.safe,
    warnings: [],
    recommendations: [],
    summary: '',
  };

  // Check all pattern categories
  const allPatterns = [
    ...MONGODB_PATTERNS.admin,
    ...MONGODB_PATTERNS.index,
    ...MONGODB_PATTERNS.write,
    ...MONGODB_PATTERNS.read,
    ...MONGODB_PATTERNS.aggregation,
  ];

  // Find matching patterns (check most specific first)
  const matchedOperations = new Set();

  for (const patternDef of allPatterns) {
    if (patternDef.pattern.test(trimmedQuery)) {
      // Avoid duplicate operation types (defensive - all patterns have unique names)
      /* istanbul ignore else */
      if (!matchedOperations.has(patternDef.operation)) {
        matchedOperations.add(patternDef.operation);
        analysis.operations.push({
          operation: patternDef.operation,
          type: patternDef.type,
          risk: patternDef.risk,
          description: patternDef.description,
          impact: patternDef.impact,
        });
      }
    }
  }

  // If no patterns matched, mark as unknown
  if (analysis.operations.length === 0) {
    analysis.operations.push({
      operation: 'UNKNOWN',
      type: 'UNKNOWN',
      risk: RiskLevel.MEDIUM,
      description: 'Query type not recognized',
      impact: {
        scope: 'unknown',
        reversible: null,
        estimatedEffect: 'Unable to determine impact - review carefully',
      },
    });
  }

  // Calculate overall risk (highest of all operations)
  const riskOrder = [RiskLevel.SAFE, RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
  let highestRiskIndex = 0;

  for (const op of analysis.operations) {
    const riskIndex = riskOrder.indexOf(op.risk);
    if (riskIndex > highestRiskIndex) {
      highestRiskIndex = riskIndex;
    }
  }

  analysis.overallRisk = riskOrder[highestRiskIndex];
  analysis.riskColor = RiskColors[analysis.overallRisk];

  // Generate warnings
  analysis.warnings = generateMongoWarnings(trimmedQuery, analysis.operations);

  // Generate recommendations
  analysis.recommendations = generateMongoRecommendations(trimmedQuery, analysis.operations);

  // Generate summary
  analysis.summary = generateSummary(analysis);

  return analysis;
};

/**
 * Generate warnings for PostgreSQL queries
 */
const generatePostgresWarnings = (query, operations) => {
  const warnings = [];

  // Check for missing WHERE clause in DELETE/UPDATE
  if (/DELETE\s+FROM\s+\w+\s*(?:;|\s*$)/i.test(query)) {
    warnings.push({
      level: 'critical',
      message: 'DELETE without WHERE clause will remove ALL rows',
      suggestion: 'Add a WHERE clause to limit affected rows',
    });
  }

  if (/UPDATE\s+\w+\s+SET\s+[^;]+(?:;|\s*$)/i.test(query) && !/WHERE/i.test(query)) {
    warnings.push({
      level: 'critical',
      message: 'UPDATE without WHERE clause will modify ALL rows',
      suggestion: 'Add a WHERE clause to limit affected rows',
    });
  }

  // Check for CASCADE
  if (/CASCADE/i.test(query)) {
    warnings.push({
      level: 'high',
      message: 'CASCADE will affect dependent objects',
      suggestion: 'Review all dependent objects before executing',
    });
  }

  // Check for multiple statements
  const statementCount = (query.match(/;/g) || []).length;
  if (statementCount > 1) {
    warnings.push({
      level: 'medium',
      message: `Multiple statements detected (${statementCount + 1} statements)`,
      suggestion: 'Consider executing statements individually for better control',
    });
  }

  // Check for LIMIT in SELECT
  if (/SELECT/i.test(query) && !/LIMIT/i.test(query) && !/COUNT\s*\(/i.test(query)) {
    warnings.push({
      level: 'low',
      message: 'SELECT without LIMIT may return large result set',
      suggestion: 'Consider adding LIMIT to prevent memory issues',
    });
  }

  return warnings;
};

/**
 * Generate warnings for MongoDB queries
 */
const generateMongoWarnings = (query, operations) => {
  const warnings = [];

  // Check for empty filter in destructive operations
  if (/\.(deleteMany|updateMany|remove)\s*\(\s*\{\s*\}\s*[,)]/i.test(query)) {
    warnings.push({
      level: 'critical',
      message: 'Empty filter {} will affect ALL documents',
      suggestion: 'Add filter criteria to limit affected documents',
    });
  }

  // Check for $out in aggregation
  if (/\$out/i.test(query)) {
    warnings.push({
      level: 'high',
      message: '$out will replace entire target collection',
      suggestion: 'Ensure target collection can be safely replaced',
    });
  }

  // Check for no limit in find
  if (/\.find\s*\(/i.test(query) && !/\.limit\s*\(/i.test(query)) {
    warnings.push({
      level: 'low',
      message: 'find() without limit() may return large result set',
      suggestion: 'Consider adding .limit() for large collections',
    });
  }

  // Check for $where (JavaScript execution)
  if (/\$where/i.test(query)) {
    warnings.push({
      level: 'high',
      message: '$where executes JavaScript and has security implications',
      suggestion: 'Consider using standard query operators instead',
    });
  }

  return warnings;
};

/**
 * Generate recommendations for PostgreSQL queries
 */
const generatePostgresRecommendations = (query, operations) => {
  const recommendations = [];

  for (const op of operations) {
    if (op.risk === RiskLevel.CRITICAL || op.risk === RiskLevel.HIGH) {
      recommendations.push({
        priority: 'high',
        action: 'Create backup before executing',
        reason: `${op.operation} is ${op.impact.reversible ? 'partially' : 'not'} reversible`,
      });

      if (op.type === OperationType.DML) {
        recommendations.push({
          priority: 'high',
          action: 'Run SELECT with same WHERE clause first',
          reason: 'Verify affected rows before modification',
        });
      }
    }

    if (op.type === OperationType.DDL) {
      recommendations.push({
        priority: 'medium',
        action: 'Notify dependent application teams',
        reason: 'Schema changes may require application updates',
      });
    }
  }

  return recommendations;
};

/**
 * Generate recommendations for MongoDB queries
 */
const generateMongoRecommendations = (query, operations) => {
  const recommendations = [];

  for (const op of operations) {
    if (op.risk === RiskLevel.CRITICAL || op.risk === RiskLevel.HIGH) {
      recommendations.push({
        priority: 'high',
        action: 'Create backup before executing',
        reason: `${op.operation} is ${op.impact.reversible ? 'partially' : 'not'} reversible`,
      });

      if (op.type === OperationType.CRUD_WRITE && op.operation.includes('delete')) {
        recommendations.push({
          priority: 'high',
          action: 'Run find() with same filter first',
          reason: 'Verify affected documents before deletion',
        });
      }
    }

    if (op.type === OperationType.INDEX) {
      recommendations.push({
        priority: 'medium',
        action: 'Schedule during low-traffic period',
        reason: 'Index operations may impact performance',
      });
    }
  }

  return recommendations;
};

/**
 * Generate human-readable summary
 */
const generateSummary = (analysis) => {
  const opNames = analysis.operations.map(o => o.operation).join(', ');
  const riskLabel = analysis.overallRisk.toUpperCase();
  
  let impactSummary = '';
  if (analysis.operations.length > 0) {
    const primaryOp = analysis.operations[0];
    impactSummary = primaryOp.impact.estimatedEffect;
  }

  return `Risk Level: ${riskLabel} | Operations: ${opNames} | Impact: ${impactSummary}`;
};

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze query and return risk assessment
 * @param {string} query - The query content
 * @param {string} databaseType - 'postgresql' or 'mongodb'
 * @returns {Object} Complete analysis
 */
const analyzeQuery = (query, databaseType) => {
  if (!query || typeof query !== 'string') {
    return {
      error: 'Invalid query',
      databaseType,
      overallRisk: RiskLevel.MEDIUM,
      riskColor: RiskColors.medium,
      operations: [],
      warnings: [{ level: 'high', message: 'Empty or invalid query' }],
      recommendations: [],
      summary: 'Unable to analyze empty query',
    };
  }

  if (databaseType === 'postgresql') {
    return analyzePostgresQuery(query);
  } else if (databaseType === 'mongodb') {
    return analyzeMongoQuery(query);
  } else {
    return {
      error: `Unsupported database type: ${databaseType}`,
      databaseType,
      overallRisk: RiskLevel.MEDIUM,
      riskColor: RiskColors.medium,
      operations: [],
      warnings: [{ level: 'medium', message: `Unknown database type: ${databaseType}` }],
      recommendations: [],
      summary: 'Unable to analyze - unknown database type',
    };
  }
};

/**
 * Get risk badge for display
 * @param {string} riskLevel - Risk level
 * @returns {Object} Badge info
 */
const getRiskBadge = (riskLevel) => {
  const badges = {
    critical: { label: 'CRITICAL', color: '#DC2626', bgColor: '#FEE2E2', icon: '🔴' },
    high: { label: 'HIGH', color: '#EA580C', bgColor: '#FFEDD5', icon: '🟠' },
    medium: { label: 'MEDIUM', color: '#CA8A04', bgColor: '#FEF9C3', icon: '🟡' },
    low: { label: 'LOW', color: '#2563EB', bgColor: '#DBEAFE', icon: '🔵' },
    safe: { label: 'SAFE', color: '#16A34A', bgColor: '#DCFCE7', icon: '🟢' },
  };

  return badges[riskLevel] || badges.medium;
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Main function
  analyzeQuery,
  
  // Individual analyzers
  analyzePostgresQuery,
  analyzeMongoQuery,
  
  // Constants
  RiskLevel,
  RiskColors,
  OperationType,
  
  // Utilities
  getRiskBadge,
  generateSummary,
  
  // For testing
  POSTGRES_PATTERNS,
  MONGODB_PATTERNS,
};
