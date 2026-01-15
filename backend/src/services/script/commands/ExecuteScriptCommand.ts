/**
 * Execute Script Command
 * Implementation of Command Pattern
 */

import { ScriptCommand, ScriptExecutionResult, ScriptQueryRequest } from '../interfaces';
import { ScriptExecutor } from '../ScriptExecutor';

export class ExecuteScriptCommand implements ScriptCommand {
    constructor(
        private executor: ScriptExecutor,
        private request: ScriptQueryRequest
    ) { }

    async execute(): Promise<ScriptExecutionResult> {
        return this.executor.execute(this.request);
    }
}
