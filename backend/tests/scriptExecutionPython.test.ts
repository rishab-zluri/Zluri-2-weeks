// @ts-nocheck
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { executeScript, validateScript, EXECUTION_CONFIG } from '../src/services/script/index';
import { ScriptExecutor } from '../src/services/script/ScriptExecutor';
import path from 'path';
import fs from 'fs';

// Mock child_process
const mockChildProcess = {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    stdin: { write: jest.fn(), end: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
    killed: false,
};

jest.mock('child_process', () => ({
    spawn: jest.fn(() => mockChildProcess),
    fork: jest.fn(), // Mock fork too to avoid errors if called
}));

// Mock logs
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// Mock staticData
jest.mock('../src/config/staticData', () => ({
    getInstanceById: jest.fn((id) => {
        if (id === 'test-pg') return { id: 'test-pg', type: 'postgresql' };
        return null;
    }),
}));

describe('Script Executor - Python Support', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChildProcess.killed = false;
        mockChildProcess.stdout.on.mockReset();
        mockChildProcess.stderr.on.mockReset();
        mockChildProcess.on.mockReset();
        mockChildProcess.stdin.write.mockReset();

        // Default successful spawn behavior helper
        mockChildProcess.on.mockImplementation((event, callback) => {
            if (event === 'close') {
                // By default do nothing, test calls callback manually or via helper
            }
        });

        // Mock fs.existsSync to true for worker path by default
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Language Detection', () => {
        const executor = new ScriptExecutor();

        test('should detect python from extension', () => {
            expect(executor.detectLanguage({ scriptFilename: 'test.py' })).toBe('python');
        });

        test('should detect python from explicit language', () => {
            expect(executor.detectLanguage({ scriptLanguage: 'python' })).toBe('python');
        });

        test('should detect python from content heuristic', () => {
            expect(executor.detectLanguage({ scriptContent: 'import os' })).toBe('python');
            expect(executor.detectLanguage({ scriptContent: 'def foo():' })).toBe('python');
            expect(executor.detectLanguage({ scriptContent: 'class Foo:' })).toBe('python');
        });

        test('should default to javascript', () => {
            expect(executor.detectLanguage({ scriptContent: 'console.log("hi")' })).toBe('javascript');
        });
    });

    describe('Python Validation', () => {
        const executor = new ScriptExecutor();

        test('should pass safe python code', () => {
            const result = executor.validatePython('print("hello")');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect import os', () => {
            const result = executor.validatePython('import os');
            expect(result.valid).toBe(false);
            expect(result.errors.join(' ')).toMatch(/os module is blocked/);
        });

        test('should detect open()', () => {
            const result = executor.validatePython('open("file")');
            expect(result.valid).toBe(false);
            expect(result.errors.join(' ')).toMatch(/open\(\) is not available/);
        });

        test('should detect subprocess', () => {
            const result = executor.validatePython('import subprocess');
            expect(result.valid).toBe(false);
            expect(result.errors.join(' ')).toMatch(/subprocess is blocked/);
        });

        test('should warn on drop()', () => {
            const result = executor.validatePython('db.collection.drop()');
            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('CRITICAL'))).toBe(true);
        });
    });

    describe('Python Execution', () => {
        test('should spawn python3 process', async () => {
            // Simulate successful execution
            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });
            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback(JSON.stringify({ success: true, result: 'test', output: [] }));
                }
            });

            await executeScript({
                scriptContent: 'print("test")',
                scriptLanguage: 'python',
                instanceId: 'test-pg',
                databaseName: 'test_db'
            });

            const { spawn } = require('child_process');
            expect(spawn).toHaveBeenCalledWith('python3', expect.anything(), expect.anything());
        });

        test('should handle worker not found', async () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);

            const result = await executeScript({
                scriptContent: 'print("test")',
                scriptLanguage: 'python',
                instanceId: 'test-pg',
                databaseName: 'test_db'
            });

            expect(result.success).toBe(false);
            expect(result.error.message).toContain('Python worker not found');
        });

        test('should handle execution error from worker', async () => {
            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') setTimeout(() => callback(0), 10);
            });
            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback(JSON.stringify({ success: false, error: { type: 'Error', message: 'Failed' } }));
                }
            });

            const result = await executeScript({
                scriptContent: 'print("test")',
                scriptLanguage: 'python',
                instanceId: 'test-pg',
                databaseName: 'test_db'
            });

            expect(result.success).toBe(false);
            expect(result.error.message).toBe('Failed');
        });

        test('should handle malformed output', async () => {
            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') setTimeout(() => callback(0), 10);
            });
            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback('CRASHED');
                }
            });
            mockChildProcess.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') callback('Traceback error');
            });

            const result = await executeScript({
                scriptContent: 'print("test")',
                scriptLanguage: 'python',
                instanceId: 'test-pg',
                databaseName: 'test_db'
            });

            expect(result.success).toBe(false);
            expect(result.error.type).toBe('ProcessError');
        });

        test('should handle process error event', async () => {
            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'error') setTimeout(() => callback(new Error('Spawn failed')), 10);
            });

            const result = await executeScript({
                scriptContent: 'print("test")',
                scriptLanguage: 'python',
                instanceId: 'test-pg',
                databaseName: 'test_db'
            });

            expect(result.success).toBe(false);
            expect(result.error.message).toBe('Spawn failed');
        });

        test('should handle timeout', async () => {
            // Use real timers with short timeout for reliability
            const originalTimeout = EXECUTION_CONFIG.timeout;
            EXECUTION_CONFIG.timeout = 100; // 100ms timeout

            try {
                const result = await executeScript({
                    scriptContent: 'while True: pass',
                    scriptLanguage: 'python',
                    instanceId: 'test-pg',
                    databaseName: 'test_db'
                });

                expect(result.success).toBe(false);
                expect(result.error.type).toBe('TimeoutError');
            } finally {
                EXECUTION_CONFIG.timeout = originalTimeout;
            }
        });
    });
});
