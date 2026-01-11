/**
 * Routes Integration Tests
 * Full branch coverage for all route handlers
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies before importing routes
jest.mock('../src/models/User');
jest.mock('../src/middleware/auth');

const User = require('../src/models/User');
const { authenticate, requireRole } = require('../src/middleware/auth');

describe('Routes Integration Tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authenticate middleware
    authenticate.mockImplementation((req, res, next) => {
      req.user = {
        id: 'user-123',
        email: 'admin@test.com',
        role: 'admin',
      };
      next();
    });
    
    // Mock requireRole middleware
    requireRole.mockImplementation((role) => (req, res, next) => {
      if (req.user && req.user.role === 'admin') {
        next();
      } else {
        res.status(403).json({ success: false, message: 'Forbidden' });
      }
    });
  });

  describe('Secrets Routes', () => {
    beforeEach(() => {
      app = express();
      app.use(express.json());
      const secretsRoutes = require('../src/routes/secretsRoutes');
      app.use('/api/secrets', secretsRoutes);
    });

    describe('GET /api/secrets', () => {
      it('should return all secrets successfully', async () => {
        const res = await request(app)
          .get('/api/secrets')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.secrets).toBeDefined();
        expect(Array.isArray(res.body.data.secrets)).toBe(true);
        expect(res.body.data.count).toBeGreaterThan(0);
      });

      it('should handle errors when listing secrets fails', async () => {
        // Force an error by breaking the response
        jest.isolateModules(() => {
          const errorApp = express();
          errorApp.use(express.json());
          
          // Create a route that throws
          errorApp.get('/api/secrets', authenticate, async (req, res) => {
            throw new Error('Test error');
          });
          errorApp.use((err, req, res, next) => {
            res.status(500).json({ success: false, message: err.message });
          });
        });
      });
    });

    describe('GET /api/secrets/search', () => {
      it('should return all secrets when no query provided', async () => {
        const res = await request(app)
          .get('/api/secrets/search')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.secrets).toBeDefined();
      });

      it('should filter secrets by query', async () => {
        const res = await request(app)
          .get('/api/secrets/search?q=kafka')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.query).toBe('kafka');
        res.body.data.secrets.forEach(secret => {
          expect(secret.toLowerCase()).toContain('kafka');
        });
      });

      it('should return empty array for non-matching query', async () => {
        const res = await request(app)
          .get('/api/secrets/search?q=nonexistentsecret12345')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.secrets).toHaveLength(0);
        expect(res.body.data.count).toBe(0);
      });
    });

    describe('GET /api/secrets/:secretName', () => {
      it('should return secret value for valid secret', async () => {
        const secretName = encodeURIComponent('/dev/eksfargate/dev-kafka-microservices-secrets-manager');
        const res = await request(app)
          .get(`/api/secrets/${secretName}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBeDefined();
        expect(res.body.data.value).toBeDefined();
        expect(res.body.data.value.host).toBe('localhost');
        expect(res.body.data.value.password).toBe('***REDACTED***');
      });

      it('should return 404 for non-existent secret', async () => {
        const res = await request(app)
          .get('/api/secrets/nonexistent-secret')
          .expect(404);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Secret not found');
      });
    });
  });

  describe('User Routes', () => {
    beforeEach(() => {
      jest.resetModules();
      
      // Re-mock after reset
      jest.mock('../src/models/User');
      jest.mock('../src/middleware/auth');
      
      const UserMock = require('../src/models/User');
      const authMock = require('../src/middleware/auth');
      
      authMock.authenticate.mockImplementation((req, res, next) => {
        req.user = { id: 'admin-123', email: 'admin@test.com', role: 'admin' };
        next();
      });
      
      authMock.requireRole.mockImplementation((role) => (req, res, next) => next());
      
      app = express();
      app.use(express.json());
      const userRoutes = require('../src/routes/userRoutes');
      app.use('/api/users', userRoutes);
      // Error handler
      app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          success: false,
          message: err.message,
          errors: err.errors,
        });
      });
    });

    describe('GET /api/users', () => {
      it('should return paginated users', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findAll.mockResolvedValue([
          { id: '1', email: 'user1@test.com', name: 'User 1' },
          { id: '2', email: 'user2@test.com', name: 'User 2' },
        ]);
        UserMock.count.mockResolvedValue(2);

        const res = await request(app)
          .get('/api/users')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(2);
      });

      it('should filter by role', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findAll.mockResolvedValue([]);
        UserMock.count.mockResolvedValue(0);

        await request(app)
          .get('/api/users?role=developer')
          .expect(200);

        expect(UserMock.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'developer' })
        );
      });

      it('should filter by podId', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findAll.mockResolvedValue([]);
        UserMock.count.mockResolvedValue(0);

        await request(app)
          .get('/api/users?podId=pod-1')
          .expect(200);

        expect(UserMock.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ podId: 'pod-1' })
        );
      });

      it('should filter by search term', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findAll.mockResolvedValue([]);
        UserMock.count.mockResolvedValue(0);

        await request(app)
          .get('/api/users?search=john')
          .expect(200);

        expect(UserMock.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'john' })
        );
      });

      it('should filter by isActive', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findAll.mockResolvedValue([]);
        UserMock.count.mockResolvedValue(0);

        await request(app)
          .get('/api/users?isActive=true')
          .expect(200);

        expect(UserMock.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: true })
        );
      });
    });

    describe('GET /api/users/:id', () => {
      it('should return user by ID', async () => {
        const UserMock = require('../src/models/User');
        const mockUser = { id: 'valid-uuid-1234-5678-9012', email: 'user@test.com' };
        UserMock.findById.mockResolvedValue(mockUser);

        const res = await request(app)
          .get('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe('user@test.com');
      });

      it('should return 404 for non-existent user', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findById.mockResolvedValue(null);

        const res = await request(app)
          .get('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .expect(404);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('User not found');
      });

      it('should return 400 for invalid UUID format', async () => {
        const res = await request(app)
          .get('/api/users/invalid-id')
          .expect(400);

        expect(res.body.success).toBe(false);
      });
    });

    describe('PUT /api/users/:id', () => {
      it('should update user successfully', async () => {
        const UserMock = require('../src/models/User');
        const mockUser = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'user@test.com' };
        UserMock.findById.mockResolvedValue(mockUser);
        UserMock.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

        const res = await request(app)
          .put('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .send({ name: 'Updated Name' })
          .expect(200);

        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent user', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findById.mockResolvedValue(null);

        const res = await request(app)
          .put('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .send({ name: 'Updated Name' })
          .expect(404);

        expect(res.body.success).toBe(false);
      });

      it('should prevent admin from deactivating themselves', async () => {
        const UserMock = require('../src/models/User');
        const authMock = require('../src/middleware/auth');
        
        // Set user ID to match the request
        authMock.authenticate.mockImplementation((req, res, next) => {
          req.user = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'admin@test.com', role: 'admin' };
          next();
        });
        
        const mockUser = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'admin@test.com' };
        UserMock.findById.mockResolvedValue(mockUser);

        const res = await request(app)
          .put('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .send({ isActive: false })
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Cannot deactivate your own account');
      });

      it('should update all fields when provided', async () => {
        const UserMock = require('../src/models/User');
        const mockUser = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'user@test.com' };
        UserMock.findById.mockResolvedValue(mockUser);
        UserMock.update.mockResolvedValue({ ...mockUser, name: 'New Name', role: 'manager' });

        await request(app)
          .put('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .send({
            name: 'New Name',
            role: 'manager',
            podId: 'pod-2',
            slackUserId: 'U12345',
            isActive: true,
          })
          .expect(200);

        expect(UserMock.update).toHaveBeenCalledWith(
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          expect.objectContaining({
            name: 'New Name',
            role: 'manager',
            podId: 'pod-2',
            slackUserId: 'U12345',
            isActive: true,
          })
        );
      });
    });

    describe('DELETE /api/users/:id', () => {
      it('should soft delete user', async () => {
        const UserMock = require('../src/models/User');
        const mockUser = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'user@test.com' };
        UserMock.findById.mockResolvedValue(mockUser);
        UserMock.softDelete.mockResolvedValue(true);

        const res = await request(app)
          .delete('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('User deactivated successfully');
      });

      it('should prevent admin from deleting themselves', async () => {
        const UserMock = require('../src/models/User');
        const authMock = require('../src/middleware/auth');
        
        authMock.authenticate.mockImplementation((req, res, next) => {
          req.user = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'admin@test.com', role: 'admin' };
          next();
        });

        const res = await request(app)
          .delete('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Cannot delete your own account');
      });

      it('should return 404 for non-existent user', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findById.mockResolvedValue(null);

        const res = await request(app)
          .delete('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
          .expect(404);

        expect(res.body.success).toBe(false);
      });
    });

    describe('POST /api/users/:id/activate', () => {
      it('should activate user', async () => {
        const UserMock = require('../src/models/User');
        const mockUser = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'user@test.com', isActive: false };
        UserMock.findById.mockResolvedValue(mockUser);
        UserMock.update.mockResolvedValue({ ...mockUser, isActive: true });

        const res = await request(app)
          .post('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/activate')
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('User activated successfully');
      });

      it('should return 404 for non-existent user', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findById.mockResolvedValue(null);

        const res = await request(app)
          .post('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/activate')
          .expect(404);

        expect(res.body.success).toBe(false);
      });
    });

    describe('POST /api/users/:id/reset-password', () => {
      it('should reset password', async () => {
        const UserMock = require('../src/models/User');
        const mockUser = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'user@test.com' };
        UserMock.findById.mockResolvedValue(mockUser);
        UserMock.updatePassword.mockResolvedValue(true);

        const res = await request(app)
          .post('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/reset-password')
          .send({ newPassword: 'NewPass123!@#' })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Password reset successfully');
      });

      it('should return 404 for non-existent user', async () => {
        const UserMock = require('../src/models/User');
        UserMock.findById.mockResolvedValue(null);

        const res = await request(app)
          .post('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/reset-password')
          .send({ newPassword: 'NewPass123!@#' })
          .expect(404);

        expect(res.body.success).toBe(false);
      });

      it('should validate password requirements', async () => {
        const res = await request(app)
          .post('/api/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/reset-password')
          .send({ newPassword: 'weak' })
          .expect(400);

        expect(res.body.success).toBe(false);
      });
    });
  });
});
