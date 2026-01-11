/**
 * Middleware Index
 * Export all middleware from a single entry point
 */

const auth = require('./auth');
const errorHandler = require('./errorHandler');
const validation = require('./validation');
const upload = require('./upload');

module.exports = {
  ...auth,
  ...errorHandler,
  ...validation,
  ...upload,
};
