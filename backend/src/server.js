/**
 * Database Query Execution Portal - Main Server Entry Point
 * 
 * Production-ready Express server with comprehensive security,
 * logging, and error handling configuration.
 */

require('dotenv').config({ path: '.env' });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const xss = require('xss-clean');

const config = require('./config');
const { testConnection } = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler: globalErrorHandler, notFound: notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const { authRoutes, queryRoutes, userRoutes, secretsRoutes } = require('./routes');

// Import database sync service for hybrid approach
const databaseSyncService = require('./services/databaseSyncService');

// Import auth middleware for token cleanup
const { cleanupExpiredTokens } = require('./middleware/auth');

// Initialize Express app
const app = express();

// ==================== Security Middleware ====================

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

// Enable CORS with specific origins
const corsOptions = {
  origin: function (origin, callback) {
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

// Rate limiting - different limits for different routes
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
  skip: (req) => config.isDevelopment, // Skip in development
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
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

// Prevent HTTP Parameter Pollution
app.use(hpp({
  whitelist: ['status', 'podId', 'databaseType', 'sort', 'order'],
}));

// Data sanitization against XSS
app.use(xss());

// ==================== Body Parsing & Compression ====================

// Body parser with size limits
app.use(express.json({ 
  limit: '10kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Compression for responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
}));

// ==================== Logging ====================

// HTTP request logging
if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  // Custom morgan format for production
  app.use(morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
    {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
      skip: (req, res) => res.statusCode < 400, // Only log errors in production
    }
  ));
}

// ==================== Health Check ====================

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Detailed health check for monitoring
app.get('/health/detailed', async (req, res) => {
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
      error: error.message,
    });
  }
});

// ==================== API Routes ====================

// API versioning - v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/queries', queryRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/secrets', secretsRoutes);

// Also support non-versioned routes for backwards compatibility
app.use('/api/auth', authRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/secrets', secretsRoutes);

// ==================== Error Handling ====================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// ==================== Background Tasks ====================

let tokenCleanupInterval = null;

/**
 * Start background tasks after server is ready
 */
const startBackgroundTasks = () => {
  // Start database sync scheduler (hybrid approach)
  // Syncs database instances from AWS Secrets Manager periodically
  databaseSyncService.startPeriodicSync();
  logger.info('Database sync scheduler started');
  
  // Schedule refresh token cleanup every hour
  tokenCleanupInterval = setInterval(async () => {
    try {
      const deletedCount = await cleanupExpiredTokens();
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired refresh tokens`);
      }
    } catch (error) {
      logger.warn('Token cleanup failed:', error.message);
    }
  }, 60 * 60 * 1000); // Every hour
  
  logger.info('Background tasks started');
};

/**
 * Stop background tasks
 */
const stopBackgroundTasks = () => {
  // Stop database sync scheduler
  databaseSyncService.stopPeriodicSync();
  logger.info('Database sync scheduler stopped');
  
  // Clear token cleanup interval
  if (tokenCleanupInterval) {
    clearInterval(tokenCleanupInterval);
    tokenCleanupInterval = null;
    logger.info('Token cleanup scheduler stopped');
  }
};

// ==================== Graceful Shutdown ====================

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop background tasks first
  stopBackgroundTasks();
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server close:', err);
      process.exit(1);
    }
    
    logger.info('HTTP server closed.');
    
    // Close database connections
    const { pool } = require('./config/database');
    pool.end(() => {
      logger.info('Database pool closed.');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// ==================== Server Startup ====================

const PORT = config.server.port;
let server;

const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('Database connection established successfully');
    
    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`Server running in ${config.env} mode on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
      logger.info(`API available at http://localhost:${PORT}/api/v1`);
      
      // Start background tasks after server is listening
      startBackgroundTasks();
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app; // Export for testing