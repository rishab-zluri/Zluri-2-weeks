/**
 * Database Configuration Tests
 * Comprehensive tests for config/database.js - 100% branch coverage
 */

// Create mock functions at module level
const mockPoolQuery = jest.fn();
const mockPoolOn = jest.fn();
const mockPoolEnd = jest.fn().mockResolvedValue();
const mockPoolConnect = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

// Store event handlers
const eventHandlers = {};

// Mock pg module before requiring anything
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockPoolQuery,
    on: (event, handler) => {
      eventHandlers[event] = handler;
      return mockPoolOn(event, handler);
    },
    end: mockPoolEnd,
    connect: mockPoolConnect,
  })),
}));

// Create mock logger with jest functions
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock logger module
jest.mock('../src/utils/logger', () => mockLogger);

// Mock config
jest.mock('../src/config/index', () => ({
  portalDb: {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_pass',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
}));

describe('Database Configuration', () => {
  let database;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // Require database module to register event handlers
    database = require('../src/config/database');
  });

  describe('Pool Event Handlers', () => {
    it('should log on connect event', () => {
      // Event handlers are registered when module loads
      expect(eventHandlers.connect).toBeDefined();
      eventHandlers.connect();
      expect(mockLogger.debug).toHaveBeenCalledWith('New client connected to portal database');
    });

    it('should log on error event', () => {
      expect(eventHandlers.error).toBeDefined();
      const testError = new Error('Connection failed');
      eventHandlers.error(testError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error on portal database pool',
        { error: 'Connection failed' }
      );
    });
  });

  describe('query function', () => {
    it('should execute query successfully', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPoolQuery.mockResolvedValueOnce(mockResult);

      const result = await database.query('SELECT * FROM users', []);

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(result).toEqual(mockResult);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: 'SELECT * FROM users',
          rows: 1,
        })
      );
    });

    it('should execute query with default empty params', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPoolQuery.mockResolvedValueOnce(mockResult);

      await database.query('SELECT 1');

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should truncate long query text in logs', async () => {
      const longQuery = 'SELECT ' + 'x'.repeat(200);
      const mockResult = { rows: [], rowCount: 0 };
      mockPoolQuery.mockResolvedValueOnce(mockResult);

      await database.query(longQuery);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Executed query',
        expect.objectContaining({
          text: longQuery.substring(0, 100),
        })
      );
    });

    it('should handle query errors', async () => {
      const queryError = new Error('Syntax error');
      mockPoolQuery.mockRejectedValueOnce(queryError);

      await expect(database.query('INVALID SQL')).rejects.toThrow('Syntax error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Query execution error',
        expect.objectContaining({
          error: 'Syntax error',
        })
      );
    });
  });

  describe('getClient function', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should get a client from pool', async () => {
      const mockClient = {
        query: mockClientQuery,
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      const client = await database.getClient();

      expect(mockPoolConnect).toHaveBeenCalled();
      expect(client).toBeDefined();
      expect(typeof client.query).toBe('function');
      expect(typeof client.release).toBe('function');
    });

    it('should log warning after 5 seconds checkout', async () => {
      const mockClient = {
        query: mockClientQuery,
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      await database.getClient();

      // Fast-forward 5 seconds
      jest.advanceTimersByTime(5000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Client has been checked out for more than 5 seconds'
      );
    });

    it('should clear timeout on release', async () => {
      const mockClient = {
        query: mockClientQuery,
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      const client = await database.getClient();
      client.release();

      // Fast-forward - should not trigger warning
      jest.advanceTimersByTime(6000);

      expect(mockClientRelease).toHaveBeenCalled();
      // Warning should not have been called after release
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'Client has been checked out for more than 5 seconds'
      );
    });

    it('should wrap query function', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      const mockClient = {
        query: mockClientQuery,
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      const client = await database.getClient();
      await client.query('SELECT 1');

      expect(mockClientQuery).toHaveBeenCalledWith('SELECT 1');
    });
  });

  describe('transaction function', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should execute transaction successfully', async () => {
      const mockClient = {
        query: mockClientQuery.mockResolvedValue({ rows: [] }),
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      const callback = jest.fn().mockResolvedValue('result');
      const result = await database.transaction(callback);

      expect(result).toBe('result');
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(callback).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: mockClientQuery.mockResolvedValue({ rows: [] }),
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      const callback = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      await expect(database.transaction(callback)).rejects.toThrow('Transaction failed');
      
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should release client in finally block', async () => {
      const mockClient = {
        query: mockClientQuery.mockResolvedValue({ rows: [] }),
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      const callback = jest.fn().mockResolvedValue('result');
      await database.transaction(callback);

      // Client should be released (via wrapped release)
      // The release was called on the wrapped client
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should release client even on error', async () => {
      const mockClient = {
        query: mockClientQuery.mockResolvedValue({ rows: [] }),
        release: mockClientRelease,
      };
      mockPoolConnect.mockResolvedValueOnce(mockClient);

      const callback = jest.fn().mockRejectedValue(new Error('Error'));

      try {
        await database.transaction(callback);
      } catch (e) {
        // Expected
      }

      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  describe('testConnection function', () => {
    it('should return true on successful connection', async () => {
      const now = new Date();
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ now }],
      });

      const result = await database.testConnection();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Portal database connection successful',
        { timestamp: now }
      );
    });

    it('should return false on connection failure', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await database.testConnection();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Portal database connection failed',
        { error: 'Connection refused' }
      );
    });
  });

  describe('closePool function', () => {
    it('should close the pool', async () => {
      await database.closePool();

      expect(mockPoolEnd).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Portal database pool closed');
    });
  });

  describe('exports', () => {
    it('should export pool and functions', () => {
      expect(database.pool).toBeDefined();
      expect(database.query).toBeDefined();
      expect(database.getClient).toBeDefined();
      expect(database.transaction).toBeDefined();
      expect(database.testConnection).toBeDefined();
      expect(database.closePool).toBeDefined();
    });
  });
});
