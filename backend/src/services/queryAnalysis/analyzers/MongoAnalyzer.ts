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
 * MongoDB patterns organized by operation category
 */
export const MONGODB_PATTERNS: Record<string, QueryPattern[]> = {
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

    // Aggregation - More specific patterns MUST come first
    aggregation: [
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
    ],
};

export class MongoAnalyzer implements IQueryAnalyzer {
    /**
     * Main analysis entry point - handles both single and multi-statement MongoDB queries
     */
    public analyze(query: string): QueryAnalysis {
        const trimmedQuery = query.trim();

        // Split content into statements for detailed analysis
        const { statements, lineMapping } = this.splitIntoStatements(trimmedQuery);
        const isMultiStatement = statements.length > 1;

        const analysis: QueryAnalysis = {
            query: trimmedQuery,
            databaseType: 'mongodb',
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
            ...MONGODB_PATTERNS.admin,
            ...MONGODB_PATTERNS.index,
            ...MONGODB_PATTERNS.write,
            ...MONGODB_PATTERNS.read,
            ...MONGODB_PATTERNS.aggregation,
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
            if (!stmt) continue;

            const lineNumber = lineMapping[i];
            let matched = false;

            // Find matching pattern for this statement
            for (const patternDef of allPatterns) {
                if (patternDef.pattern.test(stmt)) {
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
     * Split MongoDB query content into individual statements with line number mapping
     * MongoDB statements can be separated by semicolons, newlines with db. prefixes, or method chains
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

        // MongoDB scripts can be split by:
        // 1. Semicolons (traditional)
        // 2. Lines starting with db.
        // For simplicity, we'll split by semicolons and also by lines starting with db.

        let currentStatement = '';
        let statementStartPos = 0;
        let inString = false;
        let stringChar = '';
        let braceDepth = 0;
        let bracketDepth = 0;
        let parenDepth = 0;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            // Handle string detection
            if ((char === "'" || char === '"' || char === '`') && content[i - 1] !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }

            if (!inString) {
                if (char === '{') braceDepth++;
                if (char === '}') braceDepth--;
                if (char === '[') bracketDepth++;
                if (char === ']') bracketDepth--;
                if (char === '(') parenDepth++;
                if (char === ')') parenDepth--;
            }

            currentStatement += char;

            // Statement boundary (semicolon at depth 0 or newline followed by db.)
            const isAtZeroDepth = braceDepth === 0 && bracketDepth === 0 && parenDepth === 0;
            const isSemicolon = !inString && isAtZeroDepth && char === ';';
            const isNewDbStatement = !inString && isAtZeroDepth && char === '\n' &&
                content.substring(i + 1).trimStart().startsWith('db.');

            if (isSemicolon || isNewDbStatement) {
                const trimmed = currentStatement.trim().replace(/;$/, '').trim();
                if (trimmed && trimmed.length > 2) {
                    statements.push(trimmed);
                    lineMapping.push(positionToLine[statementStartPos] || 1);
                }
                currentStatement = '';
                statementStartPos = i + 1;
            }
        }

        // Handle last statement
        const lastStmt = currentStatement.trim().replace(/;$/, '').trim();
        if (lastStmt && lastStmt.length > 2) {
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
        // Empty filter in destructive operations
        if ((pattern.operation.includes('delete') || pattern.operation.includes('update')) &&
            /\(\s*\{\s*\}\s*[,)]/i.test(stmt)) {
            warnings.push({
                level: 'critical',
                message: `Line ${lineNumber}: Empty filter {} will affect ALL documents`,
                suggestion: 'Add filter criteria to limit affected documents',
                lineNumber,
            });
        }

        // dropDatabase
        if (pattern.operation === 'dropDatabase') {
            warnings.push({
                level: 'critical',
                message: `Line ${lineNumber}: dropDatabase will delete the ENTIRE database`,
                suggestion: 'Ensure you have a full backup before executing',
                lineNumber,
            });
        }

        // drop collection
        if (pattern.operation === 'drop collection') {
            warnings.push({
                level: 'critical',
                message: `Line ${lineNumber}: drop() will delete the entire collection`,
                suggestion: 'Create backup of collection data first',
                lineNumber,
            });
        }

        // $out in aggregation
        if (/\$out/i.test(stmt)) {
            warnings.push({
                level: 'high',
                message: `Line ${lineNumber}: $out will replace entire target collection`,
                suggestion: 'Ensure target collection can be safely replaced',
                lineNumber,
            });
        }

        // $where (JavaScript execution)
        if (/\$where/i.test(stmt)) {
            warnings.push({
                level: 'high',
                message: `Line ${lineNumber}: $where executes JavaScript - security risk`,
                suggestion: 'Use standard query operators instead',
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
                message: `Script contains ${analysis.statementCount} operations`,
                suggestion: 'Consider using transactions for atomicity (replica set required)',
            });
        }

        // Mixed risk levels warning
        if (analysis.riskBreakdown!.critical > 0 && analysis.riskBreakdown!.safe > 0) {
            warnings.push({
                level: 'high',
                message: 'Script mixes CRITICAL and SAFE operations',
                suggestion: 'Review critical operations carefully',
            });
        }

        // find without limit (only for multiple finds)
        const findOps = analysis.operations.filter(op => op.operation === 'find');
        if (findOps.length > 0 && findOps[0].count! > 2 && !/\.limit\s*\(/i.test(query)) {
            warnings.push({
                level: 'low',
                message: 'Multiple find() without limit()',
                suggestion: 'Consider adding .limit() for large collections',
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

                if (op.type === OperationType.CRUD_WRITE && op.operation.includes('delete')) {
                    const previewAction = 'Run find() with same filter first';
                    if (!addedActions.has(previewAction)) {
                        recommendations.push({
                            priority: 'high',
                            action: previewAction,
                            reason: 'Verify affected documents before deletion',
                        });
                        addedActions.add(previewAction);
                    }
                }
            }

            if (op.type === OperationType.INDEX) {
                const scheduleAction = 'Schedule during low-traffic period';
                if (!addedActions.has(scheduleAction)) {
                    recommendations.push({
                        priority: 'medium',
                        action: scheduleAction,
                        reason: 'Index operations may impact performance',
                    });
                    addedActions.add(scheduleAction);
                }
            }
        }

        // Transaction recommendation for multi-statement writes
        const writeOps = operations.filter(op =>
            op.type === OperationType.CRUD_WRITE || op.type === OperationType.ADMIN
        );
        if (writeOps.length > 1) {
            const txAction = 'Use transactions for atomicity';
            if (!addedActions.has(txAction)) {
                recommendations.push({
                    priority: 'medium',
                    action: txAction,
                    reason: 'Requires replica set - allows rollback if any operation fails',
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
            parts.push(`${analysis.statementCount} operations detected`);
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

