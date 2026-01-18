/**
 * Application Configuration
 * Centralized configuration management with validation
 *
 * All values are parameterized via environment variables for production deployment.
 * Default values are provided for development convenience only.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ============================================================================
// Type Definitions
// ============================================================================

export interface ServerConfig {
    readonly port: number;
    readonly host: string;
    readonly apiBaseUrl: string;
    readonly apiVersion: string;
    readonly apiPrefix: string;
}

export interface DatabaseConfig {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly user: string;
    readonly password: string;
    readonly max: number;
    readonly idleTimeoutMillis: number;
    readonly connectionTimeoutMillis: number;
    readonly ssl: false | { rejectUnauthorized: boolean };
}

export interface TargetDbConfig {
    readonly postgres: {
        readonly connectionTimeoutMs: number;
        readonly queryTimeoutMs: number;
    };
    readonly mongodb: {
        readonly connectionTimeoutMs: number;
        readonly serverSelectionTimeoutMs: number;
    };
}

export interface JwtConfig {
    readonly secret: string;
    readonly expiresIn: string;
    readonly refreshSecret: string;
    readonly refreshExpiresIn: string;
    readonly refreshExpiresInDays: number;
    readonly issuer: string;
    readonly audience: string;
}

export interface SlackConfig {
    readonly botToken: string;
    readonly approvalChannel: string;
    readonly signingSecret: string;
    readonly enabled: boolean;
}

export interface AwsConfig {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly enabled: boolean;
}

export interface RateLimitConfig {
    readonly windowMs: number;
    readonly maxRequests: number;
    readonly authMaxRequests: number;
    readonly message: string;
    readonly skipSuccessfulRequests: boolean;
    readonly standardHeaders: boolean;
    readonly legacyHeaders: boolean;
}

export interface LoggingConfig {
    readonly level: string;
    readonly format: string;
    readonly enableConsole: boolean;
    readonly enableFile: boolean;
    readonly filePath: string;
}

export interface UploadConfig {
    readonly maxFileSize: number;
    readonly uploadDir: string;
    readonly allowedExtensions: readonly string[];
    readonly cleanupIntervalMs: number;
}

export interface ScriptExecutionConfig {
    readonly timeoutMs: number;
    readonly memoryLimitMb: number;
    readonly maxConcurrent: number;
    readonly sandboxEnabled: boolean;
}

export interface CorsConfig {
    readonly origin: string | readonly string[];
    readonly credentials: boolean;
    readonly methods: readonly string[];
    readonly allowedHeaders: readonly string[];
    readonly exposedHeaders: readonly string[];
    readonly maxAge: number;
}

export interface SecurityConfig {
    readonly bcryptSaltRounds: number;
    readonly sessionSecret: string;
    readonly cookieSecure: boolean;
    readonly cookieHttpOnly: boolean;
    readonly cookieSameSite: string;
    readonly helmetEnabled: boolean;
}

export interface FrontendConfig {
    readonly url: string;
    readonly resetPasswordPath: string;
    readonly verifyEmailPath: string;
}

export interface HealthCheckConfig {
    readonly enabled: boolean;
    readonly path: string;
    readonly includeDetails: boolean;
}

export interface LoggingConfig {
    readonly level: string;
    readonly format: string;
    readonly enableConsole: boolean;
    readonly enableFile: boolean;
    readonly filePath: string;
}

export interface UploadConfig {
    readonly maxFileSize: number;
    readonly uploadDir: string;
    readonly allowedExtensions: readonly string[];
    readonly cleanupIntervalMs: number;
}

export interface ScriptExecutionConfig {
    readonly timeoutMs: number;
    readonly memoryLimitMb: number;
    readonly maxConcurrent: number;
    readonly sandboxEnabled: boolean;
}

export interface CorsConfig {
    readonly origin: string | readonly string[];
    readonly credentials: boolean;
    readonly methods: readonly string[];
    readonly allowedHeaders: readonly string[];
    readonly exposedHeaders: readonly string[];
    readonly maxAge: number;
}

export interface SecurityConfig {
    readonly bcryptSaltRounds: number;
    readonly sessionSecret: string;
    readonly cookieSecure: boolean;
    readonly cookieHttpOnly: boolean;
    readonly cookieSameSite: string;
    readonly helmetEnabled: boolean;
}

export interface FrontendConfig {
    readonly url: string;
    readonly resetPasswordPath: string;
    readonly verifyEmailPath: string;
}

export interface HealthCheckConfig {
    readonly enabled: boolean;
    readonly path: string;
    readonly includeDetails: boolean;
}

export interface AppConfig {
    readonly env: string;
    readonly isDevelopment: boolean;
    readonly isProduction: boolean;
    readonly isTest: boolean;
    readonly server: ServerConfig;
    readonly portalDb: DatabaseConfig;
    readonly targetDb: TargetDbConfig;
    readonly jwt: JwtConfig;
    readonly slack: SlackConfig;
    readonly aws: AwsConfig;
    readonly rateLimit: RateLimitConfig;
    readonly logging: LoggingConfig;
    readonly upload: UploadConfig;
    readonly scriptExecution: ScriptExecutionConfig;
    readonly cors: CorsConfig;
    readonly security: SecurityConfig;
    readonly frontend: FrontendConfig;
    readonly healthCheck: HealthCheckConfig;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates required environment variables
 * @throws {Error} If any required variable is missing
 */
/* istanbul ignore next */
function validateEnvVars(requiredVars: string[]): void {
    const missing = requiredVars.filter((varName) => !process.env[varName]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

/**
 * Parse boolean from environment variable
 */
/* istanbul ignore next */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse CORS origins from environment variable
 * Supports single origin or comma-separated multiple origins
 */
/* istanbul ignore next */
function parseCorsOrigin(value: string | undefined, defaultValue: string | string[] = '*'): string | string[] {
    if (!value) {
        return defaultValue;
    }
    if (value === '*') {
        return '*';
    }
    const origins = value.split(',').map((o) => o.trim());
    return origins.length === 1 ? origins[0] : origins;
}

/**
 * Get max file size based on environment
 * In test environment, use 1KB to allow testing LIMIT_FILE_SIZE error
 */
function getMaxFileSize(): number {
    if (process.env.NODE_ENV === 'test') {
        return 1000; // 1KB for tests
    }
    /* istanbul ignore next */
    return parseInt(process.env.MAX_FILE_SIZE || '', 10) || 16 * 1024 * 1024; // 16MB
}

// ============================================================================
// Validate Critical Environment Variables in Production
// ============================================================================

/* istanbul ignore if */
if (process.env.NODE_ENV === 'production' && !process.env.JEST_WORKER_ID) {
    const requiredVars = ['JWT_SECRET'];

    // If a full connection string is provided, specific DB params are optional
    if (!process.env.PORTAL_DB_URL) {
        requiredVars.push(
            'PORTAL_DB_HOST',
            'PORTAL_DB_NAME',
            'PORTAL_DB_USER',
            'PORTAL_DB_PASSWORD'
        );
    }

    validateEnvVars(requiredVars);
}

// ============================================================================
// Configuration Object
// ============================================================================

// Helper to parse DB URL for legacy config compatibility
const parseDbUrl = (url: string | undefined) => {
    if (!url) return null;
    try {
        const u = new URL(url);
        return {
            host: u.hostname,
            port: parseInt(u.port || '5432', 10),
            database: u.pathname.slice(1), // Remove leading slash
            user: u.username,
            password: decodeURIComponent(u.password), // Handle special chars
            ssl: u.searchParams.get('sslmode') === 'require' || u.searchParams.get('ssl') === 'true'
        };
    } catch (e) {
        return null;
    }
};

const portalUrlConfig = parseDbUrl(process.env.PORTAL_DB_URL);

/* istanbul ignore next */
const config: AppConfig = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',

    // Server Configuration
    server: {
        port: parseInt(process.env.PORT || '', 10) || 5001,
        host: process.env.HOST || '0.0.0.0',
        apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5001',
        apiVersion: process.env.API_VERSION || 'v1',
        apiPrefix: process.env.API_PREFIX || '/api',
    },

    // Portal Database (PostgreSQL)
    portalDb: {
        host: process.env.PORTAL_DB_HOST || portalUrlConfig?.host || 'localhost',
        port: parseInt(process.env.PORTAL_DB_PORT || '', 10) || portalUrlConfig?.port || 5432,
        database: process.env.PORTAL_DB_NAME || portalUrlConfig?.database || 'dev_sre_internal_portal',
        user: process.env.PORTAL_DB_USER || portalUrlConfig?.user || 'postgres',
        password: process.env.PORTAL_DB_PASSWORD || portalUrlConfig?.password || '',
        max: parseInt(process.env.PORTAL_DB_POOL_SIZE || '', 10) || 20,
        idleTimeoutMillis: parseInt(process.env.PORTAL_DB_IDLE_TIMEOUT || '', 10) || 30000,
        connectionTimeoutMillis: parseInt(process.env.PORTAL_DB_CONN_TIMEOUT || '', 10) || 5000,
        ssl: process.env.NODE_ENV === 'production' || parseBoolean(process.env.PORTAL_DB_SSL, false) || portalUrlConfig?.ssl
            ? { rejectUnauthorized: parseBoolean(process.env.PORTAL_DB_SSL_REJECT_UNAUTHORIZED, true) }
            : false,
    },

    // Target Database Configuration
    targetDb: {
        postgres: {
            connectionTimeoutMs: parseInt(process.env.TARGET_PG_CONN_TIMEOUT || '', 10) || 10000,
            queryTimeoutMs: parseInt(process.env.TARGET_PG_QUERY_TIMEOUT || '', 10) || 30000,
        },
        mongodb: {
            connectionTimeoutMs: parseInt(process.env.TARGET_MONGO_CONN_TIMEOUT || '', 10) || 10000,
            serverSelectionTimeoutMs: parseInt(process.env.TARGET_MONGO_SERVER_TIMEOUT || '', 10) || 5000,
        },
    },

    // JWT Authentication
    jwt: {
        secret: process.env.JWT_SECRET || 'default_dev_secret_change_in_production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '', 10) || 7,
        issuer: process.env.JWT_ISSUER || 'db-query-portal',
        audience: process.env.JWT_AUDIENCE || 'db-query-portal-users',
    },

    // Slack Integration
    slack: {
        botToken: process.env.SLACK_BOT_TOKEN || '',
        approvalChannel: process.env.SLACK_APPROVAL_CHANNEL || '',
        signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        enabled: parseBoolean(process.env.SLACK_ENABLED, !!process.env.SLACK_BOT_TOKEN),
    },

    // AWS Configuration
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        enabled: !!process.env.AWS_ACCESS_KEY_ID,
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '', 10) || 100,
        authMaxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '', 10) || 10,
        message: 'Too many requests, please try again later.',
        skipSuccessfulRequests: parseBoolean(process.env.RATE_LIMIT_SKIP_SUCCESS, false),
        standardHeaders: true,
        legacyHeaders: false,
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined',
        enableConsole: parseBoolean(process.env.LOG_CONSOLE, true),
        enableFile: parseBoolean(process.env.LOG_FILE, false),
        filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    },

    // File Upload
    upload: {
        maxFileSize: getMaxFileSize(),
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.js,.py').split(',').map((ext) => ext.trim()),
        cleanupIntervalMs: parseInt(process.env.UPLOAD_CLEANUP_INTERVAL || '', 10) || 3600000,
    },

    // Script Execution
    scriptExecution: {
        timeoutMs: parseInt(process.env.SCRIPT_TIMEOUT_MS || '', 10) || 30000,
        memoryLimitMb: parseInt(process.env.SCRIPT_MEMORY_LIMIT_MB || '', 10) || 128,
        maxConcurrent: parseInt(process.env.SCRIPT_MAX_CONCURRENT || '', 10) || 5,
        sandboxEnabled: parseBoolean(process.env.SCRIPT_SANDBOX_ENABLED, true),
    },

    // CORS Configuration
    cors: {
        origin: parseCorsOrigin(process.env.CORS_ORIGIN, process.env.NODE_ENV === 'production' ? '' : '*'),
        credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
        methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(','),
        allowedHeaders: (process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization,X-Requested-With').split(','),
        exposedHeaders: (process.env.CORS_EXPOSED_HEADERS || 'X-Total-Count,X-Page-Count').split(','),
        maxAge: parseInt(process.env.CORS_MAX_AGE || '', 10) || 86400,
    },

    // Security
    security: {
        bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '', 10) || 12,
        sessionSecret: process.env.SESSION_SECRET || 'default_session_secret',
        cookieSecure: parseBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
        cookieHttpOnly: parseBoolean(process.env.COOKIE_HTTP_ONLY, true),
        cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
        helmetEnabled: parseBoolean(process.env.HELMET_ENABLED, true),
    },

    // Frontend Configuration
    frontend: {
        url: process.env.FRONTEND_URL || 'http://localhost:3000',
        resetPasswordPath: process.env.FRONTEND_RESET_PASSWORD_PATH || '/reset-password',
        verifyEmailPath: process.env.FRONTEND_VERIFY_EMAIL_PATH || '/verify-email',
    },

    // Health Check
    healthCheck: {
        enabled: parseBoolean(process.env.HEALTH_CHECK_ENABLED, true),
        path: process.env.HEALTH_CHECK_PATH || '/health',
        includeDetails: parseBoolean(process.env.HEALTH_CHECK_DETAILS, process.env.NODE_ENV !== 'production'),
    },
};

// Freeze configuration to prevent modifications
Object.freeze(config);
Object.keys(config).forEach((key) => {
    const value = config[key as keyof AppConfig];
    if (typeof value === 'object' && value !== null) {
        Object.freeze(value);
    }
});

export default config;
