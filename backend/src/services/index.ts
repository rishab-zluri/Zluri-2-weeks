/**
 * Services Index
 * Export all services from a single entry point
 *
 * ARCHITECTURE:
 * - Named exports for individual functions
 * - Type exports for TypeScript consumers
 * - Default exports for backward compatibility
 *
 * WHY THIS EXISTS:
 * - Single import point for services
 * - Cleaner imports: import { login, executeQuery } from './services'
 * - Type co-location with implementation
 */

// =============================================================================
// AUTH SERVICE
// =============================================================================

export {
    login,
    logout,
    logoutAll,
    refreshAccessToken,
    verifyAccessToken,
    findUserByEmail,
    findUserById,
    hashPassword,
    verifyPassword,
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    getActiveSessions,
    revokeSession,
    cleanupExpiredTokens,
} from './authService';

export type {
    AccessTokenPayload,
    UserForToken,
    UserRow,
    LoginResult,
    LogoutResult,
    LogoutAllResult,
    RefreshResult,
    VerifyResult,
} from './authService';

// =============================================================================
// QUERY ANALYSIS SERVICE
// =============================================================================

export {
    analyzeQuery,
    analyzePostgresQuery,
    analyzeMongoQuery,
    RiskLevel,
    RiskColors,
    OperationType,
    getRiskBadge,
    generateSummary,
    POSTGRES_PATTERNS,
    MONGODB_PATTERNS,
} from './queryAnalysis';

export type {
    RiskLevelType,
    OperationTypeValue,
    OperationImpact,
    QueryPattern,
    AnalyzedOperation,
    AnalysisWarning,
    AnalysisRecommendation,
    QueryAnalysis,
    RiskBadge,
} from './queryAnalysis';

// =============================================================================
// SLACK SERVICE
// =============================================================================

export {
    isConfigured as isSlackConfigured,
    notifyNewSubmission,
    notifyApprovalSuccess,
    notifyApprovalFailure,
    notifyRejection,
    sendDirectMessage,
    lookupUserByEmail,
    testConnection as testSlackConnection,
    truncate,
    formatExecutionResult,
    formatErrorMessage,
    formatQueryPreview,
} from './slack';

export type {
    SlackQueryRequest,
    FormattedExecutionResult,
    FormattedError,
} from './slack';

// =============================================================================
// DATABASE SYNC SERVICE
// =============================================================================

export {
    syncInstanceDatabases,
    syncAllDatabases,
    startPeriodicSync,
    stopPeriodicSync,
    getSyncStatus,
    closeSyncPools,
    getInstances,
    getDatabasesForInstance,
    getInstanceById,
    getSyncHistory,
    addToBlacklist,
    removeFromBlacklist,
    getBlacklistEntries,
    getBlacklist,
    isBlacklisted,
    SYNC_CONFIG,
} from './databaseSyncService';

export type {
    SyncConfig,
    DatabaseInstance,
    InstanceCredentials,
    BlacklistEntry,
    InstanceSyncResult,
    FullSyncResult,
    SyncStatus,
    DatabaseEntry,
    SyncHistoryEntry,
} from './databaseSyncService';

// =============================================================================
// QUERY EXECUTION SERVICE
// =============================================================================

export {
    executePostgresQuery,
    executeMongoQuery,
    executeQuery,
    testConnection,
    closeAllConnections,
    getPoolStats,
    validateQuery,
    QUERY_CONFIG,
} from './queryExecution';

export type {
    QueryConfig,
    ValidationResult,
    ValidationWarning,
    QueryRequest,
    ExecutionOptions,
    PostgresExecutionResult,
    MongoExecutionResult,
    ConnectionTestResult,
    PoolStats,
} from './queryExecution';

// =============================================================================
// SCRIPT EXECUTION SERVICE
// =============================================================================

export {
    executeScript,
    validateScript,
    validateScriptSyntax,
    cleanupTempDirectory,
    buildExecutionSummary,
    EXECUTION_CONFIG,
} from './script';

export type {
    ExecutionConfig,
    SyntaxErrorDetails,
    SyntaxValidationResult,
    ScriptQueryRequest,
    OutputItem,
    ExecutionSummary,
    ScriptError,
    ExecutionMetadata,
    ScriptExecutionResult,
    ScriptValidationResult,
} from './script';

// =============================================================================
// DEFAULT EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

import authService from './authService';
import queryAnalysisService from './queryAnalysis';
import slackService from './slack';
import databaseSyncService from './databaseSyncService';
import queryExecutionService from './queryExecution';
import scriptExecutionService from './script';

export {
    authService,
    queryAnalysisService,
    slackService,
    databaseSyncService,
    queryExecutionService,
    scriptExecutionService,
};
