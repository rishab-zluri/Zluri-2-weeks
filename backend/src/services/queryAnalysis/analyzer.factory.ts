import { IQueryAnalyzer } from './interfaces';
import { PostgresAnalyzer } from './analyzers/PostgresAnalyzer';
import { MongoAnalyzer } from './analyzers/MongoAnalyzer';

/**
 * Factory for creating query analyzers based on database type
 */
export class QueryAnalyzerFactory {
    /**
     * Get appropriate analyzer for the database type
     * 
     * @param databaseType - 'postgresql' or 'mongodb'
     * @returns IQueryAnalyzer implementation
     */
    public static getAnalyzer(databaseType: string): IQueryAnalyzer {
        switch (databaseType.toLowerCase()) {
            case 'postgresql':
            case 'postgres':
                return new PostgresAnalyzer();
            case 'mongodb':
            case 'mongo':
                return new MongoAnalyzer();
            default:
                throw new Error(`Unsupported database type for analysis: ${databaseType}`);
        }
    }
}
