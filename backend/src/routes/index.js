/**
 * Routes Index
 * Central export for all route modules
 */

const authRoutes = require('./authRoutes');
const queryRoutes = require('./queryRoutes');
const userRoutes = require('./userRoutes');
const secretsRoutes = require('./secretsRoutes');

module.exports = {
  authRoutes,
  queryRoutes,
  userRoutes,
  secretsRoutes,
};
