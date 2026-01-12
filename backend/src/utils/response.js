/**
 * API Response Helpers
 * Standardized response format for all API endpoints
 */

/**
 * Success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Created response - 201
 * @param {Object} res - Express response object
 * @param {Object} data - Created resource data
 * @param {string} message - Success message
 */
const created = (res, data = null, message = 'Resource created successfully') => {
  return success(res, data, message, 201);
};

/**
 * No content response - 204
 * @param {Object} res - Express response object
 */
const noContent = (res) => {
  return res.status(204).send();
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {Array} errors - Validation errors array
 */
const error = (res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', errors = null) => {
  const response = {
    success: false,
    message,
    code,
    ...(errors && { errors }),
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination info
 * @param {string} message - Success message
 */
const paginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1,
    },
  });
};

module.exports = {
  success,
  created,
  noContent,
  error,
  paginated,
};
