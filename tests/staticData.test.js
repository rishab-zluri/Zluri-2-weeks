/**
 * Static Data Configuration Tests
 * Tests for POD and database instance configuration
 */

const {
  pods,
  databaseInstances,
  getAllPods,
  getPodById,
  getPodsByManager,
  getAllInstances,
  getInstancesByType,
  getInstanceById,
  getDatabasesForInstance,
  validateInstanceDatabase,
} = require('../src/config/staticData');

describe('Static Data Configuration', () => {
  describe('Data Structures', () => {
    it('should have pods array with required fields', () => {
      expect(Array.isArray(pods)).toBe(true);
      expect(pods.length).toBeGreaterThan(0);
      
      pods.forEach(pod => {
        expect(pod).toHaveProperty('id');
        expect(pod).toHaveProperty('name');
        expect(pod).toHaveProperty('manager_email');
      });
    });

    it('should have databaseInstances array with required fields', () => {
      expect(Array.isArray(databaseInstances)).toBe(true);
      expect(databaseInstances.length).toBeGreaterThan(0);
      
      databaseInstances.forEach(instance => {
        expect(instance).toHaveProperty('id');
        expect(instance).toHaveProperty('name');
        expect(instance).toHaveProperty('type');
        expect(instance).toHaveProperty('databases');
        expect(Array.isArray(instance.databases)).toBe(true);
      });
    });
  });

  describe('getAllPods', () => {
    it('should return copy of all pods', () => {
      const result = getAllPods();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(pods.length);
      
      // Verify it's a copy
      result.push({ id: 'new-pod' });
      expect(getAllPods().length).toBe(pods.length);
    });
  });

  describe('getPodById', () => {
    it('should return pod for valid ID', () => {
      const result = getPodById('pod-1');
      
      expect(result).toBeDefined();
      expect(result.id).toBe('pod-1');
      expect(result.name).toBe('Pod 1');
    });

    it('should return null for invalid ID', () => {
      const result = getPodById('invalid-pod');
      
      expect(result).toBeNull();
    });

    it('should return null for empty ID', () => {
      const result = getPodById('');
      
      expect(result).toBeNull();
    });

    it('should return null for undefined ID', () => {
      const result = getPodById(undefined);
      
      expect(result).toBeNull();
    });
  });

  describe('getPodsByManager', () => {
    it('should return pods for valid manager email', () => {
      const result = getPodsByManager('manager1@zluri.com');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(pod => {
        expect(pod.manager_email).toBe('manager1@zluri.com');
      });
    });

    it('should return empty array for unknown manager', () => {
      const result = getPodsByManager('unknown@zluri.com');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return empty array for empty email', () => {
      const result = getPodsByManager('');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('getAllInstances', () => {
    it('should return all instances without connection details', () => {
      const result = getAllInstances();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(databaseInstances.length);
      
      result.forEach(instance => {
        expect(instance).toHaveProperty('id');
        expect(instance).toHaveProperty('name');
        expect(instance).toHaveProperty('type');
        expect(instance).toHaveProperty('databases');
        expect(instance).not.toHaveProperty('host');
        expect(instance).not.toHaveProperty('connectionString');
      });
    });
  });

  describe('getInstancesByType', () => {
    it('should return PostgreSQL instances', () => {
      const result = getInstancesByType('postgresql');
      
      expect(Array.isArray(result)).toBe(true);
      result.forEach(instance => {
        expect(instance.type).toBe('postgresql');
      });
    });

    it('should return MongoDB instances', () => {
      const result = getInstancesByType('mongodb');
      
      expect(Array.isArray(result)).toBe(true);
      result.forEach(instance => {
        expect(instance.type).toBe('mongodb');
      });
    });

    it('should be case insensitive', () => {
      const result1 = getInstancesByType('PostgreSQL');
      const result2 = getInstancesByType('postgresql');
      
      expect(result1.length).toBe(result2.length);
    });

    it('should return empty array for invalid type', () => {
      const result = getInstancesByType('mysql');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('getInstanceById', () => {
    it('should return instance with connection details for valid ID', () => {
      const result = getInstanceById('database-1');
      
      expect(result).toBeDefined();
      expect(result.id).toBe('database-1');
      // Connection details are at top level, not nested in _connection
      expect(result.host).toBeDefined();
      expect(result.port).toBeDefined();
    });

    it('should return null for invalid ID', () => {
      const result = getInstanceById('invalid-instance');
      
      expect(result).toBeNull();
    });

    it('should return MongoDB connection string', () => {
      const result = getInstanceById('mongo-zluri-1');
      
      expect(result).toBeDefined();
      expect(result.type).toBe('mongodb');
      // MongoDB uses uri at top level
      expect(result.uri).toBeDefined();
    });
  });

  describe('getDatabasesForInstance', () => {
    it('should return databases for valid instance', () => {
      const result = getDatabasesForInstance('database-1');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid instance', () => {
      const result = getDatabasesForInstance('invalid-instance');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('validateInstanceDatabase', () => {
    it('should return true for valid combination', () => {
      const instance = databaseInstances[0];
      const database = instance.databases[0];
      
      const result = validateInstanceDatabase(instance.id, database);
      
      expect(result).toBe(true);
    });

    it('should return false for invalid database', () => {
      const result = validateInstanceDatabase('database-1', 'nonexistent_db');
      
      expect(result).toBe(false);
    });

    it('should return false for invalid instance', () => {
      const result = validateInstanceDatabase('invalid-instance', 'any_db');
      
      expect(result).toBe(false);
    });

    it('should return false for empty inputs', () => {
      expect(validateInstanceDatabase('', '')).toBe(false);
      expect(validateInstanceDatabase('database-1', '')).toBe(false);
      expect(validateInstanceDatabase('', 'test_db')).toBe(false);
    });
  });
});
