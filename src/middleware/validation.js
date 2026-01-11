/**
 * Validation Middleware
 * Request validation using express-validator
 * 
 * SECURITY: Uses UUID validation to prevent enumeration attacks
 */

const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');
const response = require('../utils/response');

/**
 * Validate request and return errors if any
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));
    
    return response.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', formattedErrors);
  }
  
  next();
};

/**
 * Authentication validations
 */
const authValidations = {
  login: [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 1 })
      .withMessage('Password cannot be empty'),
  ],

  register: [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('podId')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('POD ID cannot be empty if provided'),
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
  ],
};

/**
 * Query request validations
 * 
 * SECURITY NOTE: We use UUID validation instead of integer IDs to prevent:
 * - Enumeration attacks (attackers can't guess IDs like 1, 2, 3...)
 * - Information disclosure (doesn't reveal how many records exist)
 * - Unauthorized access attempts via ID manipulation
 */
const queryRequestValidations = {
  create: [
    body('instanceId')
      .trim()
      .notEmpty()
      .withMessage('Instance ID is required'),
    body('databaseName')
      .trim()
      .notEmpty()
      .withMessage('Database name is required'),
    body('submissionType')
      .trim()
      .isIn(['query', 'script'])
      .withMessage('Submission type must be either "query" or "script"'),
    body('queryContent')
      .if(body('submissionType').equals('query'))
      .notEmpty()
      .withMessage('Query content is required for query submissions')
      .isLength({ max: 100000 })
      .withMessage('Query content must not exceed 100000 characters'),
    body('comments')
      .trim()
      .notEmpty()
      .withMessage('Comments are required')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Comments must be between 10 and 5000 characters'),
    body('podId')
      .trim()
      .notEmpty()
      .withMessage('POD ID is required'),
  ],

  // SECURE: UUID-only validation prevents enumeration attacks
  approve: [
    param('uuid')
      .isUUID()
      .withMessage('Valid UUID is required'),
  ],

  // SECURE: UUID-only validation prevents enumeration attacks
  reject: [
    param('uuid')
      .isUUID()
      .withMessage('Valid UUID is required'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Rejection reason must not exceed 1000 characters'),
  ],

  // SECURE: UUID-only validation prevents enumeration attacks
  getById: [
    param('uuid')
      .isUUID()
      .withMessage('Valid UUID is required'),
  ],

  list: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'executing', 'completed', 'failed'])
      .withMessage('Invalid status value'),
    query('podId')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('POD ID cannot be empty if provided'),
  ],
};

/**
 * User management validations
 */
const userValidations = {
  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('slackUserId')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Slack user ID must not exceed 50 characters'),
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('New password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('New password must contain at least one number'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match'),
  ],

  adminUpdate: [
    param('id')
      .isUUID()
      .withMessage('Valid user ID is required'),
    body('role')
      .optional()
      .isIn(['developer', 'manager', 'admin'])
      .withMessage('Invalid role'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('podId')
      .optional()
      .trim(),
  ],
};

/**
 * Instance validations
 */
const instanceValidations = {
  getByType: [
    query('type')
      .optional()
      .isIn(['postgresql', 'mongodb'])
      .withMessage('Type must be either "postgresql" or "mongodb"'),
  ],

  getDatabases: [
    param('instanceId')
      .trim()
      .notEmpty()
      .withMessage('Instance ID is required'),
  ],
};

/**
 * Sanitize potentially dangerous input
 */
const sanitizeInput = (req, res, next) => {
  // Recursively sanitize object
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potential XSS vectors
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip sanitization for certain fields
        if (['queryContent', 'scriptContent', 'password', 'currentPassword', 'newPassword'].includes(key)) {
          sanitized[key] = value;
        } else {
          sanitized[key] = sanitize(value);
        }
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

module.exports = {
  validate,
  authValidations,
  queryRequestValidations,
  userValidations,
  instanceValidations,
  sanitizeInput,
};