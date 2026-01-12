/**
 * User Model Tests
 * Tests for user CRUD operations and authentication
 */

const bcrypt = require('bcryptjs');

// Mock the database module
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const { query } = require('../src/config/database');
const User = require('../src/models/User');
const { DatabaseError, NotFoundError, ConflictError } = require('../src/utils/errors');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UserRoles', () => {
    it('should have correct role values', () => {
      expect(User.UserRoles.DEVELOPER).toBe('developer');
      expect(User.UserRoles.MANAGER).toBe('manager');
      expect(User.UserRoles.ADMIN).toBe('admin');
    });
  });

  describe('createTable', () => {
    it('should create table successfully', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      
      await expect(User.createTable()).resolves.not.toThrow();
      expect(query).toHaveBeenCalled();
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));
      
      await expect(User.createTable()).rejects.toThrow(DatabaseError);
    });
  });

  describe('create', () => {
    const userData = {
      email: 'test@example.com',
      password: 'Test@123',
      name: 'Test User',
      role: 'developer',
      podId: 'pod-1',
      slackUserId: 'U123',
    };

    it('should create a user successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'developer',
          pod_id: 'pod-1',
          slack_user_id: 'U123',
          is_active: true,
          created_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await User.create(userData);

      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Test@123', 12);
    });

    it('should throw ConflictError for duplicate email', async () => {
      const error = new Error('duplicate');
      error.code = '23505';
      query.mockRejectedValueOnce(error);

      await expect(User.create(userData)).rejects.toThrow(ConflictError);
    });

    it('should throw DatabaseError for other errors', async () => {
      query.mockRejectedValueOnce(new Error('Other error'));

      await expect(User.create(userData)).rejects.toThrow(DatabaseError);
    });

    it('should use default values for role, podId, and slackUserId (line 60)', async () => {
      // Create user with only required fields, letting defaults apply
      const minimalUserData = {
        email: 'minimal@example.com',
        password: 'Test@123',
        name: 'Minimal User',
        // role, podId, slackUserId not provided - should use defaults
      };

      const mockResult = {
        rows: [{
          id: 'user-456',
          email: 'minimal@example.com',
          name: 'Minimal User',
          role: 'developer',  // Default value
          pod_id: null,       // Default value
          slack_user_id: null, // Default value
          is_active: true,
          created_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await User.create(minimalUserData);

      expect(result).toHaveProperty('role', 'developer');
      expect(result.podId).toBeNull();
      expect(result.slackUserId).toBeNull();
      
      // Verify the SQL was called with default values
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['developer', null, null])
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'developer',
          pod_id: 'pod-1',
          slack_user_id: null,
          is_active: true,
          last_login: null,
          created_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await User.findByEmail('test@example.com');

      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('should return null when user not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should include password hash when requested', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          password_hash: 'hashed_password',
          name: 'Test User',
          role: 'developer',
          pod_id: 'pod-1',
          slack_user_id: null,
          is_active: true,
          last_login: null,
          created_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await User.findByEmail('test@example.com', true);

      expect(result).toHaveProperty('passwordHash', 'hashed_password');
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.findByEmail('test@example.com')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'developer',
          pod_id: 'pod-1',
          slack_user_id: null,
          is_active: true,
          last_login: null,
          created_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await User.findById('user-123');

      expect(result).toHaveProperty('id', 'user-123');
    });

    it('should return null when user not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await User.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.findById('user-123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findAll', () => {
    it('should find all users with no filters', async () => {
      const mockResult = {
        rows: [
          { id: '1', email: 'user1@test.com', name: 'User 1', role: 'developer', pod_id: null, slack_user_id: null, is_active: true, last_login: null, created_at: new Date() },
          { id: '2', email: 'user2@test.com', name: 'User 2', role: 'manager', pod_id: null, slack_user_id: null, is_active: true, last_login: null, created_at: new Date() },
        ],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await User.findAll();

      expect(result).toHaveLength(2);
    });

    it('should filter by role', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await User.findAll({ role: 'developer' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('role = $1'),
        expect.arrayContaining(['developer'])
      );
    });

    it('should filter by podId', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await User.findAll({ podId: 'pod-1' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('pod_id = $1'),
        expect.arrayContaining(['pod-1'])
      );
    });

    it('should filter by isActive', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await User.findAll({ isActive: true });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = $1'),
        expect.arrayContaining([true])
      );
    });

    it('should support pagination', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await User.findAll({ limit: 10, offset: 20 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.findAll()).rejects.toThrow(DatabaseError);
    });
  });

  describe('count', () => {
    it('should count all users', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const result = await User.count();

      expect(result).toBe(10);
    });

    it('should count users with filters', async () => {
      query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await User.count({ role: 'developer', isActive: true });

      expect(result).toBe(5);
    });

    it('should throw DatabaseError on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.count()).rejects.toThrow(DatabaseError);
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'user-123',
          email: 'test@example.com',
          name: 'Updated Name',
          role: 'developer',
          pod_id: 'pod-1',
          slack_user_id: 'U123',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      };
      query.mockResolvedValueOnce(mockResult);

      const result = await User.update('user-123', { name: 'Updated Name' });

      expect(result).toHaveProperty('name', 'Updated Name');
    });

    it('should throw NotFoundError when user not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(User.update('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other errors', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.update('user-123', { name: 'Test' })).rejects.toThrow(DatabaseError);
    });

    it('should throw ValidationError when no valid fields to update', async () => {
      // Empty object - no valid fields (line 221)
      await expect(User.update('user-123', {})).rejects.toThrow('No valid fields to update');
    });

    it('should throw ValidationError when only invalid fields provided', async () => {
      // Only invalid field names
      await expect(User.update('user-123', { 
        invalidField: 'value',
        unknownField: 123 
      })).rejects.toThrow('No valid fields to update');
    });

    it('should throw ValidationError when all fields are undefined', async () => {
      // All valid field names but undefined values
      await expect(User.update('user-123', {
        name: undefined,
        role: undefined,
        podId: undefined,
      })).rejects.toThrow('No valid fields to update');
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await User.updatePassword('user-123', 'newPassword123');

      expect(result).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
    });

    it('should throw NotFoundError when user not found', async () => {
      query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(User.updatePassword('nonexistent', 'password')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other errors', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.updatePassword('user-123', 'password')).rejects.toThrow(DatabaseError);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login silently', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });

      await expect(User.updateLastLogin('user-123')).resolves.not.toThrow();
    });

    it('should not throw on failure', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.updateLastLogin('user-123')).resolves.not.toThrow();
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      bcrypt.compare.mockResolvedValueOnce(true);

      const result = await User.verifyPassword('password', 'hashed');

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      bcrypt.compare.mockResolvedValueOnce(false);

      const result = await User.verifyPassword('wrong', 'hashed');

      expect(result).toBe(false);
    });
  });

  describe('softDelete', () => {
    it('should soft delete user successfully', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await User.softDelete('user-123');

      expect(result).toBe(true);
    });

    it('should throw NotFoundError when user not found', async () => {
      query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(User.softDelete('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other errors', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await expect(User.softDelete('user-123')).rejects.toThrow(DatabaseError);
    });
  });
});
