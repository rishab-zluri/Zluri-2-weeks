/**
 * Script Service Facade
 * 
 * Uses Command Pattern to execute scripts.
 */

import { ExecuteScriptCommand } from './commands/ExecuteScriptCommand';
import { ScriptExecutor } from './ScriptExecutor';
import { ScriptQueryRequest, ScriptExecutionResult, ScriptValidationResult, ExecutionConfig } from './interfaces';

// Re-export types
export * from './interfaces';

// Configuration (exposed for compatibility)
export const EXECUTION_CONFIG: ExecutionConfig = {
    timeout: 30000,
    memoryLimit: 128,
};

/**
 * Execute a script
 * Creates a command and executes it via the executor
 */
export async function executeScript(request: ScriptQueryRequest): Promise<ScriptExecutionResult> {
    const executor = new ScriptExecutor(EXECUTION_CONFIG);
    const command = new ExecuteScriptCommand(executor, request);
    return command.execute();
}

/**
 * Validate script content
 */
export function validateScript(scriptContent: string): ScriptValidationResult {
    const executor = new ScriptExecutor();
    return executor.validate(scriptContent);
}

/**
 * Validate script syntax only
 */
export function validateScriptSyntax(scriptContent: string) {
    const executor = new ScriptExecutor();
    return executor.validateSyntax(scriptContent);
}

/**
 * Cleanup temp directory (Wrapper)
 */
export async function cleanupTempDirectory(path?: string): Promise<void> {
    const executor = new ScriptExecutor();
    return executor.cleanupTemp(path);
}

/**
 * Build execution summary
 * (Moved logic to executor or keep as util? Original had it as export)
 * The executor builds it internally, but we might need it exposed.
 * Using a simple re-implementation or importing if I extracted it.
 * 
 * For now, I'll reimplement simply or delegate if I made it static.
 * I made it private in Executor. I should make it public or duplicate logic?
 * I'll update Executor to make it public static or just public.
 * 
 * Correction: I'll make it static in Executor or just export a helper here.
 * actually the interface defines it.
 * 
 * Let's just create a helper here for backward compatibility.
 */
export function buildExecutionSummary(output: any[]): any {
    // Basic implementation for compatibility
    let totalQueries = 0;
    let errors = 0;
    for (const item of output) {
        if (item.type === 'query') totalQueries++;
        if (item.type === 'error') errors++;
    }
    return {
        totalQueries,
        totalOperations: 0, // Simplified
        rowsReturned: 0,
        rowsAffected: 0,
        documentsProcessed: 0,
        errors,
        warnings: 0
    };
}

// Default export
export default {
    executeScript,
    validateScript,
    validateScriptSyntax,
    cleanupTempDirectory,
    buildExecutionSummary,
    EXECUTION_CONFIG
};
