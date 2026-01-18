// @ts-nocheck
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { ScriptExecutor } from '../src/services/script/ScriptExecutor';
import path from 'path';
import fs from 'fs';
import { fork, spawn } from 'child_process';

// Mock child_process
const mockChildProcess = {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    stdin: { write: jest.fn(), end: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
    killed: false,
    send: jest.fn(),
};

jest.mock('child_process', () => ({
    spawn: jest.fn(() => mockChildProcess),
    fork: jest.fn(() => mockChildProcess),
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// Mock staticData - needed because execute() imports it dynamically
jest.mock('../src/config/staticData', () => ({
    getInstanceById: jest.fn((id) => {
        if (id === 'test-pg') return { id: 'test-pg', type: 'postgresql' };
        return null;
    }),
}));

describe('Script Executor Coverage - Edge Cases', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = { ...process.env };

        mockChildProcess.killed = false;
        mockChildProcess.stdout.on.mockReset();
        mockChildProcess.stderr.on.mockReset();
        mockChildProcess.on.mockReset();
        mockChildProcess.stdin.write.mockReset();

        // Default behavior: success
        mockChildProcess.on.mockImplementation((event, callback) => {
            // No default auto-callback here, let individual tests drive it
        });

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    describe('Worker Path Resolution (runWorker)', () => {
        const executor = new ScriptExecutor();
        const request = {
            scriptContent: 'console.log("test")',
            databaseType: 'postgresql',
            instanceId: 'test-pg',
            databaseName: 'test_db',
            scriptLanguage: 'javascript'
        };

        test('should use typescript worker in dev mode if it exists', async () => {
            process.env.NODE_ENV = 'development';

            // Mock existsSync to return true for .ts file
            jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
                if (typeof p === 'string' && p.endsWith('scriptWorker.ts')) return true;
                return false;
            });

            // We need to simulate the worker "ready" and "result" flow so execute() finishes
            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'message') {
                    setTimeout(() => callback({ type: 'ready' }), 5);
                    setTimeout(() => callback({ type: 'result', data: { success: true, result: 'ok', output: [] } }), 10);
                }
            });

            await executor.execute(request);

            // Check fork call
            expect(fork).toHaveBeenCalled();
            const forkCall = (fork as jest.Mock).mock.calls[0];
            expect(forkCall[0]).toContain('scriptWorker.ts');
        });

        test('should use javascript worker if typescript worker missing', async () => {
            process.env.NODE_ENV = 'development';

            // Mock existsSync: .ts missing, .js present
            jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
                if (typeof p === 'string' && p.endsWith('scriptWorker.ts')) return false;
                if (typeof p === 'string' && p.endsWith('scriptWorker.js')) return true;
                return false;
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'message') {
                    // simulate flow
                    setTimeout(() => callback({ type: 'ready' }), 5);
                    setTimeout(() => callback({ type: 'result', data: { success: true } }), 10);
                }
            });

            await executor.execute(request);

            const forkCall = (fork as jest.Mock).mock.calls[0];
            expect(forkCall[0]).toContain('scriptWorker.js');
        });

        test('should fall back to dist path if local workers missing', async () => {
            // Mock existsSync: all local missing
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'message') {
                    setTimeout(() => callback({ type: 'ready' }), 5);
                    setTimeout(() => callback({ type: 'result', data: { success: true } }), 10);
                }
            });

            await executor.execute(request);

            const forkCall = (fork as jest.Mock).mock.calls[0];
            // The path resolution logic usually falls back to the dist path constant
            // defined in the method. 
            // Assert it contains 'dist' or matches the fallback logic expectation
            expect(forkCall[0]).toContain('dist');
        });
    });

    describe('Python Worker Edge Cases', () => {
        const executor = new ScriptExecutor();
        const request = {
            scriptContent: 'print("test")',
            databaseType: 'postgresql',
            instanceId: 'test-pg',
            databaseName: 'test_db',
            scriptLanguage: 'python'
        };

        test('should handle Python worker file missing', async () => {
            // Mock existsSync to return false for pythonWorker.py
            jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
                if (typeof p === 'string' && p.endsWith('pythonWorker.py')) return false;
                return true;
            });

            const result = await executor.execute(request);

            expect(result.success).toBe(false);
            expect(result.error.message).toContain('Python worker not found');
        });

        test('should handle JSON parse error from Python output', async () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            // Simulate output that is NOT valid JSON
            mockChildProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback('Not JSON output');
                }
            });

            // Simulate process close
            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 10);
                }
            });

            const result = await executor.execute(request);

            expect(result.success).toBe(false);
            expect(result.error.type).toBe('ProcessError');
            // It might capture "Unknown error" if stderr is empty, or the parse error
            expect(result.output.some(o => o.type === 'error')).toBe(true);
        });

        test('should capture stderr when processes crashes', async () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            mockChildProcess.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') callback('ImportError: no module named xyz');
            });

            mockChildProcess.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(1), 10);
                }
            });

            const result = await executor.execute(request);

            expect(result.success).toBe(false);
            expect(result.error.message).toContain('ImportError');
        });
    });

    describe('Cleanup Edge Cases', () => {
        test('should ignore errors during cleanup', async () => {
            const executor = new ScriptExecutor();
            jest.spyOn(fs.promises, 'rm').mockRejectedValue(new Error('Permission denied'));

            // Should not throw
            await expect(executor.cleanupTemp('/tmp/foo')).resolves.not.toThrow();
        });
    });
});
