import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';

// Mock MikroORM Core to bypass RequestContext but keep decorators
jest.mock('@mikro-orm/core', () => {
    const actual = jest.requireActual('@mikro-orm/core') as any;
    return {
        ...actual,
        RequestContext: {
            ...actual.RequestContext,
            create: jest.fn((em: unknown, next: Function) => next()),
        },
    };
});

// Mock DB
jest.mock('../src/db', () => ({
    getORM: jest.fn(() => ({
        em: {}
    })),
    initORM: jest.fn(),
    closeORM: jest.fn(),
}));

// Mock Legacy Database Config
jest.mock('../src/config/database', () => ({
    testConnection: jest.fn<any>().mockResolvedValue(true), // Typed jest.fn
}));

// Mock Config to ensure consistent test environment
jest.mock('../src/config', () => {
    const originalConfig = jest.requireActual('../src/config') as any;
    return {
        __esModule: true,
        default: {
            ...originalConfig.default,
            cors: {
                ...originalConfig.default.cors,
                origin: '*',
            },
        },
    };
});

import app from '../src/app';

describe('App Integration', () => {
    it('should respond to health check', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should serve swagger docs', async () => {
        const res = await request(app).get('/api-docs/');
        expect(res.status).toBe(200);
        expect(res.text).toContain('html');
    });

    it('should handle 404 for unknown routes', async () => {
        const res = await request(app)
            .get('/api/unknown/route')
            .set('Accept', 'application/json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('success', false);
        // Error message might vary ("Route not found" vs "Not Found")
    });

    it('should have security headers', async () => {
        const res = await request(app).get('/api-docs/');
        // Check for CSP instead of specific helmet internals
        expect(res.headers['content-security-policy']).toBeDefined();
        // X-Frame-Options is usually set
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should handle CORS (preflight)', async () => {
        const res = await request(app).options('/api/auth/login')
            .set('Origin', 'http://localhost:3000')
            .set('Access-Control-Request-Method', 'POST');

        // 204 No Content is standard for successful OPTIONS
        if (res.status >= 300) {
            console.log('CORS Error Body:', res.body || res.text);
        }
        expect(res.status).toBeGreaterThanOrEqual(200);
        expect(res.status).toBeLessThan(300);
    });
});
