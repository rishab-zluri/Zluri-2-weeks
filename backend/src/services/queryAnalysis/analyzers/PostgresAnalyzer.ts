import {
    IQueryAnalyzer,
    QueryAnalysis,
    RiskLevel,
    RiskColors,
    OperationType,
    QueryPattern,
    AnalyzedOperation,
    AnalysisWarning,
    AnalysisRecommendation
} from '../interfaces';
import { calculateOverallRisk, generateSummary } from './Utils';

/**
 * PostgreSQL patterns organized by operation category
 * Order matters: more specific patterns must come before generic ones
 */
export const POSTGRES_PATTERNS: Record<string, QueryPattern[]> = {
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

    // DQL - Data Query Language (more specific patterns first)
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

export class PostgresAnalyzer implements IQueryAnalyzer {
    public analyze(query: string): QueryAnalysis {
        const trimmedQuery = query.trim();
        const analysis: QueryAnalysis = {
            query: trimmedQuery,
            databaseType: 'postgresql',
            operations: [],
            overallRisk: RiskLevel.SAFE,
            riskColor: RiskColors.safe,
            warnings: [],
            recommendations: [],
            summary: '',
        };

        // Combine all patterns (check most specific first)
        const allPatterns = [
            ...POSTGRES_PATTERNS.ddl,
            ...POSTGRES_PATTERNS.dml,
            ...POSTGRES_PATTERNS.dcl,
            ...POSTGRES_PATTERNS.tcl,
            ...POSTGRES_PATTERNS.dql,
        ];

        // Track matched operations to avoid duplicates
        const matchedOperations = new Set<string>();

        // Check against all patterns
        for (const patternDef of allPatterns) {
            if (patternDef.pattern.test(trimmedQuery)) {
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

        // Calculate overall risk
        analysis.overallRisk = calculateOverallRisk(analysis.operations);
        analysis.riskColor = RiskColors[analysis.overallRisk];

        // Generate warnings and recommendations
        analysis.warnings = this.generateWarnings(trimmedQuery, analysis.operations);
        analysis.recommendations = this.generateRecommendations(trimmedQuery, analysis.operations);
        analysis.summary = generateSummary(analysis);

        return analysis;
    }

    private generateWarnings(query: string, operations: AnalyzedOperation[]): AnalysisWarning[] {
        const warnings: AnalysisWarning[] = [];

        // Check for missing WHERE clause in DELETE
        if (/DELETE\s+FROM\s+\w+\s*(?:;|\s*$)/i.test(query)) {
            warnings.push({
                level: 'critical',
                message: 'DELETE without WHERE clause will remove ALL rows',
                suggestion: 'Add a WHERE clause to limit affected rows',
            });
        }

        // Check for missing WHERE clause in UPDATE
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
    }

    private generateRecommendations(query: string, operations: AnalyzedOperation[]): AnalysisRecommendation[] {
        const recommendations: AnalysisRecommendation[] = [];

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
    }
}
