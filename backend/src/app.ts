/**
 * Express Application Configuration
 *
 * Configures middleware, security, routes, and error handling.
 * Separated from server startup for better testability.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
// @ts-ignore: hpp does not have types installed
import hpp from 'hpp';
// @ts-ignore: xss-clean does not have types
import xss from 'xss-clean';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import config from './config';
import logger from './utils/logger';
import { errorHandler as globalErrorHandler, notFound as notFoundHandler } from './middleware/errorHandler';
// Import routes from index to ensure all are included
import { authRoutes, queryRoutes, userRoutes, secretsRoutes, databaseRoutes } from './routes';
import { testConnection } from './config/database'; // Legacy connection check, will be replaced/augmented by MikroORM check in server.ts or here?
import * as databaseSyncService from './services/databaseSyncService';
import { getORM } from './db';
import { RequestContext } from '@mikro-orm/core';
import { swaggerSpec } from './config/swagger';

// Initialize Express app
const app: Express = express();

// MikroORM Context - MUST be applied early
app.use((req, res, next) => {
    RequestContext.create(getORM().em, next);
});

// =============================================================================
// Security Middleware
// =============================================================================

// Set security HTTP headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// Enable CORS with dynamic origin check
const corsOptions: cors.CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, origin?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin];
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
    maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// =============================================================================
// Rate Limiting
// =============================================================================

const generalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => config.isDevelopment,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // 10 attempts per 15 minutes
    message: {
        success: false,
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// =============================================================================
// Request Parsing & Sanitization
// =============================================================================

// Prevent HTTP Parameter Pollution
app.use(hpp({
    whitelist: ['status', 'podId', 'databaseType', 'sort', 'order'],
}));

// Data sanitization against XSS
app.use(xss());

// Body parser with size limits
// Note: Increased to 20MB to support 16MB max script file submissions
app.use(express.json({
    limit: '20mb',
    verify: (req: Request, res: Response, buf: Buffer) => {
        (req as any).rawBody = buf;
    },
}));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Cookie parser for HttpOnly cookie-based auth
app.use(cookieParser());

// Compression for responses
app.use(compression({
    filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    level: 6,
}));

// =============================================================================
// Logging
// =============================================================================

if (config.isDevelopment) {
    app.use(morgan('dev'));
} else {
    // Custom morgan format for production
    app.use(morgan(
        ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
        {
            stream: {
                write: (message: string) => logger.http(message.trim()),
            },
            skip: (req: Request, res: Response) => res.statusCode < 400, // Only log errors in production to reduce noise
        }
    ));
}

// =============================================================================
// Documentation
// =============================================================================

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs-json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// =============================================================================
// Health Checks
// =============================================================================

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.env,
        version: process.env.npm_package_version || '1.0.0',
    });
});

// Detailed health check (Included here for now, but depends on DB connection)
// In a pure 'app' file, we might inject these dependencies, but for simplicity
// we'll import them. Note: testConnection is the legacy PG check.
// TODO: Update to check MikroORM connection when ready.
app.get('/health/detailed', async (req: Request, res: Response) => {
    try {
        const dbHealthy = await testConnection();
        const syncStatus = databaseSyncService.getSyncStatus();

        res.status(dbHealthy ? 200 : 503).json({
            success: dbHealthy,
            status: dbHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            environment: config.env,
            checks: {
                database: dbHealthy ? 'connected' : 'disconnected',
                databaseSync: {
                    isRunning: syncStatus.isRunning,
                    lastSyncAt: syncStatus.lastSyncAt,
                    nextSyncAt: syncStatus.nextSyncAt,
                    instancesCached: syncStatus.instancesCached || 0,
                },
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
                },
                uptime: Math.round(process.uptime()) + 's',
            },
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: (error as Error).message,
        });
    }
});

// =============================================================================
// Routes
// =============================================================================

// API versioning - v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/queries', queryRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/secrets', secretsRoutes);
app.use('/api/v1/databases', databaseRoutes); // Use the new databaseRoutes module

// Backwards compatibility
app.use('/api/auth', authRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/secrets', secretsRoutes);
app.use('/api/databases', databaseRoutes);

// =============================================================================
// Error Handling
// =============================================================================

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
