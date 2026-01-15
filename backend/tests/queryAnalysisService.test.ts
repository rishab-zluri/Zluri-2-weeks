/**
 * Query Analysis Service Tests
 */

import { jest, describe, it, expect } from '@jest/globals';
import {
  analyzeQuery,
  analyzePostgresQuery,
  analyzeMongoQuery,
  getRiskBadge,
  generateSummary,
  RiskLevel,
  OperationType,
} from '../src/services/queryAnalysis';


describe('Query Analysis Service', () => {
  describe('analyzeQuery', () => {
    it('should return error for null query', () => {
      const result = analyzeQuery(null as any, 'postgresql');
      expect(result.error).toBe('Invalid query');
      expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
    });

    it('should return error for empty query', () => {
      const result = analyzeQuery('', 'postgresql');
      expect(result.error).toBe('Invalid query');
    });

    it('should return error for unsupported database type', () => {
      const result = analyzeQuery('SELECT * FROM users', 'mysql');
      expect(result.error).toContain('Unsupported database type');
    });

    it('should route to PostgreSQL analyzer', () => {
      const result = analyzeQuery('SELECT * FROM users', 'postgresql');
      expect(result.databaseType).toBe('postgresql');
      expect(result.overallRisk).toBe(RiskLevel.SAFE);
    });

    it('should route to MongoDB analyzer', () => {
      const result = analyzeQuery('db.users.find({})', 'mongodb');
      expect(result.databaseType).toBe('mongodb');
      expect(result.overallRisk).toBe(RiskLevel.SAFE);
    });
  });

  describe('PostgreSQL Analysis', () => {
    describe('DDL Operations', () => {
      it('should classify DROP DATABASE as CRITICAL', () => {
        const result = analyzePostgresQuery('DROP DATABASE production_db');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
        expect(result.operations[0].operation).toBe('DROP DATABASE');
        expect(result.operations[0].type).toBe(OperationType.DDL);
      });

      it('should classify DROP TABLE as CRITICAL', () => {
        const result = analyzePostgresQuery('DROP TABLE users');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
        expect(result.operations[0].operation).toBe('DROP TABLE');
      });

      it('should classify TRUNCATE as CRITICAL', () => {
        const result = analyzePostgresQuery('TRUNCATE TABLE orders');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
        expect(result.operations[0].operation).toBe('TRUNCATE');
      });

      it('should classify DROP SCHEMA CASCADE as CRITICAL', () => {
        const result = analyzePostgresQuery('DROP SCHEMA public CASCADE');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
        expect(result.operations[0].operation).toBe('DROP SCHEMA CASCADE');
      });

      it('should classify ALTER TABLE DROP COLUMN as HIGH', () => {
        const result = analyzePostgresQuery('ALTER TABLE users DROP COLUMN legacy_field');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
        expect(result.operations[0].operation).toBe('ALTER TABLE DROP COLUMN');
      });

      it('should classify ALTER COLUMN TYPE as HIGH', () => {
        const result = analyzePostgresQuery('ALTER TABLE users ALTER COLUMN age TYPE bigint');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });

      it('should classify ALTER TABLE RENAME as MEDIUM', () => {
        const result = analyzePostgresQuery('ALTER TABLE users RENAME TO customers');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify CREATE INDEX as MEDIUM', () => {
        const result = analyzePostgresQuery('CREATE INDEX idx_email ON users(email)');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify DROP INDEX as MEDIUM', () => {
        const result = analyzePostgresQuery('DROP INDEX idx_email');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify CREATE TABLE as LOW', () => {
        const result = analyzePostgresQuery('CREATE TABLE new_table (id INT)');
        expect(result.overallRisk).toBe(RiskLevel.LOW);
      });

      it('should classify ALTER TABLE ADD COLUMN as LOW', () => {
        const result = analyzePostgresQuery('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
        expect(result.overallRisk).toBe(RiskLevel.LOW);
      });
    });

    describe('DML Operations', () => {
      it('should classify DELETE without WHERE as CRITICAL', () => {
        const result = analyzePostgresQuery('DELETE FROM users');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].level).toBe('critical');
      });

      it('should classify DELETE with WHERE as HIGH', () => {
        const result = analyzePostgresQuery("DELETE FROM users WHERE status = 'inactive'");
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
        expect(result.operations[0].operation).toBe('DELETE (with WHERE)');
      });

      it('should classify UPDATE without WHERE as CRITICAL', () => {
        const result = analyzePostgresQuery("UPDATE users SET status = 'inactive'");
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
      });

      it('should classify UPDATE with WHERE as HIGH', () => {
        const result = analyzePostgresQuery("UPDATE users SET status = 'active' WHERE id = 1");
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
        expect(result.operations[0].operation).toBe('UPDATE (with WHERE)');
      });

      it('should classify INSERT as MEDIUM', () => {
        const result = analyzePostgresQuery("INSERT INTO users (name) VALUES ('test')");
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify UPSERT as MEDIUM', () => {
        const result = analyzePostgresQuery("INSERT INTO users (id, name) VALUES (1, 'test') ON CONFLICT (id) DO UPDATE SET name = 'test'");
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });
    });

    describe('DQL Operations', () => {
      it('should classify SELECT as SAFE', () => {
        const result = analyzePostgresQuery('SELECT * FROM users WHERE id = 1');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });

      it('should classify SELECT FOR UPDATE as LOW', () => {
        const result = analyzePostgresQuery('SELECT * FROM users WHERE id = 1 FOR UPDATE');
        expect(result.overallRisk).toBe(RiskLevel.LOW);
      });

      it('should classify EXPLAIN as SAFE', () => {
        const result = analyzePostgresQuery('EXPLAIN ANALYZE SELECT * FROM users');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });
    });

    describe('DCL Operations', () => {
      it('should classify GRANT as HIGH', () => {
        const result = analyzePostgresQuery('GRANT SELECT ON users TO readonly_user');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });

      it('should classify REVOKE as HIGH', () => {
        const result = analyzePostgresQuery('REVOKE SELECT ON users FROM readonly_user');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });
    });

    describe('TCL Operations', () => {
      it('should classify COMMIT as LOW', () => {
        const result = analyzePostgresQuery('COMMIT');
        expect(result.overallRisk).toBe(RiskLevel.LOW);
      });

      it('should classify ROLLBACK as LOW', () => {
        const result = analyzePostgresQuery('ROLLBACK');
        expect(result.overallRisk).toBe(RiskLevel.LOW);
      });
    });

    describe('Warnings', () => {
      it('should warn about CASCADE', () => {
        const result = analyzePostgresQuery('DROP SCHEMA public CASCADE');
        const cascadeWarning = result.warnings.find((w: { message: string }) => w.message.includes('CASCADE'));
        expect(cascadeWarning).toBeDefined();
      });

      it('should warn about multiple statements', () => {
        const result = analyzePostgresQuery('SELECT 1; SELECT 2; SELECT 3');
        const multiWarning = result.warnings.find((w: { message: string }) => w.message.includes('Multiple statements'));
        expect(multiWarning).toBeDefined();
      });

      it('should warn about SELECT without LIMIT', () => {
        const result = analyzePostgresQuery('SELECT * FROM users');
        const limitWarning = result.warnings.find((w: { message: string }) => w.message.includes('LIMIT'));
        expect(limitWarning).toBeDefined();
      });
    });

    describe('Unknown queries', () => {
      it('should mark unrecognized queries as UNKNOWN with MEDIUM risk', () => {
        const result = analyzePostgresQuery('VACUUM ANALYZE users');
        expect(result.operations[0].operation).toBe('UNKNOWN');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });
    });
  });

  describe('MongoDB Analysis', () => {
    describe('Admin Operations', () => {
      it('should classify dropDatabase as CRITICAL', () => {
        const result = analyzeMongoQuery('db.dropDatabase()');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
        expect(result.operations[0].operation).toBe('dropDatabase');
      });

      it('should classify drop collection as CRITICAL', () => {
        const result = analyzeMongoQuery('db.users.drop()');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
      });

      it('should classify renameCollection as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.renameCollection("customers")');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });
    });

    describe('Write Operations', () => {
      it('should classify deleteMany with empty filter as CRITICAL', () => {
        const result = analyzeMongoQuery('db.users.deleteMany({})');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('should classify deleteMany with filter as HIGH', () => {
        const result = analyzeMongoQuery('db.users.deleteMany({ status: "inactive" })');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });

      it('should classify deleteOne as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.deleteOne({ _id: ObjectId("123") })');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify updateMany with empty filter as CRITICAL', () => {
        const result = analyzeMongoQuery('db.users.updateMany({}, { $set: { active: false } })');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
      });

      it('should classify updateMany with filter as HIGH', () => {
        const result = analyzeMongoQuery('db.users.updateMany({ status: "old" }, { $set: { archived: true } })');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });

      it('should classify updateOne as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.updateOne({ _id: 1 }, { $set: { name: "test" } })');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify insertOne as LOW', () => {
        const result = analyzeMongoQuery('db.users.insertOne({ name: "test" })');
        expect(result.overallRisk).toBe(RiskLevel.LOW);
      });

      it('should classify insertMany as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.insertMany([{ name: "a" }, { name: "b" }])');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify bulkWrite as HIGH', () => {
        const result = analyzeMongoQuery('db.users.bulkWrite([{ insertOne: { document: { name: "test" } } }])');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });

      it('should classify replaceOne as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.replaceOne({ _id: 1 }, { name: "new" })');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify findOneAndDelete as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.findOneAndDelete({ _id: 1 })');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify findOneAndUpdate as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.findOneAndUpdate({ _id: 1 }, { $set: { name: "test" } })');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify findOneAndReplace as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.findOneAndReplace({ _id: 1 }, { name: "new" })');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify remove with empty filter as CRITICAL', () => {
        const result = analyzeMongoQuery('db.users.remove({})');
        expect(result.overallRisk).toBe(RiskLevel.CRITICAL);
      });
    });

    describe('Read Operations', () => {
      it('should classify find as SAFE', () => {
        const result = analyzeMongoQuery('db.users.find({ status: "active" })');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });

      it('should classify findOne as SAFE', () => {
        const result = analyzeMongoQuery('db.users.findOne({ _id: 1 })');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });

      it('should classify countDocuments as SAFE', () => {
        const result = analyzeMongoQuery('db.users.countDocuments({ status: "active" })');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });

      it('should classify estimatedDocumentCount as SAFE', () => {
        const result = analyzeMongoQuery('db.users.estimatedDocumentCount()');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });

      it('should classify distinct as SAFE', () => {
        const result = analyzeMongoQuery('db.users.distinct("status")');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });
    });

    describe('Index Operations', () => {
      it('should classify createIndex as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.createIndex({ email: 1 })');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify dropIndex as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.dropIndex("email_1")');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });

      it('should classify dropIndexes as HIGH', () => {
        const result = analyzeMongoQuery('db.users.dropIndexes()');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });

      it('should classify reIndex as MEDIUM', () => {
        const result = analyzeMongoQuery('db.users.reIndex()');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });
    });

    describe('Aggregation Operations', () => {
      it('should classify aggregate as SAFE', () => {
        const result = analyzeMongoQuery('db.users.aggregate([{ $match: { status: "active" } }])');
        expect(result.overallRisk).toBe(RiskLevel.SAFE);
      });

      it('should classify aggregate with $out as HIGH', () => {
        const result = analyzeMongoQuery('db.users.aggregate([{ $match: {} }, { $out: "users_backup" }])');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });

      it('should classify aggregate with $merge as HIGH', () => {
        const result = analyzeMongoQuery('db.users.aggregate([{ $match: {} }, { $merge: { into: "users_merged" } }])');
        expect(result.overallRisk).toBe(RiskLevel.HIGH);
      });
    });

    describe('Warnings', () => {
      it('should warn about empty filter in deleteMany', () => {
        const result = analyzeMongoQuery('db.users.deleteMany({})');
        const emptyFilterWarning = result.warnings.find((w: { message: string }) => w.message.includes('Empty filter'));
        expect(emptyFilterWarning).toBeDefined();
      });

      it('should warn about $out', () => {
        const result = analyzeMongoQuery('db.users.aggregate([{ $out: "backup" }])');
        const outWarning = result.warnings.find((w: { message: string }) => w.message.includes('$out'));
        expect(outWarning).toBeDefined();
      });

      it('should warn about find without limit', () => {
        const result = analyzeMongoQuery('db.users.find({})');
        const limitWarning = result.warnings.find((w: { message: string }) => w.message.includes('limit'));
        expect(limitWarning).toBeDefined();
      });

      it('should warn about $where', () => {
        const result = analyzeMongoQuery('db.users.find({ $where: "this.age > 18" })');
        const whereWarning = result.warnings.find((w: { message: string }) => w.message.includes('$where'));
        expect(whereWarning).toBeDefined();
      });
    });

    describe('Unknown queries', () => {
      it('should mark unrecognized MongoDB queries as UNKNOWN with MEDIUM risk', () => {
        const result = analyzeMongoQuery('some random text that is not a valid mongo query');
        expect(result.operations[0].operation).toBe('UNKNOWN');
        expect(result.overallRisk).toBe(RiskLevel.MEDIUM);
      });
    });

    describe('Duplicate operation handling', () => {
      it('should not add duplicate operations for queries matching multiple patterns', () => {
        // This query matches both deleteMany (empty filter) and deleteMany patterns
        // They have different operation names so both should be added
        const result = analyzeMongoQuery('db.users.deleteMany({})');
        // The empty filter pattern has a different operation name, so we expect 2 operations
        // This tests that the duplicate check works (same operation name won't be added twice)
        expect(result.operations.length).toBeGreaterThanOrEqual(1);

        // Test with a query that could match the same pattern twice (if patterns were duplicated)
        // The Set ensures no duplicates of the same operation name
        const result2 = analyzeMongoQuery('db.users.find({})');
        const findOps = result2.operations.filter((o: { operation: string }) => o.operation === 'find');
        expect(findOps.length).toBe(1);
      });
    });
  });

  describe('getRiskBadge', () => {
    it('should return correct badge for CRITICAL', () => {
      const badge = getRiskBadge(RiskLevel.CRITICAL);
      expect(badge.label).toBe('CRITICAL');
      expect(badge.icon).toBe('🛑');
    });

    it('should return correct badge for HIGH', () => {
      const badge = getRiskBadge(RiskLevel.HIGH);
      expect(badge.label).toBe('HIGH');
      expect(badge.icon).toBe('⚠️');
    });

    it('should return correct badge for MEDIUM', () => {
      const badge = getRiskBadge(RiskLevel.MEDIUM);
      expect(badge.label).toBe('MEDIUM');
      expect(badge.icon).toBe('⚠️');
    });

    it('should return correct badge for LOW', () => {
      const badge = getRiskBadge(RiskLevel.LOW);
      expect(badge.label).toBe('LOW');
      expect(badge.icon).toBe('ℹ️');
    });

    it('should return correct badge for SAFE', () => {
      const badge = getRiskBadge(RiskLevel.SAFE);
      expect(badge.label).toBe('SAFE');
      expect(badge.icon).toBe('✅');
    });

    it('should return UNKNOWN badge for unknown risk level', () => {
      const badge = getRiskBadge('unknown' as any);
      expect(badge.label).toBe('UNKNOWN');
    });
  });

  describe('Recommendations', () => {
    it('should recommend backup for CRITICAL operations', () => {
      const result = analyzePostgresQuery('DROP TABLE users');
      const backupRec = result.recommendations.find((r: { action: string }) => r.action.includes('backup'));
      expect(backupRec).toBeDefined();
      expect(backupRec?.priority).toBe('high');
    });

    it('should recommend SELECT first for DELETE', () => {
      const result = analyzePostgresQuery("DELETE FROM users WHERE status = 'inactive'");
      const selectRec = result.recommendations.find((r: { action: string }) => r.action.includes('SELECT'));
      expect(selectRec).toBeDefined();
    });

    it('should recommend notifying teams for DDL', () => {
      const result = analyzePostgresQuery('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
      const notifyRec = result.recommendations.find((r: { action: string }) => r.action.includes('Notify'));
      expect(notifyRec).toBeDefined();
    });

    it('should recommend scheduling for index operations', () => {
      const result = analyzeMongoQuery('db.users.createIndex({ email: 1 })');
      const scheduleRec = result.recommendations.find((r: { action: string }) => r.action.includes('Schedule'));
      expect(scheduleRec).toBeDefined();
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary with risk level', () => {
      const result = analyzePostgresQuery('SELECT * FROM users');
      expect(result.summary).toContain('Safe query');
    });

    it('should generate summary with operation name', () => {
      const result = analyzePostgresQuery('DELETE FROM users WHERE id = 1');
      expect(result.summary).toContain('DELETE');
    });

    it('should generate summary with impact', () => {
      const result = analyzePostgresQuery('DROP TABLE users');
      expect(result.summary).toContain('CRITICAL RISK');
    });

    it('should handle empty operations array in generateSummary', () => {
      // Test generateSummary directly with empty operations
      const analysis = {
        operations: [],
        overallRisk: RiskLevel.MEDIUM,
      } as any;
      const summary = generateSummary(analysis);
      expect(summary).toBe('No operations detected.');
    });
  });
});
