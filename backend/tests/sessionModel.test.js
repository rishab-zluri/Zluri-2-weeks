/**
 * Session Model Tests
 * 100% Branch Coverage for Session (Refresh Token) Model
 */

// Mock database
const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../src/config/database', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const Session = require('../src/models/Session');
const { DatabaseError } = require('../src/utils/errors');

describe('Session Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const mockSession = {
        id: '1',
        user_id: 'user-1',
        device_info: 'Chrome',
        ip_address: '127.0.0.1',
        created_at: new Date(),
        expires_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockSession] });

      const result = await Session.create({
        userId: 'user-1',
        tokenHash: 'hash123',
        deviceInfo: 'Chrome',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(),
      });

      expect(result).toEqual(mockSession);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.any(Array)
      );
    });

    it('should create session without optional fields', async () => {
      const mockSession = {
        id: '1',
        user_id: 'user-1',
        device_info: null,
        ip_address: null,
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockSession] });

      const result = await Session.create({
        userId: 'user-1',
        tokenHash: 'hash123',
        expiresAt: new Date(),
      });

      expect(result).toEqual(mockSession);
    });

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(Session.create({
        userId: 'user-1',
        tokenHash: 'hash123',
        expiresAt: new Date(),
      })).rejects.toThrow(DatabaseError);
    });
  });

  describe('findValidTokenWithUser', () => {
    it('should find valid token with user data', async () => {
      const mockData = {
        id: '1',
        user_id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'developer',
        pod_id: 'pod-1',
        is_active: true,
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockData] });

      const result = await Session.findValidTokenWithUser('hash123');

      expect(result).toEqual(mockData);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('JOIN users'),
        ['hash123']
      );
    });

    it('should return null when token not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await Session.findValidTokenWithUser('invalid-hash');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(Session.findValidTokenWithUser('hash123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('revokeByHash', () => {
    it('should revoke token by hash', async () => {
      mockQuery.mockResolvedValueOnce({ 
        rowCount: 1, 
        rows: [{ user_id: 'user-1' }] 
      });

      const result = await Session.revokeByHash('hash123');

      expect(result).toEqual({ user_id: 'user-1' });
    });

    it('should return null when token not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const result = await Session.revokeByHash('invalid-hash');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(Session.revokeByHash('hash123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all sessions for user', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 3 });

      const result = await Session.revokeAllForUser('user-1');

      expect(result).toBe(3);
    });

    it('should return 0 when no sessions to revoke', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await Session.revokeAllForUser('user-1');

      expect(result).toBe(0);
    });

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(Session.revokeAllForUser('user-1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('revokeById', () => {
    it('should revoke session by ID', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await Session.revokeById('user-1', 'session-1');

      expect(result).toBe(true);
    });

    it('should return false when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await Session.revokeById('user-1', 'invalid-session');

      expect(result).toBe(false);
    });

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(Session.revokeById('user-1', 'session-1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('getActiveForUser', () => {
    it('should get active sessions for user', async () => {
      const mockSessions = [
        { id: '1', device_info: 'Chrome', ip_address: '127.0.0.1' },
        { id: '2', device_info: 'Firefox', ip_address: '127.0.0.2' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockSessions });

      const result = await Session.getActiveForUser('user-1');

      expect(result).toEqual(mockSessions);
    });

    it('should return empty array when no sessions', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await Session.getActiveForUser('user-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(Session.getActiveForUser('user-1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('cleanupExpired', () => {
    it('should cleanup expired tokens', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 5 });

      const result = await Session.cleanupExpired();

      expect(result).toBe(5);
    });

    it('should return 0 when no tokens to cleanup', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await Session.cleanupExpired();

      expect(result).toBe(0);
    });

    it('should throw DatabaseError on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(Session.cleanupExpired()).rejects.toThrow(DatabaseError);
    });
  });

  describe('validateTokenWithTransaction', () => {
    it('should validate token and call callback on success', async () => {
      const mockTokenData = {
        user_id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'developer',
        pod_id: 'pod-1',
        is_active: true,
      };

      // Mock transaction to execute the callback
      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({ rows: [mockTokenData] }),
        };
        return callback(mockClient);
      });

      const onValidToken = jest.fn().mockReturnValue({ valid: true, accessToken: 'new-token' });

      const result = await Session.validateTokenWithTransaction('hash123', onValidToken);

      expect(onValidToken).toHaveBeenCalledWith(mockTokenData, expect.any(Object));
      expect(result).toEqual({ valid: true, accessToken: 'new-token' });
    });

    it('should return error when token not found', async () => {
      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValueOnce({ rows: [] }),
        };
        return callback(mockClient);
      });

      const onValidToken = jest.fn();

      const result = await Session.validateTokenWithTransaction('invalid-hash', onValidToken);

      expect(onValidToken).not.toHaveBeenCalled();
      expect(result).toEqual({ valid: false, error: 'Invalid or expired refresh token' });
    });

    it('should revoke token and return error when user is disabled', async () => {
      const mockTokenData = {
        user_id: 'user-1',
        email: 'test@test.com',
        is_active: false,
      };

      mockTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockTokenData] }) // Find token
            .mockResolvedValueOnce({ rowCount: 1 }), // Revoke token
        };
        return callback(mockClient);
      });

      const onValidToken = jest.fn();

      const result = await Session.validateTokenWithTransaction('hash123', onValidToken);

      expect(onValidToken).not.toHaveBeenCalled();
      expect(result).toEqual({ valid: false, error: 'Account is disabled' });
    });
  });
});
