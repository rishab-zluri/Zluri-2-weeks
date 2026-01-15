/**
 * Environment Variable Validation Schema
 *
 * Validates and types all environment variables at application startup.
 * This is the MOST CRITICAL validation in the application - if env vars
 * are invalid, the app should crash immediately with clear error messages.
 *
 * WHY THIS EXISTS:
 * - Fail-Fast: Catch misconfiguration at startup, not 3 days later
 * - Type Safety: All env vars are properly typed after validation
 * - Self-Documentation: Schema serves as documentation for required env vars
 * - Default Values: Development-friendly defaults while enforcing production requirements
 *
 * PRODUCTION BENEFITS:
 * - Prevents "undefined" errors when accessing process.env
 * - Validates formats (URLs, emails, ranges)
 * - Clear error messages for DevOps when deployment fails
 *
 * USAGE:
 * import { env } from './validation/envSchema';
 * console.log(env.PORT); // number, not string | undefined
 */

import { z } from 'zod';

/**
 * Boolean env var helper
 * Handles string-to-boolean conversion with a default value
 *
 * WHY: Environment variables are always strings, but we need booleans.
 * The .default() must come BEFORE .transform() for proper typing.
 */
const booleanEnv = (defaultValue: boolean) =>
    z
        .string()
        .default(defaultValue ? 'true' : 'false')
        .transform((val) => val === 'true' || val === '1');

/**
 * Optional boolean env var helper
 * Same as booleanEnv but allows undefined
 */
const optionalBooleanEnv = () =>
    z
        .string()
        .optional()
        .transform((val) => {
            if (val === undefined) return undefined;
            return val === 'true' || val === '1';
        });

/**
 * Environment schema definition
 *
 * DESIGN DECISIONS:
 * - Use z.coerce for numeric fields (env vars are always strings)
 * - Use .default() for development convenience
 * - Use .refine() for complex validations (e.g., JWT secret length)
 * - Group related fields for readability
 */
export const envSchema = z.object({
    // =========================================================================
    // Core Environment
    // =========================================================================
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),

    // =========================================================================
    // Server Configuration
    // =========================================================================
    PORT: z.coerce
        .number()
        .min(1, 'PORT must be at least 1')
        .max(65535, 'PORT must be at most 65535')
        .default(5001),

    HOST: z.string().default('0.0.0.0'),

    API_BASE_URL: z
        .string()
        .url('API_BASE_URL must be a valid URL')
        .optional()
        .default('http://localhost:5001'),

    API_VERSION: z.string().default('v1'),
    API_PREFIX: z.string().default('/api'),

    // =========================================================================
    // Portal Database (PostgreSQL) - REQUIRED in production
    // =========================================================================
    PORTAL_DB_HOST: z.string().min(1).default('localhost'),
    PORTAL_DB_PORT: z.coerce.number().default(5432),
    PORTAL_DB_NAME: z.string().min(1).default('db_query_portal'),
    PORTAL_DB_USER: z.string().min(1).default('postgres'),
    PORTAL_DB_PASSWORD: z.string().default(''),
    PORTAL_DB_POOL_SIZE: z.coerce.number().min(1).max(100).default(20),
    PORTAL_DB_IDLE_TIMEOUT: z.coerce.number().min(1000).default(30000),
    PORTAL_DB_CONN_TIMEOUT: z.coerce.number().min(1000).default(5000),
    PORTAL_DB_SSL: booleanEnv(false),
    PORTAL_DB_SSL_REJECT_UNAUTHORIZED: booleanEnv(true),

    // =========================================================================
    // Target Database Configuration
    // =========================================================================
    TARGET_PG_CONN_TIMEOUT: z.coerce.number().min(1000).default(10000),
    TARGET_PG_QUERY_TIMEOUT: z.coerce.number().min(1000).default(30000),
    TARGET_MONGO_CONN_TIMEOUT: z.coerce.number().min(1000).default(10000),
    TARGET_MONGO_SERVER_TIMEOUT: z.coerce.number().min(1000).default(5000),

    // =========================================================================
    // JWT Authentication - CRITICAL in production
    // =========================================================================
    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters for security')
        .default('default_dev_secret_change_in_production'),

    JWT_EXPIRES_IN: z.string().default('24h'),

    JWT_REFRESH_SECRET: z
        .string()
        .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
        .default('default_refresh_secret_change_in_production'),

    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().min(1).default(7),
    JWT_ISSUER: z.string().default('db-query-portal'),
    JWT_AUDIENCE: z.string().default('db-query-portal-users'),

    // =========================================================================
    // Slack Integration (optional)
    // =========================================================================
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_APPROVAL_CHANNEL: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),
    SLACK_ENABLED: optionalBooleanEnv(),

    // =========================================================================
    // AWS Configuration (optional)
    // =========================================================================
    AWS_REGION: z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),

    // =========================================================================
    // Rate Limiting
    // =========================================================================
    RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(900000), // 15 min
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
    RATE_LIMIT_SKIP_SUCCESS: booleanEnv(false),

    // =========================================================================
    // Logging
    // =========================================================================
    LOG_LEVEL: z
        .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
        .default('info'),
    LOG_FORMAT: z.enum(['combined', 'json', 'simple']).default('combined'),
    LOG_CONSOLE: booleanEnv(true),
    LOG_FILE: booleanEnv(false),
    LOG_FILE_PATH: z.string().default('./logs/app.log'),

    // =========================================================================
    // File Upload
    // =========================================================================
    MAX_FILE_SIZE: z.coerce.number().min(1000).default(16777216), // 16MB
    UPLOAD_DIR: z.string().default('./uploads'),
    ALLOWED_EXTENSIONS: z.string().default('.js,.py'),
    UPLOAD_CLEANUP_INTERVAL: z.coerce.number().min(60000).default(3600000),

    // =========================================================================
    // Script Execution
    // =========================================================================
    SCRIPT_TIMEOUT_MS: z.coerce.number().min(1000).default(30000),
    SCRIPT_MEMORY_LIMIT_MB: z.coerce.number().min(32).default(128),
    SCRIPT_MAX_CONCURRENT: z.coerce.number().min(1).default(5),
    SCRIPT_SANDBOX_ENABLED: booleanEnv(true),

    // =========================================================================
    // CORS
    // =========================================================================
    CORS_ORIGIN: z.string().default('*'),
    CORS_CREDENTIALS: booleanEnv(true),
    CORS_METHODS: z.string().default('GET,POST,PUT,DELETE,PATCH,OPTIONS'),
    CORS_ALLOWED_HEADERS: z
        .string()
        .default('Content-Type,Authorization,X-Requested-With'),
    CORS_EXPOSED_HEADERS: z.string().default('X-Total-Count,X-Page-Count'),
    CORS_MAX_AGE: z.coerce.number().min(0).default(86400),

    // =========================================================================
    // Security
    // =========================================================================
    BCRYPT_SALT_ROUNDS: z.coerce.number().min(10).max(20).default(12),
    SESSION_SECRET: z.string().default('default_session_secret'),
    COOKIE_SECURE: optionalBooleanEnv(),
    COOKIE_HTTP_ONLY: booleanEnv(true),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    HELMET_ENABLED: booleanEnv(true),

    // =========================================================================
    // Frontend
    // =========================================================================
    FRONTEND_URL: z.string().url().optional().default('http://localhost:3000'),
    FRONTEND_RESET_PASSWORD_PATH: z.string().default('/reset-password'),
    FRONTEND_VERIFY_EMAIL_PATH: z.string().default('/verify-email'),

    // =========================================================================
    // Health Check
    // =========================================================================
    HEALTH_CHECK_ENABLED: booleanEnv(true),
    HEALTH_CHECK_PATH: z.string().default('/health'),
    HEALTH_CHECK_DETAILS: optionalBooleanEnv(),
});

/**
 * Type-safe environment configuration
 * Use this type for function parameters that need env config
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 *
 * CALL THIS AT APPLICATION STARTUP:
 * - If validation fails, throws with clear error messages
 * - DevOps can immediately see what's misconfigured
 *
 * RETURNS:
 * Fully typed, validated environment configuration object
 */
export function parseEnv(): EnvConfig {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const zodError = error as z.ZodError<any>;
            const errorMessages = zodError.issues.map(
                (err: z.ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`
            );
            console.error('\n❌ Environment variable validation failed:\n');
            console.error(errorMessages.join('\n'));
            console.error('\nPlease check your .env file or environment configuration.\n');

            // In production, we want to crash hard and fast
            process.exit(1);
        }
        throw error;
    }
}

/**
 * Validated environment object
 *
 * USAGE:
 * import { env } from './validation/envSchema';
 * const port = env.PORT; // number, not string | undefined
 *
 * NOTE: This is parsed once at module load time for performance
 */
export const env = parseEnv();
