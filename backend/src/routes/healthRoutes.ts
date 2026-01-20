/**
 * Health Check Routes
 * 
 * Provides health status endpoints for monitoring and alerting
 */

import express, { Request, Response } from 'express';
import { getHealthStatus, forceHealthCheck } from '../services/healthMonitor';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../entities/User';
import * as response from '../utils/response';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Simple endpoint that returns 200 if server is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', async (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health status including all subsystems
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: object
 *                       properties:
 *                         healthy:
 *                           type: boolean
 *                         timestamp:
 *                           type: string
 *                         checks:
 *                           type: object
 *                         errors:
 *                           type: array
 *                     history:
 *                       type: object
 */
router.get('/detailed', authenticate, async (req: Request, res: Response) => {
    try {
        const healthStatus = await getHealthStatus();
        response.success(res, healthStatus);
    } catch (error) {
        const err = error as Error;
        logger.error('Health check error', { error: err.message });
        response.error(res, 'Health check failed', 500);
    }
});

/**
 * @swagger
 * /health/force-check:
 *   post:
 *     summary: Force a health check
 *     description: Manually trigger a health check (Admin only)
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Health check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.post(
    '/force-check',
    authenticate,
    requireRole(UserRole.ADMIN),
    async (req: Request, res: Response) => {
        try {
            const result = await forceHealthCheck();
            response.success(res, result, 'Health check completed');
        } catch (error) {
            const err = error as Error;
            logger.error('Force health check error', { error: err.message });
            response.error(res, 'Health check failed', 500);
        }
    }
);

export default router;
