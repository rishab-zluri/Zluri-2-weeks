/**
 * Query Analysis Service
 *
 * Analyzes SQL and MongoDB queries to determine risk and operation types.
 * 
 * REFACTORING NOTE:
 * This service now uses the Factory Pattern to create analyzers.
 * Logic has been moved to:
 * - services/queryAnalysis/analyzers/PostgresAnalyzer.ts
 * - services/queryAnalysis/analyzers/MongoAnalyzer.ts
 * - services/queryAnalysis/analyzer.factory.ts
 * 
 * This file acts as the Facade.
 */

import { QueryAnalyzerFactory } from './analyzer.factory';
import { QueryAnalysis, RiskLevel, RiskColors, OperationType } from './interfaces';
import { generateSummary, getRiskBadge } from './analyzers/Utils';
import { POSTGRES_PATTERNS } from './analyzers/PostgresAnalyzer';
import { MONGODB_PATTERNS } from './analyzers/MongoAnalyzer';

// Re-export types and constants
export * from './interfaces';
export { generateSummary, getRiskBadge } from './analyzers/Utils';
export { POSTGRES_PATTERNS } from './analyzers/PostgresAnalyzer';
export { MONGODB_PATTERNS } from './analyzers/MongoAnalyzer';

/**
 * Analyze a query for risk and operations
 *
 * @param query - The query string to analyze
 * @param databaseType - 'postgresql' or 'mongodb'
 * @returns Complete analysis result
 */
export function analyzeQuery(query: string, databaseType: string): QueryAnalysis {
    const analyzer = QueryAnalyzerFactory.getAnalyzer(databaseType);
    return analyzer.analyze(query);
}

/**
 * Analyze a PostgreSQL query
 * Alias for backward compatibility
 */
export function analyzePostgresQuery(query: string): QueryAnalysis {
    return analyzeQuery(query, 'postgresql');
}

/**
 * Analyze a MongoDB query
 * Alias for backward compatibility
 */
export function analyzeMongoQuery(query: string): QueryAnalysis {
    return analyzeQuery(query, 'mongodb');
}

// Deprecated aliases if needed, but analyzePostgresQuery is the standard one based on index.ts
export const analyzeSqlQuery = analyzePostgresQuery;

// Default export for backward compatibility
export default {
    analyzeQuery,
    analyzePostgresQuery,
    analyzeMongoQuery,
    analyzeSqlQuery,
    getRiskBadge,
    generateSummary,
};
