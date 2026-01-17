// =============================================================================
// RISK LEVELS
// =============================================================================

/**
 * Risk levels for query operations
 */
export const RiskLevel = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    SAFE: 'safe',
} as const;

export type RiskLevelType = (typeof RiskLevel)[keyof typeof RiskLevel];

/**
 * Risk level colors for UI display
 */
export const RiskColors: Record<RiskLevelType, string> = {
    critical: '#DC2626', // Red
    high: '#EA580C',     // Orange
    medium: '#CA8A04',   // Yellow
    low: '#2563EB',      // Blue
    safe: '#16A34A',     // Green
};

// =============================================================================
// OPERATION TYPES
// =============================================================================

/**
 * SQL and MongoDB operation categories
 */
export const OperationType = {
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
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType] | 'UNKNOWN';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface OperationImpact {
    scope: string;
    reversible: boolean | null;
    estimatedEffect: string;
    rowEstimate?: string;
    documentEstimate?: string;
}

export interface QueryPattern {
    pattern: RegExp;
    operation: string;
    type: OperationTypeValue;
    risk: RiskLevelType;
    description: string;
    impact: OperationImpact;
}

export interface AnalyzedOperation {
    operation: string;
    type: OperationTypeValue;
    risk: RiskLevelType;
    description: string;
    impact: OperationImpact;
    /** Number of times this operation appears in the content */
    count?: number;
    /** Line numbers where this operation appears */
    lineNumbers?: number[];
}

export interface AnalysisWarning {
    level: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    suggestion?: string;
    /** Line number where the warning originates */
    lineNumber?: number;
}

export interface AnalysisRecommendation {
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
}

/**
 * Detailed breakdown of a single statement
 */
export interface StatementDetail {
    /** Line number where statement starts */
    lineNumber: number;
    /** The statement content (truncated for display) */
    statement: string;
    /** Detected operation for this statement */
    operation: string;
    /** Risk level for this statement */
    risk: RiskLevelType;
    /** Type of operation */
    type: OperationTypeValue;
}

/**
 * Operation count summary
 */
export interface OperationCount {
    operation: string;
    count: number;
    risk: RiskLevelType;
    type: OperationTypeValue;
}

/**
 * Risk breakdown summary
 */
export interface RiskBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
    safe: number;
}

export interface QueryAnalysis {
    query?: string;
    databaseType: string;
    operations: AnalyzedOperation[];
    overallRisk: RiskLevelType;
    riskColor: string;
    warnings: AnalysisWarning[];
    recommendations: AnalysisRecommendation[];
    summary: string;
    error?: string;

    // Enhanced fields for multi-statement analysis
    /** Total number of statements detected */
    statementCount?: number;
    /** Breakdown of operations by count */
    operationCounts?: OperationCount[];
    /** Detailed per-statement analysis */
    statementDetails?: StatementDetail[];
    /** Risk breakdown by level */
    riskBreakdown?: RiskBreakdown;
    /** Whether this is a multi-statement script */
    isMultiStatement?: boolean;
}

export interface RiskBadge {
    label: string;
    color: string;
    bgColor: string;
    icon: string;
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface IQueryAnalyzer {
    analyze(query: string): QueryAnalysis;
}

