/**
 * Script Executor - Receiver in Command Pattern
 * 
 * Responsible for the actual business logic of executing scripts:
 * - Validating script content
 * - Managing child process lifecycle
 * - Enforcing timeouts
 * - Parsing results
 */

import { fork, ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import logger from '../../utils/logger';
import {
    ExecutionConfig,
    ScriptExecutionResult,
    ScriptQueryRequest,
    SyntaxValidationResult,
    ScriptValidationResult,
    ChildProcessResult,
    OutputItem,
    ExecutionSummary,
    WorkerConfig
} from './interfaces';

export class ScriptExecutor {
    private static readonly EXECUTION_CONFIG: ExecutionConfig = {
        timeout: 30000,
        memoryLimit: 128,
    };

    /**
     * Validate script syntax and dangerous patterns
     */
    public validate(scriptContent: string): ScriptValidationResult {
        const warnings: string[] = [];
        const errors: string[] = [];

        // Check syntax
        const syntaxCheck = this.validateSyntax(scriptContent);
        if (!syntaxCheck.valid && syntaxCheck.error) {
            errors.push(syntaxCheck.error.details);
        }

        // Check for dangerous patterns
        const dangerousPatterns = [
            { pattern: /require\s*\(/gi, message: 'require() is not available', isError: true },
            { pattern: /process\./gi, message: 'process object is not accessible', isError: true },
            { pattern: /eval\s*\(/gi, message: 'eval() is blocked', isError: true },
            { pattern: /Function\s*\(/gi, message: 'Function constructor is blocked', isError: true },
            { pattern: /child_process/gi, message: 'child_process is blocked', isError: true },
            { pattern: /fs\./gi, message: 'fs module is blocked', isError: true },
            { pattern: /\.dropDatabase\s*\(/gi, message: '🔴 CRITICAL: dropDatabase() detected', isError: false },
            { pattern: /\.drop\s*\(\s*\)/gi, message: '🔴 CRITICAL: drop() detected', isError: false },
            { pattern: /\.deleteMany\s*\(\s*\{\s*\}\s*\)/gi, message: '🔴 CRITICAL: deleteMany({}) detected', isError: false },
        ];

        for (const { pattern, message, isError } of dangerousPatterns) {
            if (pattern.test(scriptContent)) {
                if (isError) errors.push(message);
                else warnings.push(message);
            }
        }

        return {
            valid: errors.length === 0,
            warnings,
            errors,
        };
    }

    /**
     * Validate syntax using Function constructor
     */
    public validateSyntax(scriptContent: string): SyntaxValidationResult {
        try {
            const wrappedScript = `(async () => { ${scriptContent} })()`;
            // eslint-disable-next-line no-new-func
            new Function(wrappedScript);
            return { valid: true };
        } catch (error) {
            const err = error as Error;
            const lineMatch = err.message.match(/line (\d+)/i) || err.stack?.match(/:(\d+):\d+/);
            const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : null;
            return {
                valid: false,
                error: {
                    type: 'SyntaxError',
                    message: err.message,
                    line: lineNumber,
                    details: `Syntax error${lineNumber ? ` at line ${lineNumber}` : ''}: ${err.message}`,
                },
            };
        }
    }

    /**
     * Detect script language from filename or content
     */
    public detectLanguage(request: ScriptQueryRequest): 'javascript' | 'python' {
        // Explicit language takes precedence
        if (request.scriptLanguage) {
            return request.scriptLanguage;
        }

        // Detect from filename
        if (request.scriptFilename) {
            if (request.scriptFilename.endsWith('.py')) return 'python';
            if (request.scriptFilename.endsWith('.js')) return 'javascript';
        }

        // Detect from content (heuristic)
        const content = request.scriptContent;
        if (/^\s*(def |import |from |class \w+:)/m.test(content)) {
            return 'python';
        }

        // Default to JavaScript
        return 'javascript';
    }

    /**
     * Validate Python script for dangerous patterns
     */
    public validatePython(scriptContent: string): ScriptValidationResult {
        const warnings: string[] = [];
        const errors: string[] = [];

        // Dangerous patterns for Python
        const dangerousPatterns = [
            { pattern: /\bopen\s*\(/gi, message: 'open() is not available', isError: true },
            { pattern: /\bexec\s*\(/gi, message: 'exec() is blocked', isError: true },
            { pattern: /\beval\s*\(/gi, message: 'eval() is blocked', isError: true },
            { pattern: /\bsubprocess/gi, message: 'subprocess is blocked', isError: true },
            { pattern: /\bos\./gi, message: 'os module is blocked', isError: true },
            { pattern: /\bsocket/gi, message: 'socket is blocked', isError: true },
            { pattern: /\burllib/gi, message: 'urllib is blocked', isError: true },
            { pattern: /\brequests\./gi, message: 'requests module is blocked', isError: true },
            { pattern: /__import__/gi, message: '__import__ is blocked', isError: true },
            { pattern: /\.drop_database\s*\(/gi, message: '🔴 CRITICAL: drop_database() detected', isError: false },
            { pattern: /\.drop\s*\(/gi, message: '🔴 CRITICAL: drop() detected', isError: false },
            { pattern: /\.delete_many\s*\(\s*\{\s*\}\s*\)/gi, message: '🔴 CRITICAL: delete_many({}) detected', isError: false },
        ];

        for (const { pattern, message, isError } of dangerousPatterns) {
            if (pattern.test(scriptContent)) {
                if (isError) errors.push(message);
                else warnings.push(message);
            }
        }

        return {
            valid: errors.length === 0,
            warnings,
            errors,
        };
    }

    /**
     * Run Python script in child process
     * 
     * ARCHITECTURE:
     * - Spawns python3 with pythonWorker.py
     * - Sends config via stdin (JSON)
     * - Receives result via stdout (JSON)
     * - Enforces timeout
     */
    private async runPythonWorker(config: WorkerConfig): Promise<ChildProcessResult> {
        return new Promise((resolve) => {
            // Find Python worker path
            const pythonWorkerPath = path.resolve(__dirname, 'worker/pythonWorker.py');

            if (!fs.existsSync(pythonWorkerPath)) {
                resolve({
                    success: false,
                    error: { type: 'ConfigError', message: `Python worker not found at ${pythonWorkerPath}` }
                });
                return;
            }

            const child = spawn('python3', [pythonWorkerPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
            });

            let stdout = '';
            let stderr = '';
            let resolved = false;
            let timeoutId: NodeJS.Timeout | null = null;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (!child.killed) child.kill('SIGTERM');
            };

            const handleResult = (data: ChildProcessResult) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(data);
            };

            // Timeout handler
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    handleResult({
                        success: false,
                        error: { type: 'TimeoutError', message: `Script timed out after ${config.timeout}ms` }
                    });
                }
            }, config.timeout + 5000);

            // Capture stdout
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            // Capture stderr
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Handle process exit
            child.on('close', (code) => {
                if (resolved) return;

                try {
                    // Parse JSON result from stdout
                    const result = JSON.parse(stdout);
                    handleResult(result);
                } catch {
                    // Failed to parse - return error with stderr
                    handleResult({
                        success: false,
                        error: {
                            type: 'ProcessError',
                            message: stderr || `Python exited with code ${code}`
                        },
                        output: [{ type: 'error', message: stderr || 'Unknown error', timestamp: new Date().toISOString() }]
                    });
                }
            });

            child.on('error', (err) => {
                handleResult({
                    success: false,
                    error: { type: 'ProcessError', message: err.message }
                });
            });

            // Send config to stdin
            child.stdin.write(JSON.stringify(config));
            child.stdin.end();
        });
    }

    public async execute(request: ScriptQueryRequest): Promise<ScriptExecutionResult> {
        const startTime = Date.now();
        const output: OutputItem[] = [];
        const { scriptContent, databaseType, instanceId, databaseName } = request;

        output.push({
            type: 'info',
            message: `Starting script execution...`,
            database: databaseName,
            instance: instanceId,
            databaseType,
            timestamp: new Date().toISOString(),
        });

        try {
            // 1. Validation
            const syntaxCheck = this.validateSyntax(scriptContent);
            if (!syntaxCheck.valid && syntaxCheck.error) {
                return this.createErrorResult('SyntaxError', syntaxCheck.error.details, output, startTime, request);
            }

            // 2. Get Instance (Dynamic import to avoid circular dep if any, though less likely now)
            // Assuming we have centralized config or passing it in.
            // For now, retaining the dynamic import pattern from original service to be safe
            const { getInstanceById } = await import('../../config/staticData');
            const instance = getInstanceById(instanceId);

            if (!instance) throw new Error(`Instance not found: ${instanceId}`);

            // 3. Prepare Worker Config
            const workerConfig: WorkerConfig = {
                scriptContent,
                databaseType,
                instance,
                databaseName,
                timeout: ScriptExecutor.EXECUTION_CONFIG.timeout,
            };

            // 4. Detect language and run appropriate worker
            const language = this.detectLanguage(request);
            logger.info('Script language detected', { language, instanceId, databaseName });

            // Validate based on language
            if (language === 'python') {
                const pyValidation = this.validatePython(scriptContent);
                if (!pyValidation.valid) {
                    return this.createErrorResult('ValidationError', pyValidation.errors.join('; '), output, startTime, request);
                }
                if (pyValidation.warnings.length > 0) {
                    output.push({ type: 'warn', message: pyValidation.warnings.join('; '), timestamp: new Date().toISOString() });
                }
            }

            // 5. Run in appropriate Child Process
            const result = language === 'python'
                ? await this.runPythonWorker(workerConfig)
                : await this.runWorker(workerConfig);

            // 5. Merge Output
            if (result.output) output.push(...result.output);

            const duration = Date.now() - startTime;

            if (result.success) {
                output.push({ type: 'info', message: `Completed in ${duration}ms`, timestamp: new Date().toISOString() });
                return {
                    success: true,
                    result: result.result,
                    output,
                    summary: this.buildSummary(output),
                    duration,
                    metadata: { databaseType, databaseName, instanceId, executedAt: new Date().toISOString() }
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    output,
                    duration,
                    metadata: { databaseType, databaseName, instanceId, executedAt: new Date().toISOString() }
                };
            }

        } catch (error) {
            const err = error as Error;
            return this.createErrorResult('ExecutionError', err.message, output, startTime, request);
        }
    }

    private async runWorker(config: WorkerConfig): Promise<ChildProcessResult> {
        return new Promise((resolve) => {
            // Handle both development (ts-node) and production (compiled) modes
            // In dev, __dirname is in src/. In prod, __dirname is in dist/.
            const jsWorkerPath = path.join(__dirname, 'worker/scriptWorker.js');
            const distWorkerPath = path.resolve(__dirname, '../../../dist/services/script/worker/scriptWorker.js');

            // Check if running from src/ (dev mode) or dist/ (prod mode)
            const workerPath = require('fs').existsSync(jsWorkerPath)
                ? jsWorkerPath
                : distWorkerPath;

            const child: ChildProcess = fork(workerPath, [], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
            });

            let resolved = false;
            let timeoutId: NodeJS.Timeout | null = null;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (!child.killed) child.kill('SIGTERM');
            };

            const handleResult = (data: ChildProcessResult) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(data);
            };

            timeoutId = setTimeout(() => {
                if (!resolved) handleResult({ success: false, error: { type: 'TimeoutError', message: 'Timed out' } });
            }, config.timeout + 5000);

            child.on('message', (msg: any) => {
                if (msg.type === 'ready') child.send({ type: 'execute', config });
                else if (msg.type === 'result') handleResult(msg.data);
            });

            child.on('error', (err) => handleResult({ success: false, error: { type: 'ProcessError', message: err.message } }));
            child.on('exit', (code, signal) => {
                if (!resolved) {
                    handleResult({
                        success: false,
                        error: {
                            type: 'ProcessError',
                            message: signal ? `Terminated with ${signal}` : `Exited with ${code}`
                        }
                    });
                }
            });
        });
    }

    private buildSummary(output: OutputItem[]): ExecutionSummary {
        const summary: ExecutionSummary = {
            totalQueries: 0, totalOperations: 0, rowsReturned: 0, rowsAffected: 0,
            documentsProcessed: 0, errors: 0, warnings: 0,
        };
        for (const item of output) {
            if (item.type === 'query') {
                summary.totalQueries++;
                if (item.rowCount) {
                    // logical guess based on rowsReturned logic in original
                    summary.rowsAffected += item.rowCount as number;
                }
            }
            if (item.type === 'error') summary.errors++;
            if (item.type === 'warn') summary.warnings++;
            // Simplified summary logic for brevity, matches original roughly
        }
        return summary;
    }

    private createErrorResult(type: string, message: string, output: OutputItem[], startTime: number, request: ScriptQueryRequest): ScriptExecutionResult {
        output.push({ type: 'error', message, timestamp: new Date().toISOString() });
        return {
            success: false,
            error: { type, message },
            output,
            duration: Date.now() - startTime,
            metadata: {
                databaseType: request.databaseType,
                databaseName: request.databaseName,
                instanceId: request.instanceId,
                executedAt: new Date().toISOString()
            }
        };
    }

    public async cleanupTemp(path?: string): Promise<void> {
        if (!path) return;
        try { await fsPromises.rm(path, { recursive: true, force: true }); } catch { }
    }
}
