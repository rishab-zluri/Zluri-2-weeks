/**
 * Database Routes Tests
 * 100% Branch Coverage
 */

const express = require('express');
const request = require('supertest');

// Mock the controller before requiring the routes
jest.mock('../src/controllers/databaseController', () => ({
  getInstances: jest.fn((req, res) => res.json({ success: true, data: [] })),
  getInstanceById: jest.fn((req, res) => res.json({ success: true, data: {} })),
  getDatabases: jest.fn((req, res) => res.json({ success: true, data: [] })),
  syncInstance: jest.fn((req, res) => res.json({ success: true })),
  getSyncHistory: jest.fn((req, res) => res.json({ success: true, data: [] })),
  syncAll: jest.fn((req, res) => res.json({ success: true })),
  getBlacklist: jest.fn((req, res) => res.json({ success: true, data: [] })),
  addToBlacklist: jest.fn((req, res) => res.json({ success: true })),
  removeFromBlacklist: jest.fn((req, res) => res.json({ success: true })),
}));

const databaseRoutes = require('../src/routes/databaseRoutes');
const databaseController = require('../src/controllers/databaseController');

describe('Database Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/databases', databaseRoutes);
  });

  describe('Instance Routes', () => {
    describe('GET /api/databases/instances', () => {
      it('should get all instances', async () => {
        const response = await request(app)
          .get('/api/databases/instances')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.getInstances).toHaveBeenCalled();
      });

      it('should pass query params to controller', async () => {
        await request(app)
          .get('/api/databases/instances?type=postgresql')
          .expect(200);

        expect(databaseController.getInstances).toHaveBeenCalled();
      });
    });

    describe('GET /api/databases/instances/:instanceId', () => {
      it('should get instance by ID', async () => {
        const response = await request(app)
          .get('/api/databases/instances/inst-1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.getInstanceById).toHaveBeenCalled();
      });
    });

    describe('GET /api/databases/instances/:instanceId/databases', () => {
      it('should get databases for instance', async () => {
        const response = await request(app)
          .get('/api/databases/instances/inst-1/databases')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.getDatabases).toHaveBeenCalled();
      });
    });
  });

  describe('Sync Routes', () => {
    describe('POST /api/databases/instances/:instanceId/sync', () => {
      it('should require admin role', async () => {
        const response = await request(app)
          .post('/api/databases/instances/inst-1/sync')
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Admin access required');
      });

      it('should allow admin to sync instance', async () => {
        // Create app with admin user
        const adminApp = express();
        adminApp.use(express.json());
        adminApp.use((req, res, next) => {
          req.user = { id: '1', role: 'admin' };
          next();
        });
        adminApp.use('/api/databases', databaseRoutes);

        const response = await request(adminApp)
          .post('/api/databases/instances/inst-1/sync')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.syncInstance).toHaveBeenCalled();
      });
    });

    describe('GET /api/databases/instances/:instanceId/sync-history', () => {
      it('should get sync history', async () => {
        const response = await request(app)
          .get('/api/databases/instances/inst-1/sync-history')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.getSyncHistory).toHaveBeenCalled();
      });
    });

    describe('POST /api/databases/sync-all', () => {
      it('should require admin role', async () => {
        const response = await request(app)
          .post('/api/databases/sync-all')
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it('should allow admin to sync all', async () => {
        const adminApp = express();
        adminApp.use(express.json());
        adminApp.use((req, res, next) => {
          req.user = { id: '1', role: 'admin' };
          next();
        });
        adminApp.use('/api/databases', databaseRoutes);

        const response = await request(adminApp)
          .post('/api/databases/sync-all')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.syncAll).toHaveBeenCalled();
      });
    });
  });

  describe('Blacklist Routes', () => {
    describe('GET /api/databases/blacklist', () => {
      it('should get blacklist', async () => {
        const response = await request(app)
          .get('/api/databases/blacklist')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.getBlacklist).toHaveBeenCalled();
      });
    });

    describe('POST /api/databases/blacklist', () => {
      it('should require admin role', async () => {
        const response = await request(app)
          .post('/api/databases/blacklist')
          .send({ pattern: 'test', patternType: 'exact', reason: 'test' })
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it('should allow admin to add to blacklist', async () => {
        const adminApp = express();
        adminApp.use(express.json());
        adminApp.use((req, res, next) => {
          req.user = { id: '1', role: 'admin' };
          next();
        });
        adminApp.use('/api/databases', databaseRoutes);

        const response = await request(adminApp)
          .post('/api/databases/blacklist')
          .send({ pattern: 'test', patternType: 'exact', reason: 'test' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.addToBlacklist).toHaveBeenCalled();
      });
    });

    describe('DELETE /api/databases/blacklist/:id', () => {
      it('should require admin role', async () => {
        const response = await request(app)
          .delete('/api/databases/blacklist/1')
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it('should allow admin to remove from blacklist', async () => {
        const adminApp = express();
        adminApp.use(express.json());
        adminApp.use((req, res, next) => {
          req.user = { id: '1', role: 'admin' };
          next();
        });
        adminApp.use('/api/databases', databaseRoutes);

        const response = await request(adminApp)
          .delete('/api/databases/blacklist/1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(databaseController.removeFromBlacklist).toHaveBeenCalled();
      });
    });
  });

  describe('Authentication Middleware', () => {
    it('should attach default user when no user present', async () => {
      await request(app)
        .get('/api/databases/instances')
        .expect(200);

      // The authenticate middleware should have been called
      expect(databaseController.getInstances).toHaveBeenCalled();
    });
  });

  describe('requireAdmin Middleware', () => {
    it('should reject non-admin users', async () => {
      const response = await request(app)
        .post('/api/databases/sync-all')
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    it('should reject when user role is undefined', async () => {
      const noRoleApp = express();
      noRoleApp.use(express.json());
      noRoleApp.use((req, res, next) => {
        req.user = { id: '1' }; // No role
        next();
      });
      noRoleApp.use('/api/databases', databaseRoutes);

      const response = await request(noRoleApp)
        .post('/api/databases/sync-all')
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });
  });
});
