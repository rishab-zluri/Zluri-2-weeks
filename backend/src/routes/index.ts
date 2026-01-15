/**
 * Routes Index
 * Centralizes all API route definitions
 *
 * ARCHITECTURE:
 * - Exports individual routers
 * - Could mount them here if we wanted a single 'apiRouter',
 *   but typically app.ts mounts them.
 * - For now, we export them for app.ts to use.
 */

import authRoutes from './authRoutes';
import databaseRoutes from './databaseRoutes';
import queryRoutes from './queryRoutes';
import userRoutes from './userRoutes';
import secretsRoutes from './secretsRoutes';

export {
    authRoutes,
    databaseRoutes,
    queryRoutes,
    userRoutes,
    secretsRoutes,
};
