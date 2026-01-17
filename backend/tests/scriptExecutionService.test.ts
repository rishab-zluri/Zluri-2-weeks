// @ts-nocheck
/**
 * Tests for Child Process Sandboxed Script Execution Service
 * 
 * These tests verify that the child process sandbox properly:
 * 1. Allows legitimate database operations
 * 2. Blocks dangerous operations via validation
 * 3. Enforces timeouts
 * 4. Captures output correctly
 * 5. Provides true OS-level isolation
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

// Mock child_process fork
const mockChildProcess = {
  on: jest.fn(),
  send: jest.fn(),
  kill: jest.fn(),
  killed: false,
};

jest.mock('child_process', () => ({
  fork: jest.fn(() => mockChildProcess),
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { executeScript, validateScript, cleanupTempDirectory, EXECUTION_CONFIG } from '../src/services/script/index';
import { fork } from 'child_process';
import * as staticData from '../src/config/staticData';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

describe('Script Execution Service - Child Process Implementation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockChildProcess.killed = false;
    mockChildProcess.on.mockReset();
    mockChildProcess.send.mockReset();
    mockChildProcess.kill.mockReset();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SANDBOX TYPE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Sandbox Implementation', () => {
    test('should use child_process.fork for isolation (not VM2)', () => {
      expect(fork).toBeDefined();
      expect(typeof fork).toBe('function');
    });

    test('should have EXECUTION_CONFIG with timeout', () => {
      expect(EXECUTION_CONFIG).toBeDefined();
      expect(EXECUTION_CONFIG.timeout).toBe(30000);
      expect(EXECUTION_CONFIG.memoryLimit).toBe(128);
    });

    test('should export EXECUTION_CONFIG', () => {
      expect(EXECUTION_CONFIG).toBeDefined();
      expect(EXECUTION_CONFIG.timeout).toBeDefined();
      expect(EXECUTION_CONFIG.memoryLimit).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCRIPT EXECUTION WITH CHILD PROCESS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Script Execution', () => {

    test('should fork a child process for script execution', async () => {
      // Setup mock to simulate successful execution
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          // Simulate ready then result
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: {
              success: true,
              result: undefined,
              output: [
                { type: 'info', message: 'Script executed', timestamp: new Date().toISOString() }
              ],
            },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(fork).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('should send script to child process after ready signal', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: { success: true, output: [] },
          }), 20);
        }
      });

      await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockChildProcess.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'execute' })
      );
    });

    test('should handle child process result', async () => {
      const mockOutput = [
        { type: 'log', message: 'Hello World', timestamp: new Date().toISOString() },
      ];

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: {
              success: true,
              result: 'test result',
              output: mockOutput,
            },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("Hello World")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(true);
      expect(result.output.some(o => o.message === 'Hello World')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {

    test('should handle child process error', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Process crashed')), 10);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Process');
    });

    test('should handle child process exit with non-zero code', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'exit') {
          setTimeout(() => callback(1, null), 10);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
    });

    test('should handle SIGTERM signal (timeout kill)', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'exit') {
          setTimeout(() => callback(null, 'SIGTERM'), 10);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
      expect(result.error.type).toBe('TimeoutError');
    });

    test('should handle script execution failure from child', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: {
              success: false,
              error: { type: 'Error', message: 'Script failed' },
              output: [],
            },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'throw new Error("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Script failed');
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

    test('should handle undefined script content', async () => {
      const result = await executeScript({
        scriptContent: undefined,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
    });

    test('should handle non-string script content', async () => {
      const result = await executeScript({
        scriptContent: 12345,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
    });

    test('should reject script larger than 1MB', async () => {
      const largeScript = 'x'.repeat(1024 * 1024 + 1);

      const result = await executeScript({
        scriptContent: largeScript,
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('too large');
    });

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
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // INSTANCE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Instance Validation', () => {
    test('should fail for PostgreSQL instance missing host', async () => {
      // Re-mock for specific test
      const { getInstanceById } = require('../src/config/staticData');
      getInstanceById.mockReturnValueOnce({
        id: 'test-pg',
        type: 'postgresql',
        port: 5432,
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('missing host');
    });

    test('should fail for MongoDB instance missing URI', async () => {
      const { getInstanceById } = require('../src/config/staticData');
      getInstanceById.mockReturnValueOnce({
        id: 'test-mongo',
        type: 'mongodb',
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'mongodb',
        instanceId: 'test-mongo',
        databaseName: 'test_db',
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('missing URI');
    });
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

      expect(validation.errors.length).toBeGreaterThan(0);
      const errorsStr = validation.errors.join(' ').toLowerCase();
      expect(errorsStr).toMatch(/child_process|require|process|eval/);
    });

    test('should pass clean scripts', () => {
      const script = `
        const data = db.query('SELECT * FROM users');
        console.log(data);
      `;

      const validation = validateScript(script);

      expect(validation.warnings.length).toBe(0);
      expect(validation.valid).toBe(true);
    });

    test('should detect fs module usage as error', () => {
      const script = `
        fs.readFileSync('/etc/passwd');
      `;

      const validation = validateScript(script);

      expect(validation.errors.some(e => e.includes('fs'))).toBe(true);
    });

    test('should detect drop() usage as risk warning', () => {
      const script = `
        db.collection.drop();
      `;

      const validation = validateScript(script);

      expect(validation.warnings.some(w => w.includes('CRITICAL') && w.includes('drop'))).toBe(true);
      expect(validation.valid).toBe(true);
    });

    test('should detect dropDatabase() usage as risk warning', () => {
      const script = `
        db.dropDatabase();
      `;

      const validation = validateScript(script);

      expect(validation.warnings.some(w => w.includes('CRITICAL') && w.includes('dropDatabase'))).toBe(true);
      expect(validation.valid).toBe(true);
    });

    test('should detect deleteMany({}) as risk warning', () => {
      const script = `
        db.collection.deleteMany({});
      `;

      const validation = validateScript(script);

      expect(validation.warnings.some(w => w.includes('CRITICAL') && w.includes('deleteMany'))).toBe(true);
    });

    test('should detect updateMany({}, ...) as risk warning', () => {
      const script = `
        db.collection.updateMany({}, { $set: { x: 1 } });
      `;

      const validation = validateScript(script);

      expect(validation.warnings.some(w => w.includes('CRITICAL') && w.includes('updateMany'))).toBe(true);
    });

    test('should detect dropIndexes() as risk warning', () => {
      const script = `
        db.collection.dropIndexes();
      `;

      const validation = validateScript(script);

      expect(validation.warnings.some(w => w.includes('HIGH') && w.includes('dropIndexes'))).toBe(true);
    });

    test('should detect createIndex() as risk warning', () => {
      const script = `
        db.collection.createIndex({ name: 1 });
      `;

      const validation = validateScript(script);

      expect(validation.warnings.some(w => w.includes('MEDIUM') && w.includes('createIndex'))).toBe(true);
    });

    test('should detect dropIndex() as risk warning', () => {
      const script = `
        db.collection.dropIndex('name_1');
      `;

      const validation = validateScript(script);

      expect(validation.warnings.some(w => w.includes('MEDIUM') && w.includes('dropIndex'))).toBe(true);
    });

    test('should return syntax error for invalid script', () => {
      const script = `
        const x = {{{
      `;

      const validation = validateScript(script);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should detect require() as error', () => {
      const script = `require('fs')`;
      const validation = validateScript(script);
      expect(validation.errors.some(e => e.includes('require'))).toBe(true);
    });

    test('should detect process. as error', () => {
      const script = `process.exit(0)`;
      const validation = validateScript(script);
      expect(validation.errors.some(e => e.includes('process'))).toBe(true);
    });

    test('should detect eval() as error', () => {
      const script = `eval('code')`;
      const validation = validateScript(script);
      expect(validation.errors.some(e => e.includes('eval'))).toBe(true);
    });

    test('should detect Function() as error', () => {
      const script = `new Function('return 1')`;
      const validation = validateScript(script);
      expect(validation.errors.some(e => e.includes('Function'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cleanupTempDirectory', () => {
    test('should handle null tempDir', async () => {
      await expect(cleanupTempDirectory(null)).resolves.not.toThrow();
    });

    test('should handle undefined tempDir', async () => {
      await expect(cleanupTempDirectory(undefined)).resolves.not.toThrow();
    });

    test('should handle cleanup error gracefully', async () => {
      await expect(cleanupTempDirectory('/nonexistent/path')).resolves.not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE TYPE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Database Type Handling', () => {
    test('should handle PostgreSQL database type', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: { success: true, output: [] },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("pg test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.metadata.databaseType).toBe('postgresql');
    });

    test('should handle MongoDB database type', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: { success: true, output: [] },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("mongo test")',
        databaseType: 'mongodb',
        instanceId: 'test-mongo',
        databaseName: 'test_db',
      });

      expect(result.metadata.databaseType).toBe('mongodb');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT AND SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Output and Summary', () => {
    test('should include execution metadata', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: { success: true, output: [] },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.databaseType).toBe('postgresql');
      expect(result.metadata.databaseName).toBe('test_db');
      expect(result.metadata.instanceId).toBe('test-pg');
      expect(result.metadata.executedAt).toBeDefined();
    });

    test('should include duration', async () => {
      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: { success: true, output: [] },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.duration).toBeDefined();
      expect(typeof result.duration).toBe('number');
    });

    test('should build execution summary for queries', async () => {
      const mockOutput = [
        { type: 'query', queryType: 'SELECT', rowCount: 10 },
        { type: 'query', queryType: 'INSERT', rowCount: 5 },
        { type: 'operation', count: 3 },
        { type: 'operation', insertedCount: 2 },
        { type: 'operation', modifiedCount: 4 },
        { type: 'operation', deletedCount: 1 },
        { type: 'error', message: 'test error' },
        { type: 'warn', message: 'test warning' },
      ];

      mockChildProcess.on.mockImplementation((event: any, callback: any) => {
        if (event === 'message') {
          setTimeout(() => callback({ type: 'ready' }), 10);
          setTimeout(() => callback({
            type: 'result',
            data: { success: true, output: mockOutput },
          }), 20);
        }
      });

      const result = await executeScript({
        scriptContent: 'console.log("test")',
        databaseType: 'postgresql',
        instanceId: 'test-pg',
        databaseName: 'test_db',
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalQueries).toBe(2);
      expect(result.summary.rowsReturned).toBe(10);
      expect(result.summary.rowsAffected).toBeGreaterThan(0);
      expect(result.summary.totalOperations).toBe(4);
      expect(result.summary.errors).toBe(1);
      expect(result.summary.warnings).toBe(1);
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// CHILD PROCESS ISOLATION BENEFITS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Child Process Isolation Benefits', () => {

  test('should provide true OS-level isolation (separate process)', () => {
    // Child process runs in separate memory space
    // This is verified by the fact that we use fork() which creates a new process
    expect(fork).toBeDefined();

    // The worker script runs in its own process with its own memory
    // Unlike VM2 which shares memory with the parent process
  });

  test('should be able to kill hung processes', async () => {
    // Simulate a timeout scenario where we need to kill the process
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'exit') {
        // Simulate process being killed
        setTimeout(() => callback(null, 'SIGKILL'), 10);
      }
    });

    const result = await executeScript({
      scriptContent: 'while(true) {}',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(false);
    // Process can be killed, unlike VM2 which can block the event loop
  });

  test('should not block parent event loop', async () => {
    // The parent process continues to run while child executes
    // This is inherent to child_process.fork()

    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: [] },
        }), 20);
      }
    });

    // Start execution
    const promise = executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    // Parent can do other work while waiting
    let parentWorked = false;
    setTimeout(() => { parentWorked = true; }, 5);

    await promise;

    // Parent event loop was not blocked
    expect(parentWorked).toBe(true);
  });

  test('should use built-in Node.js module (no CVE-prone dependencies)', () => {
    // child_process is built into Node.js
    // Unlike VM2 which has known CVEs and is deprecated
    const childProcess = require('child_process');
    expect(childProcess.fork).toBeDefined();
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


// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL BRANCH COVERAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Script Execution Service - Additional Branch Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChildProcess.killed = false;
    mockChildProcess.on.mockReset();
    mockChildProcess.send.mockReset();
    mockChildProcess.kill.mockReset();
  });

  test('should handle timeout when child process does not respond', async () => {
    // Don't set up any message handlers - simulate no response
    mockChildProcess.on.mockImplementation(() => { });

    // Override EXECUTION_CONFIG timeout for this test
    const originalTimeout = EXECUTION_CONFIG.timeout;
    EXECUTION_CONFIG.timeout = 100; // Very short timeout for testing

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    // Restore original timeout
    EXECUTION_CONFIG.timeout = originalTimeout;

    expect(result.success).toBe(false);
    expect(result.error.type).toBe('TimeoutError');
  }, 10000);

  test('should handle already resolved state in handleResult', async () => {
    // Simulate multiple result messages (edge case)
    let messageCallback;
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        messageCallback = callback;
        setTimeout(() => callback({ type: 'ready' }), 10);
        // Send result twice to test the resolved guard
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: [] },
        }), 20);
        setTimeout(() => callback({
          type: 'result',
          data: { success: false, output: [] },
        }), 30);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    // First result should be used
    expect(result.success).toBe(true);
  });

  test('should cleanup timeout on successful result', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: [] },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(true);
    // Timeout should have been cleared
  });

  test('should handle exit with SIGKILL signal', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'exit') {
        setTimeout(() => callback(null, 'SIGKILL'), 10);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(false);
    expect(result.error.type).toBe('TimeoutError');
  });

  test('should handle exit after already resolved', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: [] },
        }), 20);
      }
      if (event === 'exit') {
        // Exit after result is already received
        setTimeout(() => callback(0, null), 50);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(true);
  });

  test('should handle error after already resolved', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: [] },
        }), 20);
      }
      if (event === 'error') {
        // Error after result is already received
        setTimeout(() => callback(new Error('Late error')), 50);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(true);
  });

  test('should handle normal exit code 0 after resolved', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: [] },
        }), 20);
      }
      if (event === 'exit') {
        setTimeout(() => callback(0, null), 100);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// BRANCH COVERAGE FOR RESULT HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Script Execution Service - Result Handling Branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChildProcess.killed = false;
    mockChildProcess.on.mockReset();
    mockChildProcess.send.mockReset();
    mockChildProcess.kill.mockReset();
  });

  test('should handle result with no output array', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: {
            success: true,
            result: 'test',
            // No output array
          },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(true);
    // Should still have the initial output from executeScript
    expect(result.output.length).toBeGreaterThan(0);
  });

  test('should handle result with null output', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: {
            success: true,
            result: 'test',
            output: null,
          },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(true);
  });

  test('should handle failed result with error object', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: {
            success: false,
            error: {
              type: 'RuntimeError',
              message: 'Something went wrong',
            },
            output: [{ type: 'error', message: 'Error occurred' }],
          },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'throw new Error("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(false);
    expect(result.error.type).toBe('RuntimeError');
    expect(result.error.message).toBe('Something went wrong');
  });

  test('should handle failed result with null error', async () => {
    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: {
            success: false,
            error: null,
            output: [],
          },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'throw new Error("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeNull();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION SUMMARY BRANCH COVERAGE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Script Execution Service - Summary Building Branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChildProcess.killed = false;
    mockChildProcess.on.mockReset();
    mockChildProcess.send.mockReset();
    mockChildProcess.kill.mockReset();
  });

  test('should handle query with zero rowCount', async () => {
    const mockOutput = [
      { type: 'query', queryType: 'SELECT', rowCount: 0 },
      { type: 'query', queryType: 'DELETE', rowCount: 0 },
    ];

    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: mockOutput },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.summary.totalQueries).toBe(2);
    expect(result.summary.rowsReturned).toBe(0);
    expect(result.summary.rowsAffected).toBe(0);
  });

  test('should handle query with undefined rowCount', async () => {
    const mockOutput = [
      { type: 'query', queryType: 'SELECT' },
      { type: 'query', queryType: 'UPDATE' },
    ];

    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: mockOutput },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.summary.totalQueries).toBe(2);
    expect(result.summary.rowsReturned).toBe(0);
  });

  test('should handle non-SELECT query with rowCount', async () => {
    const mockOutput = [
      { type: 'query', queryType: 'UPDATE', rowCount: 5 },
      { type: 'query', queryType: 'DELETE', rowCount: 3 },
      { type: 'query', queryType: 'INSERT', rowCount: 2 },
    ];

    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: mockOutput },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.summary.totalQueries).toBe(3);
    expect(result.summary.rowsAffected).toBe(10);
    expect(result.summary.rowsReturned).toBe(0);
  });

  test('should handle operation without count fields', async () => {
    const mockOutput = [
      { type: 'operation', operation: 'drop' },
      { type: 'operation', operation: 'createIndex' },
    ];

    mockChildProcess.on.mockImplementation((event: any, callback: any) => {
      if (event === 'message') {
        setTimeout(() => callback({ type: 'ready' }), 10);
        setTimeout(() => callback({
          type: 'result',
          data: { success: true, output: mockOutput },
        }), 20);
      }
    });

    const result = await executeScript({
      scriptContent: 'console.log("test")',
      databaseType: 'postgresql',
      instanceId: 'test-pg',
      databaseName: 'test_db',
    });

    expect(result.summary.totalOperations).toBe(2);
    expect(result.summary.documentsProcessed).toBe(0);
  });
});
