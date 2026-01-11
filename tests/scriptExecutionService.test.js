/**
 * Tests for Sandboxed Script Execution Service
 * 
 * These tests verify that the sandbox properly:
 * 1. Allows legitimate database operations
 * 2. Blocks dangerous operations
 * 3. Enforces timeouts
 * 4. Captures output correctly
 */

// Mock staticData BEFORE requiring the service
jest.mock('../src/config/staticData', () => ({
  getInstanceById: jest.fn((id) => {
    if (id === 'test-pg' || id === 'database-1') {
      return {
        id: id,
        name: 'Test PostgreSQL',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'test_user',
        password: 'test_password',
      };
    }
    if (id === 'test-mongo' || id === 'mongo-zluri-1') {
      return {
        id: id,
        name: 'Test MongoDB',
        type: 'mongodb',
        uri: 'mongodb://localhost:27017',
      };
    }
    return null;
  }),
  getPods: jest.fn(() => []),
  getDatabasesByInstanceId: jest.fn(() => ['test_db']),
  getInstances: jest.fn(() => []),
}));

// Mock pg Client
const mockPgQuery = jest.fn().mockResolvedValue({ rows: [{ result: 'test' }], rowCount: 1 });
jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    query: mockPgQuery,
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock MongoDB
jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    db: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
          limit: jest.fn().mockReturnThis(),
        }),
        findOne: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { executeScript, validateScript } = require('../src/services/scriptExecutionService');

describe('Script Execution Service', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPgQuery.mockResolvedValue({ rows: [{ result: 'test' }], rowCount: 1 });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALLOWED OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Allowed Operations', () => {
    
    test('should allow basic JavaScript operations', async () => {
      const script = `
        const data = [1, 2, 3, 4, 5];
        const sum = data.reduce((a, b) => a + b, 0);
        console.log('Sum:', sum);
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
      expect(result.output.some(o => o.message && o.message.includes('15'))).toBe(true);
    });
    
    test('should allow console.log and capture output', async () => {
      const script = `
        console.log('Hello');
        console.log('World');
        console.log({ key: 'value' });
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
      expect(result.output.length).toBeGreaterThan(0);
      expect(result.output.some(o => o.message && o.message.includes('Hello'))).toBe(true);
    });
    
    test('should allow async/await', async () => {
      const script = `
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        await delay(100);
        console.log('After delay');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
      expect(result.output.some(o => o.message && o.message.includes('After delay'))).toBe(true);
    });
    
    test('should allow JSON operations', async () => {
      const script = `
        const obj = { name: 'test', value: 123 };
        const json = JSON.stringify(obj);
        const parsed = JSON.parse(json);
        console.log('Value:', parsed.value);
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
      expect(result.output.some(o => o.message && o.message.includes('123'))).toBe(true);
    });
    
    test('should allow Date operations', async () => {
      const script = `
        const now = new Date();
        console.log('Year:', now.getFullYear());
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
      expect(result.output.some(o => o.message && o.message.includes(String(new Date().getFullYear())))).toBe(true);
    });
    
    test('should allow Math operations', async () => {
      const script = `
        const max = Math.max(1, 5, 3, 2, 4);
        console.log('Max:', max);
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
      expect(result.output.some(o => o.message && o.message.includes('5'))).toBe(true);
    });
    
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCKED OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Blocked Operations', () => {
    
    test('should block require("fs")', async () => {
      const script = `
        const fs = require('fs');
        fs.readFileSync('/etc/passwd');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/require is not defined|require is not a function|not allowed/i);
    });
    
    test('should block require("child_process")', async () => {
      const script = `
        const { exec } = require('child_process');
        exec('ls -la');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/require is not defined|require is not a function|not allowed/i);
    });
    
    test('should block require("http")', async () => {
      const script = `
        const http = require('http');
        http.get('http://evil.com');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/require is not defined|require is not a function|not allowed/i);
    });
    
    test('should block process.env access', async () => {
      const script = `
        console.log(process.env.JWT_SECRET);
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      // Should either error or return undefined (process is blocked)
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/process is not defined|Cannot read|not allowed/i);
    });
    
    test('should block process.exit()', async () => {
      const script = `
        process.exit(0);
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/process is not defined|Cannot read|not allowed/i);
    });
    
    test('should block eval()', async () => {
      const script = `
        eval('console.log("hacked")');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/eval is not defined|eval is not a function|not allowed/i);
    });
    
    test('should block Function constructor', async () => {
      const script = `
        const fn = new Function('return 1');
        fn();
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/Function is not defined|Function is not a constructor|not allowed/i);
    });
    
    test('should block local file requires', async () => {
      const script = `
        const localModule = require('./some-local-file');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
    });
    
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIMEOUT ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Timeout Enforcement', () => {
    
    test('should timeout infinite loops', async () => {
      const script = `
        while(true) {
          // Infinite loop
        }
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message.toLowerCase()).toMatch(/timeout|timed out|exceeded/i);
      expect(result.duration).toBeLessThan(35000); // Should timeout around 30s
    }, 35000);
    
    test('should timeout long-running operations', async () => {
      const script = `
        // Simulate long operation
        const start = Date.now();
        while (Date.now() - start < 60000) {
          // Busy wait for 60 seconds
        }
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.duration).toBeLessThan(35000);
    }, 35000);
    
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SCRIPT VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Script Validation', () => {
    
    test('should detect dangerous patterns', () => {
      const script = `
        require('child_process');
        process.env.SECRET;
        eval('bad code');
      `;
      
      const validation = validateScript(script);
      
      expect(validation.warnings.length).toBeGreaterThan(0);
      // Check warnings contain relevant patterns (flexible matching)
      const warningsStr = validation.warnings.join(' ').toLowerCase();
      expect(warningsStr).toMatch(/child_process|require|process|eval/);
    });
    
    test('should pass clean scripts', () => {
      const script = `
        const data = await db.query('SELECT * FROM users');
        console.log(data);
      `;
      
      const validation = validateScript(script);
      
      expect(validation.warnings.length).toBe(0);
      expect(validation.valid).toBe(true);
    });
    
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Error Handling', () => {
    
    test('should catch script syntax errors', async () => {
      const script = `
        const x = {{{  // Invalid syntax
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    test('should catch runtime errors', async () => {
      const script = `
        const obj = null;
        obj.property;  // Cannot read property of null
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    test('should not expose internal stack traces', async () => {
      const script = `
        throw new Error('Test error');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Test error');
      expect(result.error.stack).toBeUndefined();  // No stack trace exposed
    });
    
    test('should handle missing instanceId', async () => {
      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'non-existent-instance',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Instance not found');
    });
    
    test('should handle empty script', async () => {
      const result = await executeScript({
        scriptContent: '',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
    });
    
    test('should handle null script', async () => {
      const result = await executeScript({
        scriptContent: null,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(false);
    });
    
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Database Operations', () => {
    
    test('should execute PostgreSQL query through db wrapper', async () => {
      const script = `
        const result = await db.query('SELECT NOW()');
        console.log('Query executed, rows:', result.rowCount);
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
    });
    
    test('should work with MongoDB', async () => {
      const script = `
        console.log('MongoDB script executed');
      `;
      
      const result = await executeScript({
        scriptContent: script,
        databaseType: 'mongodb',
        instanceId: 'test-mongo',
        databaseName: 'test_db',
      });
      
      expect(result.success).toBe(true);
    });
    
  });
  
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE SCRIPTS FOR DOCUMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

const exampleScripts = {
  
  // Example 1: Simple PostgreSQL query
  postgresQuery: `
    // Query users table
    const result = await db.query('SELECT id, name, email FROM users LIMIT 10');
    console.log('Found users:', result.rowCount);
    
    // Process results
    result.rows.forEach(user => {
      console.log(\`User: \${user.name} (\${user.email})\`);
    });
  `,
  
  // Example 2: Data cleanup
  dataCleanup: `
    // Find and log duplicate emails
    const result = await db.query(\`
      SELECT email, COUNT(*) as count
      FROM users
      GROUP BY email
      HAVING COUNT(*) > 1
    \`);
    
    console.log('Duplicate emails found:', result.rowCount);
  `,
  
};

module.exports = { exampleScripts };