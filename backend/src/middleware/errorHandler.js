/**
 * Error Handling Middleware
 * Global error handler for all routes
 */

const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Handle 404 Not Found
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
  });
};

/**
 * Handle async errors in routes
 * @param {Function} fn - Async route handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Development error response with full details
 */
/* istanbul ignore next */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    code: err.code || 'INTERNAL_ERROR',
    error: err,
    stack: err.stack,
  });
};

/**
 * Production error response with minimal details
 */
const sendErrorProd = (err, res) => {
  // Operational error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.errors && { errors: err.errors }),
    });
  } else {
    // Programming or unknown error: don't leak details
    logger.error('Unexpected error', { error: err });
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Handle specific error types
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_INPUT');
};

const handleDuplicateKeyError = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 409, 'DUPLICATE_VALUE');
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  // Log error
  if (err.statusCode >= 500) {
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      user: req.user?.id,
    });
  } else {
    logger.warn('Client error', {
      error: err.message,
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
    });
  }

  if (config.isDevelopment || config.isTest) {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, message: err.message };

    // Handle specific error types
    if (err.name === 'CastError') error = handleCastError(err);
    if (err.code === '23505') error = handleDuplicateKeyError(err);
    if (err.name === 'ValidationError') error = handleValidationError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = {
  notFound,
  asyncHandler,
  errorHandler,
};