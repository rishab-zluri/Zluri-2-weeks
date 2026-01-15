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
}

export interface AnalysisWarning {
    level: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    suggestion?: string;
}

export interface AnalysisRecommendation {
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
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
