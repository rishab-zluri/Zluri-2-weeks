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

export class MongoAnalyzer implements IQueryAnalyzer {
    public analyze(query: string): QueryAnalysis {
        const trimmedQuery = query.trim();
        const analysis: QueryAnalysis = {
            query: trimmedQuery,
            databaseType: 'mongodb',
            operations: [],
            overallRisk: RiskLevel.SAFE,
            riskColor: RiskColors.safe,
            warnings: [],
            recommendations: [],
            summary: '',
        };

        // Combine all patterns (check most specific first - they are ordered within each category)
        const allPatterns = [
            ...MONGODB_PATTERNS.admin,
            ...MONGODB_PATTERNS.index,
            ...MONGODB_PATTERNS.write,
            ...MONGODB_PATTERNS.read,
            ...MONGODB_PATTERNS.aggregation,
        ];

        // Track matched operations to avoid duplicates
        const matchedOperations = new Set<string>();

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
    }
}
