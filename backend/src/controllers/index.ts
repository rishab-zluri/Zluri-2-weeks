/**
 * Controllers Index
 * Export all controllers from a single entry point
 *
 * ARCHITECTURE:
 * - Centralized exports for route definitions
 * - Types export if needed
 */

import authController from './authController';
import databaseController from './databaseController';
import queryController from './queryController';
import * as userController from './userController';

export {
    authController,
    databaseController,
    queryController,
    userController,
};
