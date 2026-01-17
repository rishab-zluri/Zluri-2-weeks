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
            // More specific: UPDATE without WHERE clause (destructive)
            // Negative lookahead to ensure WHERE is NOT present
            pattern: /^\s*UPDATE\s+\w+\s+SET\s+(?!.*\bWHERE\b).*$/i,
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
            // Less specific: UPDATE with WHERE clause
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
    /**
     * Main analysis entry point - handles both single and multi-statement queries
     */
    public analyze(query: string): QueryAnalysis {
        const trimmedQuery = query.trim();

        // Split content into statements for detailed analysis
        const { statements, lineMapping } = this.splitIntoStatements(trimmedQuery);
        const isMultiStatement = statements.length > 1;

        const analysis: QueryAnalysis = {
            query: trimmedQuery,
            databaseType: 'postgresql',
            operations: [],
            overallRisk: RiskLevel.SAFE,
            riskColor: RiskColors.safe,
            warnings: [],
            recommendations: [],
            summary: '',
            // Enhanced fields
            statementCount: statements.length,
            operationCounts: [],
            statementDetails: [],
            riskBreakdown: { critical: 0, high: 0, medium: 0, low: 0, safe: 0 },
            isMultiStatement,
        };

        // Combine all patterns (check most specific first)
        const allPatterns = [
            ...POSTGRES_PATTERNS.ddl,
            ...POSTGRES_PATTERNS.dml,
            ...POSTGRES_PATTERNS.dcl,
            ...POSTGRES_PATTERNS.tcl,
            ...POSTGRES_PATTERNS.dql,
        ];

        // Track operations with counts and line numbers
        const operationTracker = new Map<string, {
            pattern: QueryPattern;
            count: number;
            lineNumbers: number[];
        }>();

        // Analyze each statement individually
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i].trim();
            if (!stmt || stmt === ';') continue;

            const lineNumber = lineMapping[i];
            let matched = false;

            // Find matching pattern for this statement
            for (const patternDef of allPatterns) {
                // Create a pattern that can match anywhere in the statement
                const flexPattern = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);

                if (flexPattern.test(stmt)) {
                    matched = true;
                    const opName = patternDef.operation;

                    // Track operation counts and line numbers
                    if (operationTracker.has(opName)) {
                        const tracker = operationTracker.get(opName)!;
                        tracker.count++;
                        tracker.lineNumbers.push(lineNumber);
                    } else {
                        operationTracker.set(opName, {
                            pattern: patternDef,
                            count: 1,
                            lineNumbers: [lineNumber],
                        });
                    }

                    // Add statement detail
                    analysis.statementDetails!.push({
                        lineNumber,
                        statement: stmt.length > 100 ? stmt.substring(0, 100) + '...' : stmt,
                        operation: patternDef.operation,
                        risk: patternDef.risk,
                        type: patternDef.type,
                    });

                    // Update risk breakdown
                    analysis.riskBreakdown![patternDef.risk]++;

                    // Check for statement-level warnings
                    this.addStatementWarnings(stmt, patternDef, lineNumber, analysis.warnings);

                    break; // First match wins for this statement
                }
            }

            // Handle unrecognized statements
            if (!matched && stmt.length > 5) {
                analysis.statementDetails!.push({
                    lineNumber,
                    statement: stmt.length > 100 ? stmt.substring(0, 100) + '...' : stmt,
                    operation: 'UNKNOWN',
                    risk: RiskLevel.MEDIUM,
                    type: 'UNKNOWN',
                });
                analysis.riskBreakdown!.medium++;
            }
        }

        // Build operations array with counts
        for (const [opName, tracker] of operationTracker) {
            analysis.operations.push({
                operation: opName,
                type: tracker.pattern.type,
                risk: tracker.pattern.risk,
                description: tracker.pattern.description,
                impact: tracker.pattern.impact,
                count: tracker.count,
                lineNumbers: tracker.lineNumbers,
            });

            // Build operation counts
            analysis.operationCounts!.push({
                operation: opName,
                count: tracker.count,
                risk: tracker.pattern.risk,
                type: tracker.pattern.type,
            });
        }

        // Sort operations by risk level (critical first)
        const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, safe: 4 };
        analysis.operations.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
        analysis.operationCounts!.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

        // Handle case where no operations were matched
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
                count: 1,
            });
        }

        // Calculate overall risk
        analysis.overallRisk = calculateOverallRisk(analysis.operations);
        analysis.riskColor = RiskColors[analysis.overallRisk];

        // Generate additional warnings and recommendations
        analysis.warnings.push(...this.generateGlobalWarnings(trimmedQuery, analysis));
        analysis.recommendations = this.generateRecommendations(trimmedQuery, analysis.operations);

        // Generate enhanced summary
        analysis.summary = this.generateEnhancedSummary(analysis);

        return analysis;
    }

    /**
     * Split query content into individual statements with line number mapping
     */
    private splitIntoStatements(content: string): { statements: string[]; lineMapping: number[] } {
        const statements: string[] = [];
        const lineMapping: number[] = [];

        // Track line numbers for each character position
        const lines = content.split('\n');
        let currentLine = 1;
        let charIndex = 0;
        const positionToLine: number[] = [];

        for (const line of lines) {
            for (let i = 0; i < line.length + 1; i++) { // +1 for newline
                positionToLine[charIndex++] = currentLine;
            }
            currentLine++;
        }

        // Split by semicolon while preserving line info
        let currentStatement = '';
        let statementStartPos = 0;
        let inString = false;
        let stringChar = '';
        let inComment = false;
        let inBlockComment = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1] || '';

            // Handle string detection
            if (!inComment && !inBlockComment && (char === "'" || char === '"') && content[i - 1] !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }

            // Handle line comments
            if (!inString && !inBlockComment && char === '-' && nextChar === '-') {
                inComment = true;
            }
            if (inComment && char === '\n') {
                inComment = false;
            }

            // Handle block comments
            if (!inString && !inComment && char === '/' && nextChar === '*') {
                inBlockComment = true;
            }
            if (inBlockComment && char === '*' && nextChar === '/') {
                inBlockComment = false;
                i++; // Skip the /
                currentStatement += '*/';
                continue;
            }

            currentStatement += char;

            // Statement boundary
            if (!inString && !inComment && !inBlockComment && char === ';') {
                const trimmed = currentStatement.trim();
                if (trimmed && trimmed !== ';') {
                    statements.push(trimmed);
                    lineMapping.push(positionToLine[statementStartPos] || 1);
                }
                currentStatement = '';
                statementStartPos = i + 1;
            }
        }

        // Handle last statement without semicolon
        const lastStmt = currentStatement.trim();
        if (lastStmt) {
            statements.push(lastStmt);
            lineMapping.push(positionToLine[statementStartPos] || 1);
        }

        return { statements, lineMapping };
    }

    /**
     * Add warnings specific to a single statement
     */
    private addStatementWarnings(
        stmt: string,
        pattern: QueryPattern,
        lineNumber: number,
        warnings: AnalysisWarning[]
    ): void {
        // DELETE without WHERE
        if (pattern.operation === 'DELETE (no WHERE)') {
            warnings.push({
                level: 'critical',
                message: `Line ${lineNumber}: DELETE without WHERE clause will remove ALL rows`,
                suggestion: 'Add a WHERE clause to limit affected rows',
                lineNumber,
            });
        }

        // UPDATE without WHERE
        if (pattern.operation === 'UPDATE (no WHERE)') {
            warnings.push({
                level: 'critical',
                message: `Line ${lineNumber}: UPDATE without WHERE clause will modify ALL rows`,
                suggestion: 'Add a WHERE clause to limit affected rows',
                lineNumber,
            });
        }

        // TRUNCATE
        if (pattern.operation === 'TRUNCATE') {
            warnings.push({
                level: 'critical',
                message: `Line ${lineNumber}: TRUNCATE will remove ALL rows instantly and cannot be rolled back`,
                suggestion: 'Ensure you have a backup before executing',
                lineNumber,
            });
        }

        // DROP operations
        if (pattern.operation.startsWith('DROP')) {
            warnings.push({
                level: 'critical',
                message: `Line ${lineNumber}: ${pattern.operation} is irreversible`,
                suggestion: 'Create backup before executing',
                lineNumber,
            });
        }

        // CASCADE
        if (/CASCADE/i.test(stmt)) {
            warnings.push({
                level: 'high',
                message: `Line ${lineNumber}: CASCADE will affect dependent objects`,
                suggestion: 'Review all dependent objects before executing',
                lineNumber,
            });
        }
    }

    /**
     * Generate global warnings that apply to the entire script
     */
    private generateGlobalWarnings(query: string, analysis: QueryAnalysis): AnalysisWarning[] {
        const warnings: AnalysisWarning[] = [];

        // Multi-statement warning
        if (analysis.isMultiStatement && analysis.statementCount! > 3) {
            warnings.push({
                level: 'medium',
                message: `Script contains ${analysis.statementCount} statements`,
                suggestion: 'Consider wrapping in a transaction for atomicity',
            });
        }

        // Mixed risk levels warning
        if (analysis.riskBreakdown!.critical > 0 && analysis.riskBreakdown!.safe > 0) {
            warnings.push({
                level: 'high',
                message: 'Script mixes CRITICAL and SAFE operations',
                suggestion: 'Review critical operations carefully - they may affect data needed by other statements',
            });
        }

        // SELECT without LIMIT (only if primarily SELECT operations)
        const selectOps = analysis.operations.filter(op => op.operation === 'SELECT');
        if (selectOps.length > 0 && selectOps[0].count! > 2 && !/LIMIT/i.test(query)) {
            warnings.push({
                level: 'low',
                message: 'Multiple SELECT statements without LIMIT',
                suggestion: 'Consider adding LIMIT to prevent memory issues',
            });
        }

        return warnings;
    }

    private generateRecommendations(query: string, operations: AnalyzedOperation[]): AnalysisRecommendation[] {
        const recommendations: AnalysisRecommendation[] = [];
        const addedActions = new Set<string>();

        for (const op of operations) {
            if (op.risk === RiskLevel.CRITICAL || op.risk === RiskLevel.HIGH) {
                const backupAction = 'Create backup before executing';
                if (!addedActions.has(backupAction)) {
                    recommendations.push({
                        priority: 'high',
                        action: backupAction,
                        reason: `Contains ${op.count || 1}x ${op.operation} which is ${op.impact.reversible ? 'partially' : 'not'} reversible`,
                    });
                    addedActions.add(backupAction);
                }

                if (op.type === OperationType.DML) {
                    const previewAction = 'Run SELECT with same WHERE clause first';
                    if (!addedActions.has(previewAction)) {
                        recommendations.push({
                            priority: 'high',
                            action: previewAction,
                            reason: 'Verify affected rows before modification',
                        });
                        addedActions.add(previewAction);
                    }
                }
            }

            if (op.type === OperationType.DDL) {
                const notifyAction = 'Notify dependent application teams';
                if (!addedActions.has(notifyAction)) {
                    recommendations.push({
                        priority: 'medium',
                        action: notifyAction,
                        reason: 'Schema changes may require application updates',
                    });
                    addedActions.add(notifyAction);
                }
            }
        }

        // Transaction recommendation for multi-statement
        if (operations.length > 1) {
            const txAction = 'Execute within a transaction';
            if (!addedActions.has(txAction)) {
                recommendations.push({
                    priority: 'medium',
                    action: txAction,
                    reason: 'Allows rollback if any statement fails',
                });
            }
        }

        return recommendations;
    }

    /**
     * Generate enhanced summary with operation breakdown
     */
    private generateEnhancedSummary(analysis: QueryAnalysis): string {
        const parts: string[] = [];

        // Overall risk header
        const riskLabels: Record<string, string> = {
            critical: '🔴 CRITICAL RISK',
            high: '🟠 HIGH RISK',
            medium: '🟡 MEDIUM RISK',
            low: '🔵 LOW RISK',
            safe: '🟢 SAFE',
        };
        parts.push(riskLabels[analysis.overallRisk] || analysis.overallRisk.toUpperCase());

        // Statement count
        if (analysis.isMultiStatement) {
            parts.push(`${analysis.statementCount} statements detected`);
        }

        // Operations breakdown
        if (analysis.operationCounts && analysis.operationCounts.length > 0) {
            const opSummary = analysis.operationCounts
                .slice(0, 5) // Top 5 operations
                .map(op => `${op.count}x ${op.operation}`)
                .join(', ');
            parts.push(`Operations: ${opSummary}`);
        }

        // Risk breakdown
        const riskCounts: string[] = [];
        if (analysis.riskBreakdown!.critical > 0) riskCounts.push(`${analysis.riskBreakdown!.critical} critical`);
        if (analysis.riskBreakdown!.high > 0) riskCounts.push(`${analysis.riskBreakdown!.high} high`);
        if (analysis.riskBreakdown!.medium > 0) riskCounts.push(`${analysis.riskBreakdown!.medium} medium`);

        if (riskCounts.length > 0) {
            parts.push(`Risk breakdown: ${riskCounts.join(', ')}`);
        }

        return parts.join(' | ');
    }
}

