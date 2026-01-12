/**
 * Validation Helpers
 * Common validation functions and sanitizers
 */

/**
 * Sanitize string input
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Validation result
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with details
 */
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const isValid = password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber;

  return {
    isValid,
    errors: [
      ...(password.length < minLength ? [`Password must be at least ${minLength} characters`] : []),
      ...(!hasUpperCase ? ['Password must contain at least one uppercase letter'] : []),
      ...(!hasLowerCase ? ['Password must contain at least one lowercase letter'] : []),
      ...(!hasNumber ? ['Password must contain at least one number'] : []),
    ],
  };
};

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} Validation result
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate database type
 * @param {string} type - Database type
 * @returns {boolean} Validation result
 */
const isValidDatabaseType = (type) => {
  /* istanbul ignore if */
  if (typeof type !== 'string') return false;
  const validTypes = ['postgresql', 'mongodb'];
  return validTypes.includes(type.toLowerCase());
};

/**
 * Validate submission type
 * @param {string} type - Submission type
 * @returns {boolean} Validation result
 */
const isValidSubmissionType = (type) => {
  /* istanbul ignore if */
  if (typeof type !== 'string') return false;
  const validTypes = ['query', 'script'];
  return validTypes.includes(type.toLowerCase());
};

/**
 * Validate status value
 * @param {string} status - Status value
 * @returns {boolean} Validation result
 */
const isValidStatus = (status) => {
  /* istanbul ignore if */
  if (typeof status !== 'string') return false;
  const validStatuses = ['pending', 'approved', 'rejected', 'executing', 'completed', 'failed'];
  return validStatuses.includes(status.toLowerCase());
};

/**
 * Sanitize SQL query (basic - removes obvious dangerous patterns)
 * Note: This is NOT a substitute for proper query parameterization
 * @param {string} query - SQL query
 * @returns {string} Sanitized query
 */
const sanitizeQuery = (query) => {
  if (typeof query !== 'string') return '';
  // Remove comments
  let sanitized = query.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Trim whitespace
  sanitized = sanitized.trim();
  return sanitized;
};

/**
 * Check if query contains dangerous patterns
 * @param {string} query - Query to check
 * @returns {Object} Check result with warnings
 */
const checkQuerySafety = (query) => {
  /* istanbul ignore if */
  if (typeof query !== 'string') {
    return { hasDangerousPatterns: false, warnings: [] };
  }
  const warnings = [];
  const queryLower = query.toLowerCase();

  // Check for DROP statements
  if (/\bdrop\s+(table|database|index|schema)\b/i.test(query)) {
    warnings.push('Query contains DROP statement - this is a destructive operation');
  }

  // Check for TRUNCATE
  if (/\btruncate\s+table\b/i.test(query)) {
    warnings.push('Query contains TRUNCATE statement - this will delete all data');
  }

  // Check for DELETE without WHERE
  if (/\bdelete\s+from\b/i.test(query) && !/\bwhere\b/i.test(query)) {
    warnings.push('DELETE statement without WHERE clause - this will delete all rows');
  }

  // Check for UPDATE without WHERE
  if (/\bupdate\s+\w+\s+set\b/i.test(query) && !/\bwhere\b/i.test(query)) {
    warnings.push('UPDATE statement without WHERE clause - this will update all rows');
  }

  return {
    hasDangerousPatterns: warnings.length > 0,
    warnings,
  };
};

/**
 * Validate file extension
 * @param {string} filename - Filename to check
 * @param {Array} allowedExtensions - Array of allowed extensions
 * @returns {boolean} Validation result
 */
const isValidFileExtension = (filename, allowedExtensions = ['.js', '.py']) => {
  /* istanbul ignore if */
  if (typeof filename !== 'string') return false;
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return allowedExtensions.includes(ext);
};

/**
 * Parse pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Parsed pagination
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Validate email (alias for isValidEmail)
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
const validateEmail = isValidEmail;

/**
 * Sanitize input string for XSS prevention
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
/* istanbul ignore next */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/[<>]/g, '');
};

/**
 * Sanitize MongoDB query for NoSQL injection prevention
 * @param {string} query - Query to sanitize
 * @returns {string} Sanitized query
 */
/* istanbul ignore next */
const sanitizeMongoQuery = (query) => {
  if (typeof query !== 'string') return '';
  // Remove dangerous MongoDB operators
  return query
    .replace(/\$where/gi, '')
    .replace(/\$gt/gi, '')
    .replace(/\$ne/gi, '')
    .replace(/\$or/gi, '');
};

/**
 * Sanitize file path to prevent path traversal
 * @param {string} path - Path to sanitize
 * @returns {string} Sanitized path
 */
/* istanbul ignore next */
const sanitizePath = (path) => {
  if (typeof path !== 'string') return '';
  return path
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/%2e%2e/gi, '')
    .replace(/%252f/gi, '/')
    .replace(/\/etc\//gi, '')
    .replace(/\\Windows\\/gi, '');
};

/**
 * Validate query length to prevent DoS
 * @param {string} query - Query to check
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} True if within limits
 */
/* istanbul ignore next */
const validateQueryLength = (query, maxLength = 50000) => {
  if (typeof query !== 'string') return false;
  return query.length <= maxLength;
};

module.exports = {
  sanitizeString,
  isValidEmail,
  validateEmail,
  validatePassword,
  isValidUUID,
  isValidDatabaseType,
  isValidSubmissionType,
  isValidStatus,
  sanitizeQuery,
  sanitizeInput,
  sanitizeMongoQuery,
  sanitizePath,
  validateQueryLength,
  checkQuerySafety,
  isValidFileExtension,
  parsePagination,
};