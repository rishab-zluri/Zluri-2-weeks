/**
 * Script Security Configuration
 * 
 * Centralized security settings for script execution sandbox.
 * This module contains all security-related constants and configurations
 * used by both JavaScript and Python script workers.
 * 
 * SECURITY PHILOSOPHY:
 * - Defense in depth: Multiple layers of protection
 * - Fail-safe defaults: Block by default, allow explicitly
 * - Principle of least privilege: Minimal access rights
 * 
 * @module services/script/security
 */

// =============================================================================
// EXECUTION LIMITS
// =============================================================================

/**
 * Memory and resource limits for script execution
 */
export const EXECUTION_LIMITS = {
    /**
     * Maximum heap memory in MB for child process
     * Prevents memory exhaustion attacks
     * Note: Set to 512MB as MongoDB driver + ts-node compilation needs ~300-400MB
     */
    MAX_MEMORY_MB: 512,

    /**
     * Default execution timeout in milliseconds
     * Prevents infinite loop CPU exhaustion
     */
    TIMEOUT_MS: 30000,

    /**
     * Buffer time added to timeout for cleanup
     */
    TIMEOUT_BUFFER_MS: 5000,

    /**
     * Maximum setTimeout delay allowed in scripts
     */
    MAX_SETTIMEOUT_MS: 5000,

    /**
     * Maximum documents to return from MongoDB find()
     */
    MAX_MONGO_DOCS: 1000,

    /**
     * Maximum query result rows for logging
     */
    MAX_LOGGED_ROWS: 100,
} as const;

// =============================================================================
// DANGEROUS PATTERN DEFINITIONS
// =============================================================================

/**
 * Pattern definition for validation
 */
export interface DangerousPattern {
    /** Regex pattern to match */
    pattern: RegExp;
    /** Human-readable message */
    message: string;
    /** If true, blocks execution. If false, logs warning */
    isError: boolean;
    /** Category for grouping */
    category: 'rce' | 'filesystem' | 'network' | 'destructive' | 'prototype';
}

/**
 * JavaScript-specific dangerous patterns
 * 
 * These patterns are checked BEFORE script execution
 * to prevent known attack vectors.
 */
export const JS_DANGEROUS_PATTERNS: DangerousPattern[] = [
    // Remote Code Execution (RCE)
    { pattern: /\brequire\s*\(/gi, message: 'require() is not available', isError: true, category: 'rce' },
    { pattern: /\beval\s*\(/gi, message: 'eval() is blocked', isError: true, category: 'rce' },
    { pattern: /\bFunction\s*\(/gi, message: 'Function constructor is blocked', isError: true, category: 'rce' },
    { pattern: /\bnew\s+Function\s*\(/gi, message: 'new Function() is blocked', isError: true, category: 'rce' },

    // Process/System Access
    { pattern: /\bprocess\./gi, message: 'process object is not accessible', isError: true, category: 'rce' },
    { pattern: /\bglobal\./gi, message: 'global object is not accessible', isError: true, category: 'rce' },
    { pattern: /\bglobalThis\./gi, message: 'globalThis is not accessible', isError: true, category: 'rce' },
    { pattern: /\bBuffer\./gi, message: 'Buffer is not accessible', isError: true, category: 'rce' },

    // Module System
    { pattern: /\bchild_process/gi, message: 'child_process is blocked', isError: true, category: 'rce' },
    { pattern: /\bimport\s*\(/gi, message: 'dynamic import() is blocked', isError: true, category: 'rce' },
    { pattern: /\bimport\s+.*\s+from/gi, message: 'ES6 import is blocked', isError: true, category: 'rce' },

    // Filesystem
    { pattern: /\bfs\./gi, message: 'fs module is blocked', isError: true, category: 'filesystem' },
    { pattern: /\bpath\./gi, message: 'path module is blocked', isError: true, category: 'filesystem' },
    { pattern: /\b__dirname\b/gi, message: '__dirname is not accessible', isError: true, category: 'filesystem' },
    { pattern: /\b__filename\b/gi, message: '__filename is not accessible', isError: true, category: 'filesystem' },

    // Network
    { pattern: /\bhttp\./gi, message: 'http module is blocked', isError: true, category: 'network' },
    { pattern: /\bhttps\./gi, message: 'https module is blocked', isError: true, category: 'network' },
    { pattern: /\bnet\./gi, message: 'net module is blocked', isError: true, category: 'network' },
    { pattern: /\bfetch\s*\(/gi, message: 'fetch() is blocked', isError: true, category: 'network' },
    { pattern: /\bXMLHttpRequest/gi, message: 'XMLHttpRequest is blocked', isError: true, category: 'network' },
    { pattern: /\bWebSocket/gi, message: 'WebSocket is blocked', isError: true, category: 'network' },

    // Prototype Attacks
    { pattern: /\bconstructor\s*\.\s*constructor/gi, message: 'Constructor chain access blocked', isError: true, category: 'prototype' },
    { pattern: /__proto__/gi, message: '__proto__ access blocked', isError: true, category: 'prototype' },
    { pattern: /\bObject\s*\.\s*setPrototypeOf/gi, message: 'Object.setPrototypeOf blocked', isError: true, category: 'prototype' },
    { pattern: /\bObject\s*\.\s*defineProperty/gi, message: 'Object.defineProperty blocked', isError: true, category: 'prototype' },
    { pattern: /\bObject\s*\.\s*getOwnPropertyDescriptor/gi, message: 'Object.getOwnPropertyDescriptor blocked', isError: true, category: 'prototype' },
    { pattern: /\bReflect\s*\./gi, message: 'Reflect API is blocked', isError: true, category: 'prototype' },
    { pattern: /\bProxy\s*\(/gi, message: 'Proxy is blocked', isError: true, category: 'prototype' },

    // Destructive Database Operations (Warnings)
    { pattern: /\.dropDatabase\s*\(/gi, message: '🔴 CRITICAL: dropDatabase() detected', isError: false, category: 'destructive' },
    { pattern: /\.drop\s*\(\s*\)/gi, message: '🔴 CRITICAL: drop() detected', isError: false, category: 'destructive' },
    { pattern: /\.deleteMany\s*\(\s*\{\s*\}\s*\)/gi, message: '🔴 CRITICAL: deleteMany({}) - deletes ALL documents', isError: false, category: 'destructive' },
    { pattern: /DROP\s+TABLE/gi, message: '🔴 CRITICAL: DROP TABLE detected', isError: false, category: 'destructive' },
    { pattern: /DROP\s+DATABASE/gi, message: '🔴 CRITICAL: DROP DATABASE detected', isError: false, category: 'destructive' },
    { pattern: /TRUNCATE\s+TABLE/gi, message: '🔴 CRITICAL: TRUNCATE TABLE detected', isError: false, category: 'destructive' },
    { pattern: /DELETE\s+FROM\s+\w+\s*(;|$)/gi, message: '🔴 CRITICAL: DELETE without WHERE clause', isError: false, category: 'destructive' },
];

/**
 * Python-specific dangerous patterns
 */
export const PYTHON_DANGEROUS_PATTERNS: DangerousPattern[] = [
    // RCE
    { pattern: /\bopen\s*\(/gi, message: 'open() is not available', isError: true, category: 'filesystem' },
    { pattern: /\bexec\s*\(/gi, message: 'exec() is blocked', isError: true, category: 'rce' },
    { pattern: /\beval\s*\(/gi, message: 'eval() is blocked', isError: true, category: 'rce' },
    { pattern: /\bcompile\s*\(/gi, message: 'compile() is blocked', isError: true, category: 'rce' },
    { pattern: /__import__/gi, message: '__import__ is blocked', isError: true, category: 'rce' },
    { pattern: /\bgetattr\s*\(.*,\s*['"]__/gi, message: 'getattr with dunder access blocked', isError: true, category: 'rce' },

    // Module System
    { pattern: /\bsubprocess/gi, message: 'subprocess is blocked', isError: true, category: 'rce' },
    { pattern: /\bos\./gi, message: 'os module is blocked', isError: true, category: 'filesystem' },
    { pattern: /\bsys\./gi, message: 'sys module is blocked', isError: true, category: 'rce' },
    { pattern: /\bshutil\./gi, message: 'shutil module is blocked', isError: true, category: 'filesystem' },

    // Network
    { pattern: /\bsocket/gi, message: 'socket is blocked', isError: true, category: 'network' },
    { pattern: /\burllib/gi, message: 'urllib is blocked', isError: true, category: 'network' },
    { pattern: /\brequests\./gi, message: 'requests module is blocked', isError: true, category: 'network' },
    { pattern: /\bhttplib/gi, message: 'httplib is blocked', isError: true, category: 'network' },

    // Destructive (Warnings)
    { pattern: /\.drop_database\s*\(/gi, message: '🔴 CRITICAL: drop_database() detected', isError: false, category: 'destructive' },
    { pattern: /\.drop\s*\(/gi, message: '🔴 CRITICAL: drop() detected', isError: false, category: 'destructive' },
    { pattern: /\.delete_many\s*\(\s*\{\s*\}\s*\)/gi, message: '🔴 CRITICAL: delete_many({}) detected', isError: false, category: 'destructive' },
];

// =============================================================================
// SANDBOX GLOBALS
// =============================================================================

/**
 * Safe built-in objects to expose in JavaScript sandbox
 * 
 * These are FROZEN copies to prevent prototype pollution
 */
export const SAFE_JS_GLOBALS = [
    'JSON',
    'Math',
    'Date',
    'Array',
    'Object',
    'String',
    'Number',
    'Boolean',
    'RegExp',
    'Map',
    'Set',
    'Promise',
    'Error',
    'TypeError',
    'RangeError',
    'SyntaxError',
    'parseInt',
    'parseFloat',
    'isNaN',
    'isFinite',
    'encodeURIComponent',
    'decodeURIComponent',
] as const;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Result of pattern validation
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    blockedPatterns: Array<{
        pattern: string;
        message: string;
        category: string;
    }>;
}

/**
 * Validate script content against dangerous patterns
 */
export function validatePatterns(
    scriptContent: string,
    patterns: DangerousPattern[]
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const blockedPatterns: Array<{ pattern: string; message: string; category: string }> = [];

    for (const { pattern, message, isError, category } of patterns) {
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;

        if (pattern.test(scriptContent)) {
            if (isError) {
                errors.push(message);
                blockedPatterns.push({
                    pattern: pattern.source,
                    message,
                    category
                });
            } else {
                warnings.push(message);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        blockedPatterns
    };
}

/**
 * Validate JavaScript script
 */
export function validateJavaScript(scriptContent: string): ValidationResult {
    return validatePatterns(scriptContent, JS_DANGEROUS_PATTERNS);
}

/**
 * Validate Python script 
 */
export function validatePythonScript(scriptContent: string): ValidationResult {
    return validatePatterns(scriptContent, PYTHON_DANGEROUS_PATTERNS);
}

// =============================================================================
// PROCESS OPTIONS
// =============================================================================

/**
 * Get secure fork options for JavaScript child process
 * 
 * In development mode (ts-node), we need to pass ts-node/register
 * to the child process so it can execute TypeScript files.
 */
export function getSecureForkOptions(): {
    execArgv: string[];
    env: NodeJS.ProcessEnv;
} {
    const isDevMode = process.argv.some(arg => arg.includes('ts-node'));

    const baseArgs = [
        // Memory limit - CRITICAL: Must be first arg
        `--max-old-space-size=${EXECUTION_LIMITS.MAX_MEMORY_MB}`,
        // Disable inspector/debugger
        '--no-inspect',
    ];

    // In dev mode, add ts-node register for TypeScript support
    if (isDevMode) {
        baseArgs.push('--require', 'ts-node/register');
    }

    return {
        execArgv: baseArgs,
        env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'production',
            // Disable ts-node type checking in child for faster startup
            TS_NODE_TRANSPILE_ONLY: 'true',
            // Clear sensitive env vars from child process
            JWT_SECRET: undefined,
            JWT_ACCESS_SECRET: undefined,
            JWT_REFRESH_SECRET: undefined,
            DATABASE_URL: undefined,
        } as NodeJS.ProcessEnv
    };
}

/**
 * Get secure spawn options for Python child process
 */
export function getSecureSpawnOptions(): {
    env: NodeJS.ProcessEnv;
} {
    return {
        env: {
            ...process.env,
            // Clear sensitive env vars
            JWT_SECRET: undefined,
            JWT_ACCESS_SECRET: undefined,
            JWT_REFRESH_SECRET: undefined,
        } as NodeJS.ProcessEnv
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    EXECUTION_LIMITS,
    JS_DANGEROUS_PATTERNS,
    PYTHON_DANGEROUS_PATTERNS,
    SAFE_JS_GLOBALS,
    validatePatterns,
    validateJavaScript,
    validatePythonScript,
    getSecureForkOptions,
    getSecureSpawnOptions,
};
