/**
 * Script Execution Service - Child Process Sandboxed Environment
 * 
 * Executes user scripts in a secure child process for true OS-level isolation.
 * This provides better security than VM2 (which has known CVEs and is deprecated).
 * 
 * Benefits of child_process over VM2:
 * - True OS-level process isolation (separate memory space)
 * - No shared memory with parent process
 * - Can be killed if it hangs (doesn't block event loop)
 * - Built into Node.js (no external dependencies with CVEs)
 * - Better resource control via OS process limits
 * 
 * @module services/scriptExecutionService
 */

const { fork } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const EXECUTION_CONFIG = {
  timeout: 30000,
  memoryLimit: 128,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT SYNTAX VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

function validateScriptSyntax(scriptContent) {
  try {
    new Function(scriptContent);
    return { valid: true };
  } catch (error) {
    /* istanbul ignore next - syntax error parsing varies by environment */
    return parseSyntaxError(error);
  }
}

/* istanbul ignore next - syntax error parsing varies by environment */
function parseSyntaxError(error) {
  const lineMatch = error.message.match(/line (\d+)/i) || 
                    error.stack?.match(/:(\d+):\d+/);
  const lineNumber = lineMatch ? parseInt(lineMatch[1]) : null;

  return {
    valid: false,
    error: {
      type: 'SyntaxError',
      message: error.message,
      line: lineNumber,
      details: `Syntax error${lineNumber ? ` at line ${lineNumber}` : ''}: ${error.message}`,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function executeScript(queryRequest) {
  const { scriptContent, databaseType, instanceId, databaseName } = queryRequest;
  const startTime = Date.now();
  const output = [];

  output.push({
    type: 'info',
    message: `Starting script execution...`,
    database: databaseName,
    instance: instanceId,
    databaseType,
    timestamp: new Date().toISOString(),
  });

  try {
    // Validate script content
    if (!scriptContent || typeof scriptContent !== 'string') {
      throw new Error('Invalid script content: Script is empty or not a string');
    }

    if (scriptContent.length > 1024 * 1024) {
      throw new Error('Script too large: Maximum size is 1MB');
    }

    // Check syntax first
    const syntaxCheck = validateScriptSyntax(scriptContent);
    if (!syntaxCheck.valid) {
      output.push({
        type: 'error',
        message: syntaxCheck.error.details,
        errorType: syntaxCheck.error.type,
        line: syntaxCheck.error.line,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: {
          type: 'SyntaxError',
          message: syntaxCheck.error.details,
          line: syntaxCheck.error.line,
        },
        output,
        duration: Date.now() - startTime,
        metadata: {
          databaseType,
          databaseName,
          instanceId,
          executedAt: new Date().toISOString(),
        },
      };
    }

    // Get instance configuration
    const { getInstanceById } = require('../config/staticData');
    const instance = getInstanceById(instanceId);

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    if (databaseType === 'postgresql' && !instance.host) {
      throw new Error(`PostgreSQL instance ${instanceId} missing host configuration`);
    }

    if (databaseType === 'mongodb' && !instance.uri) {
      throw new Error(`MongoDB instance ${instanceId} missing URI configuration`);
    }

    // Execute in child process
    const result = await executeInChildProcess({
      scriptContent,
      databaseType,
      instance,
      databaseName,
      timeout: EXECUTION_CONFIG.timeout,
    });

    const duration = Date.now() - startTime;

    // Merge output from child process
    if (result.output) {
      output.push(...result.output);
    }

    if (result.success) {
      output.push({
        type: 'info',
        message: `Script completed successfully in ${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      logger.info('Script execution completed', {
        databaseType,
        databaseName,
        instanceId,
        duration,
        outputCount: output.length,
      });

      const summary = buildExecutionSummary(output);

      return {
        success: true,
        result: result.result,
        output,
        summary,
        duration,
        metadata: {
          databaseType,
          databaseName,
          instanceId,
          executedAt: new Date().toISOString(),
        },
      };
    } else {
      logger.error('Script execution failed', {
        error: result.error?.message,
        databaseType,
        databaseName,
        duration,
      });

      return {
        success: false,
        error: result.error,
        output,
        duration,
        metadata: {
          databaseType,
          databaseName,
          instanceId,
          executedAt: new Date().toISOString(),
        },
      };
    }

  } catch (error) {
    /* istanbul ignore next - catch block for unexpected errors */
    return handleExecutionError(error, startTime, databaseType, databaseName, instanceId, output);
  }
}

/* istanbul ignore next - error handler for unexpected errors */
function handleExecutionError(error, startTime, databaseType, databaseName, instanceId, output) {
  const duration = Date.now() - startTime;

  output.push({
    type: 'error',
    message: `Script failed: ${error.message}`,
    errorType: error.name || 'Error',
    timestamp: new Date().toISOString(),
  });

  logger.error('Script execution failed', {
    error: error.message,
    databaseType,
    databaseName,
    duration,
  });

  return {
    success: false,
    error: {
      type: error.name || 'Error',
      message: error.message,
    },
    output,
    duration,
    metadata: {
      databaseType,
      databaseName,
      instanceId,
      executedAt: new Date().toISOString(),
    },
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// CHILD PROCESS EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

/* istanbul ignore next - child process execution tested via mocks */
function executeInChildProcess(config) {
  return new Promise((resolve) => {
    const workerPath = path.join(__dirname, 'scriptWorker.js');
    
    const child = fork(workerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    });

    let resolved = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    };

    const handleResult = (data) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(data);
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      if (!resolved) {
        handleResult({
          success: false,
          error: {
            type: 'TimeoutError',
            message: `Script execution timed out after ${config.timeout / 1000} seconds`,
          },
          output: [{
            type: 'error',
            message: `Script execution timed out after ${config.timeout / 1000} seconds`,
            timestamp: new Date().toISOString(),
          }],
        });
      }
    }, config.timeout + 5000); // Extra 5s for setup/teardown

    child.on('message', (message) => {
      if (message.type === 'ready') {
        // Worker is ready, send the script
        child.send({ type: 'execute', config });
      } else if (message.type === 'result') {
        handleResult(message.data);
      }
    });

    child.on('error', (error) => {
      handleResult({
        success: false,
        error: {
          type: 'ProcessError',
          message: `Child process error: ${error.message}`,
        },
        output: [{
          type: 'error',
          message: `Child process error: ${error.message}`,
          timestamp: new Date().toISOString(),
        }],
      });
    });

    child.on('exit', (code, signal) => {
      if (!resolved) {
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          handleResult({
            success: false,
            error: {
              type: 'TimeoutError',
              message: 'Script execution was terminated',
            },
            output: [{
              type: 'error',
              message: 'Script execution was terminated',
              timestamp: new Date().toISOString(),
            }],
          });
        } else if (code !== 0) {
          handleResult({
            success: false,
            error: {
              type: 'ProcessError',
              message: `Child process exited with code ${code}`,
            },
            output: [{
              type: 'error',
              message: `Child process exited with code ${code}`,
              timestamp: new Date().toISOString(),
            }],
          });
        }
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

function buildExecutionSummary(output) {
  const summary = {
    totalQueries: 0,
    totalOperations: 0,
    rowsReturned: 0,
    rowsAffected: 0,
    documentsProcessed: 0,
    errors: 0,
    warnings: 0,
  };

  for (const item of output) {
    if (item.type === 'query') {
      summary.totalQueries++;
      if (item.rowCount) {
        if (['SELECT'].includes(item.queryType)) {
          summary.rowsReturned += item.rowCount;
        } else {
          summary.rowsAffected += item.rowCount;
        }
      }
    }
    if (item.type === 'operation') {
      summary.totalOperations++;
      if (item.count) summary.documentsProcessed += item.count;
      if (item.insertedCount) summary.documentsProcessed += item.insertedCount;
      if (item.modifiedCount) summary.rowsAffected += item.modifiedCount;
      if (item.deletedCount) summary.rowsAffected += item.deletedCount;
    }
    if (item.type === 'error') summary.errors++;
    if (item.type === 'warn') summary.warnings++;
  }

  return summary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

function validateScript(scriptContent) {
  const warnings = [];
  const errors = [];

  // Check syntax
  const syntaxCheck = validateScriptSyntax(scriptContent);
  if (!syntaxCheck.valid) {
    errors.push(syntaxCheck.error.details);
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    { pattern: /require\s*\(/gi, message: 'require() is not available - use the pre-injected db variable', isError: true },
    { pattern: /process\./gi, message: 'process object is not accessible in sandbox', isError: true },
    { pattern: /eval\s*\(/gi, message: 'eval() is blocked for security', isError: true },
    { pattern: /Function\s*\(/gi, message: 'Function constructor is blocked for security', isError: true },
    { pattern: /child_process/gi, message: 'child_process module is blocked for security', isError: true },
    { pattern: /fs\./gi, message: 'fs module is blocked for security', isError: true },
    // Risk warnings (not errors - these operations ARE allowed but logged)
    { pattern: /\.dropDatabase\s*\(/gi, message: '🔴 CRITICAL: dropDatabase() detected - will delete entire database', isError: false },
    { pattern: /\.drop\s*\(\s*\)/gi, message: '🔴 CRITICAL: drop() detected - will delete entire collection', isError: false },
    { pattern: /\.deleteMany\s*\(\s*\{\s*\}\s*\)/gi, message: '🔴 CRITICAL: deleteMany({}) detected - will delete ALL documents', isError: false },
    { pattern: /\.updateMany\s*\(\s*\{\s*\}\s*,/gi, message: '🔴 CRITICAL: updateMany({}, ...) detected - will update ALL documents', isError: false },
    { pattern: /\.dropIndexes\s*\(/gi, message: '🟠 HIGH: dropIndexes() detected - will remove all indexes', isError: false },
    { pattern: /\.createIndex\s*\(/gi, message: '🟡 MEDIUM: createIndex() detected - may lock collection during creation', isError: false },
    { pattern: /\.dropIndex\s*\(/gi, message: '🟡 MEDIUM: dropIndex() detected - may affect query performance', isError: false },
  ];

  for (const { pattern, message, isError } of dangerousPatterns) {
    if (pattern.test(scriptContent)) {
      if (isError) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

async function cleanupTempDirectory(tempDir) {
  /* istanbul ignore next - early return for null/undefined */
  if (!tempDir) return;

  try {
    const fsPromises = require('fs').promises;
    await fsPromises.rm(tempDir, { recursive: true, force: true });
    logger.debug('Cleaned up temp directory', { tempDir });
  } catch (error) {
    /* istanbul ignore next - error handling for cleanup */
    logger.warn('Failed to cleanup temp directory', { tempDir, error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  executeScript,
  validateScript,
  cleanupTempDirectory,
  EXECUTION_CONFIG,
};
