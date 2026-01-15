/**
 * Secrets Routes - AWS Secrets Manager integration
 */

import express, { Request, Response } from 'express';
import * as auth from '../middleware/auth';

const router = express.Router();

// Mock secrets data (in production, this would connect to AWS Secrets Manager)
const MOCK_SECRETS = [
    '/dev/eksfargate/dev-kafka-microservices-secrets-manager',
    '/dev/eksfargate/dev-cupid-secrets-manager',
    '/dev/eksfargate/dev-dashboard-api-secrets',
    '/dev/eksfargate/dev-dashboard-app-secrets-manager',
    '/dev/eksfargate/dev-integrations-secrets-manager',
    '/dev/eksfargate/dev-node-jobs-secrets-manager',
    '/dev/eksfargate/dev-dashboard-auth-secrets-manager',
    '/dev/eksfargate/dev-n8n-secrets-manager',
    '/dev/eks/dev-support-login-secrets-manager',
    '/stag/eks/stag-support-login-secrets-manager',
    '/stag/eksfargate/stag-bull-scheduler-secrets-manager',
    '/dev/eksfargate/dev-monitoring-dashboard-app-secrets',
    '/dev/eks/monitoring-dashboard-api-secrets',
    '/dev/eks/zluri-ai-bot-secrets',
    '/stag/eksfargate/stag-dashboard-app-secrets-manager',
    '/dev/eksfargate/dev-integration-webhooks-secrets-manager',
    '/prod/eksfargate/prod-kafka-microservices-secrets-manager',
    '/prod/eksfargate/prod-dashboard-api-secrets',
    '/prod/eksfargate/prod-dashboard-app-secrets-manager',
    '/prod/eksfargate/prod-integrations-secrets-manager',
    // Additional mock secrets for variety
    ...Array.from({ length: 55 }, (_, i) => `/dev/eksfargate/dev-service-${i + 1}-secrets-manager`),
];

/**
 * @route GET /api/secrets
 * @desc List all available secrets
 * @access Private
 */
router.get('/', auth.authenticate, async (req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            data: {
                secrets: MOCK_SECRETS,
                count: MOCK_SECRETS.length,
            },
        });
    } catch (error) {
        // istanbul ignore next
        console.error('Error listing secrets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list secrets',
            error: (error as Error).message,
        });
    }
});

/**
 * @route GET /api/secrets/search
 * @desc Search secrets by name
 * @access Private
 */
router.get('/search', auth.authenticate, async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        if (!q) {
            res.json({
                success: true,
                data: {
                    secrets: MOCK_SECRETS,
                    count: MOCK_SECRETS.length,
                },
            });
            return;
        }

        const query = (q as string).toLowerCase();
        const filteredSecrets = MOCK_SECRETS.filter(secret =>
            secret.toLowerCase().includes(query)
        );

        res.json({
            success: true,
            data: {
                secrets: filteredSecrets,
                count: filteredSecrets.length,
                query: q,
            },
        });
    } catch (error) {
        // istanbul ignore next
        console.error('Error searching secrets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search secrets',
            error: (error as Error).message,
        });
    }
});

/**
 * @route GET /api/secrets/:secretName
 * @desc Get a specific secret value
 * @access Private
 */
router.get('/:secretName(*)', auth.authenticate, async (req: Request, res: Response) => {
    try {
        const { secretName } = req.params;
        const decodedName = decodeURIComponent(secretName as string);

        if (!MOCK_SECRETS.includes(decodedName)) {
            res.status(404).json({
                success: false,
                message: 'Secret not found',
            });
            return;
        }

        const mockSecretValue = {
            host: 'localhost',
            port: 5432,
            database: 'app_db',
            username: 'app_user',
            password: '***REDACTED***',
            ssl: true,
            created_at: new Date().toISOString(),
            secret_name: decodedName,
        };

        res.json({
            success: true,
            data: {
                name: decodedName,
                value: mockSecretValue,
                retrievedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        // istanbul ignore next
        console.error('Error getting secret:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get secret',
            error: (error as Error).message,
        });
    }
});

export default router;
