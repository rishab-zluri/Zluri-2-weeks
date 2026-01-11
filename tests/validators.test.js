/**
 * Validators Utility Tests
 */

const {
  sanitizeString,
  isValidEmail,
  validatePassword,
  isValidUUID,
  isValidDatabaseType,
  isValidSubmissionType,
  isValidStatus,
  sanitizeQuery,
  checkQuerySafety,
  isValidFileExtension,
  parsePagination,
} = require('../src/utils/validators');

describe('Validators Utility', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove angle brackets', () => {
      expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require minimum length', () => {
      const result = validatePassword('Pass1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringMatching(/at least 8 characters/));
    });

    it('should require uppercase letter', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringMatching(/uppercase/));
    });

    it('should require lowercase letter', () => {
      const result = validatePassword('PASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringMatching(/lowercase/));
    });

    it('should require number', () => {
      const result = validatePassword('PasswordABC');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringMatching(/number/));
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('isValidDatabaseType', () => {
    it('should validate postgresql', () => {
      expect(isValidDatabaseType('postgresql')).toBe(true);
      expect(isValidDatabaseType('PostgreSQL')).toBe(true);
    });

    it('should validate mongodb', () => {
      expect(isValidDatabaseType('mongodb')).toBe(true);
      expect(isValidDatabaseType('MongoDB')).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(isValidDatabaseType('mysql')).toBe(false);
      expect(isValidDatabaseType('sqlite')).toBe(false);
    });
  });

  describe('isValidSubmissionType', () => {
    it('should validate query type', () => {
      expect(isValidSubmissionType('query')).toBe(true);
      expect(isValidSubmissionType('Query')).toBe(true);
    });

    it('should validate script type', () => {
      expect(isValidSubmissionType('script')).toBe(true);
      expect(isValidSubmissionType('Script')).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(isValidSubmissionType('file')).toBe(false);
      expect(isValidSubmissionType('command')).toBe(false);
    });
  });

  describe('isValidStatus', () => {
    it('should validate all status values', () => {
      expect(isValidStatus('pending')).toBe(true);
      expect(isValidStatus('approved')).toBe(true);
      expect(isValidStatus('rejected')).toBe(true);
      expect(isValidStatus('executing')).toBe(true);
      expect(isValidStatus('completed')).toBe(true);
      expect(isValidStatus('failed')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isValidStatus('PENDING')).toBe(true);
      expect(isValidStatus('Approved')).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(isValidStatus('unknown')).toBe(false);
      expect(isValidStatus('processing')).toBe(false);
    });
  });

  describe('sanitizeQuery', () => {
    it('should remove SQL comments', () => {
      expect(sanitizeQuery('SELECT * FROM users -- comment')).toBe('SELECT * FROM users');
      expect(sanitizeQuery('SELECT /* comment */ * FROM users')).toBe('SELECT  * FROM users');
    });

    it('should trim whitespace', () => {
      expect(sanitizeQuery('  SELECT * FROM users  ')).toBe('SELECT * FROM users');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeQuery(null)).toBe('');
      expect(sanitizeQuery(123)).toBe('');
    });
  });

  describe('checkQuerySafety', () => {
    it('should detect DROP statements', () => {
      const result = checkQuerySafety('DROP TABLE users');
      expect(result.hasDangerousPatterns).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringMatching(/DROP/));
    });

    it('should detect TRUNCATE statements', () => {
      const result = checkQuerySafety('TRUNCATE TABLE users');
      expect(result.hasDangerousPatterns).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringMatching(/TRUNCATE/));
    });

    it('should detect DELETE without WHERE', () => {
      const result = checkQuerySafety('DELETE FROM users');
      expect(result.hasDangerousPatterns).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringMatching(/DELETE.*WHERE/));
    });

    it('should detect UPDATE without WHERE', () => {
      const result = checkQuerySafety('UPDATE users SET status = 1');
      expect(result.hasDangerousPatterns).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringMatching(/UPDATE.*WHERE/));
    });

    it('should not flag safe DELETE with WHERE', () => {
      const result = checkQuerySafety('DELETE FROM users WHERE id = 1');
      expect(result.warnings.some(w => w.includes('DELETE'))).toBe(false);
    });

    it('should not flag safe UPDATE with WHERE', () => {
      const result = checkQuerySafety('UPDATE users SET status = 1 WHERE id = 1');
      expect(result.warnings.some(w => w.includes('UPDATE'))).toBe(false);
    });

    it('should pass safe SELECT queries', () => {
      const result = checkQuerySafety('SELECT * FROM users WHERE id = 1');
      expect(result.hasDangerousPatterns).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('isValidFileExtension', () => {
    it('should validate .js files', () => {
      expect(isValidFileExtension('script.js')).toBe(true);
      expect(isValidFileExtension('migration.JS')).toBe(true);
    });

    it('should validate .py files', () => {
      expect(isValidFileExtension('script.py')).toBe(true);
    });

    it('should reject invalid extensions', () => {
      expect(isValidFileExtension('script.sh')).toBe(false);
      expect(isValidFileExtension('script.exe')).toBe(false);
      expect(isValidFileExtension('script.txt')).toBe(false);
    });

    it('should use custom allowed extensions', () => {
      expect(isValidFileExtension('script.sh', ['.sh', '.bash'])).toBe(true);
    });
  });

  describe('parsePagination', () => {
    it('should return default pagination', () => {
      const result = parsePagination({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should parse page and limit', () => {
      const result = parsePagination({ page: '2', limit: '20' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(20);
    });

    it('should enforce minimum page of 1', () => {
      const result = parsePagination({ page: '0' });
      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit of 100', () => {
      const result = parsePagination({ limit: '200' });
      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const result = parsePagination({ limit: '-5' });
      expect(result.limit).toBe(1);
    });
  });
});
