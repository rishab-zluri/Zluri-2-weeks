/**
 * POD and Database Instance Configuration
 * Static configuration for PODs and database instances
 */

const pods = [
  {
    id: 'pod-1',
    name: 'Pod 1',
    manager_email: 'manager1@zluri.com',
  },
  {
    id: 'pod-2',
    name: 'Pod 2',
    manager_email: 'manager2@zluri.com',
  },
  {
    id: 'pod-3',
    name: 'Pod 3',
    manager_email: 'manager3@zluri.com',
  },
  {
    id: 'pod-4',
    name: 'Pod 4',
    manager_email: 'manager4@zluri.com',
  },
  {
    id: 'pod-5',
    name: 'Pod 5',
    manager_email: 'manager5@zluri.com',
  },
  {
    id: 'pod-6',
    name: 'Pod 6',
    manager_email: 'manager6@zluri.com',
  },
  {
    id: 'sre',
    name: 'SRE',
    manager_email: 'sre-lead@zluri.com',
  },
  {
    id: 'de',
    name: 'DE',
    manager_email: 'de-lead@zluri.com',
  },
];

/**
 * Get database instances array - built at RUNTIME to ensure env vars are loaded
 * FIX: Changed from const to function to avoid timing issues with dotenv
 */
function getDatabaseInstancesArray() {
  return [
    {
      id: 'database-1',
      name: 'Database-1',
      type: 'postgresql',
      host: process.env.PG_INSTANCE_1_HOST || 'localhost',
      port: parseInt(process.env.PG_INSTANCE_1_PORT, 10) || 5432,
      user: process.env.PG_INSTANCE_1_USER || process.env.DB_DEFAULT_USER || 'postgres',
      password: process.env.PG_INSTANCE_1_PASSWORD || process.env.DB_DEFAULT_PASSWORD || '',
      databases: ['dev_sre_internal_portal', 'dev_pft_db', 'dev_prefect_gcp_db', 'dev_n8n_db_rds', 'backend_triggers', 'dev_n8n_db', 'n8n', 'dev_prefect_db', 'postgres', 'dev_n8n_trigger_db', 'agents_db', 'dev_mongodb_monitoring', 'dev_cs_n8n_db', 'arush_db', 'test_backup', 'dev_retool_db', 'postgres_exporter', 'dev_n8n_database', 'dbsonarqube', 'dev_de_schema', 'stag_n8n_triggers_db', 'dev_n8n_test_db_rds', 'stag_n8n_db'],
    },
    {
      id: 'mongo-zluri-1',
      name: 'mongo-zluri-1',
      type: 'mongodb',
      uri: process.env.MONGO_INSTANCE_1_URI || 'mongodb://localhost:27017',
      databases: [
        '69401559e576ef4085e50133_test',
        '69401559e576ef4085e50133_truth',
        '694047d693600ea800754f3c_test',
        '694047d693600ea800754f3c_truth',
        '69412bf1f70d11f5688c5151_test',
        '69412bf1f70d11f5688c5151_truth',
        '69424cc632becd3ed2d68aeb_test',
        '69424cc632becd3ed2d68aeb_truth',
        '6942600ed521dfa444f4ea04_test',
        '6942600ed521dfa444f4ea04_truth',
        '6942609ec8128b37a0c68863_test',
        '6942609ec8128b37a0c68863_truth',
        '6942775cfae8702167efe369_test',
      ],
    },
  ];
}

/**
 * Get all PODs
 * @returns {Array} Array of POD objects
 */
const getAllPods = () => {
  return [...pods];
};

/**
 * Get POD by ID
 * @param {string} podId - POD identifier
 * @returns {Object|null} POD object or null
 */
const getPodById = (podId) => {
  return pods.find((pod) => pod.id === podId) || null;
};

/**
 * Get POD by manager email
 * @param {string} email - Manager email
 * @returns {Array} Array of PODs managed by this email
 */
const getPodsByManager = (email) => {
  return pods.filter((pod) => pod.manager_email === email);
};

/**
 * Get all database instances (public info only - NO databases list)
 * Databases should be fetched separately via /instances/:id/databases
 * @returns {Array} Array of database instance objects
 */
const getAllInstances = () => {
  return getDatabaseInstancesArray().map((instance) => ({
    id: instance.id,
    name: instance.name,
    type: instance.type,
  }));
};

/**
 * Get database instances by type (NO databases list)
 * Databases should be fetched separately via /instances/:id/databases
 * @param {string} type - Database type (postgresql/mongodb)
 * @returns {Array} Filtered array of instances
 */
const getInstancesByType = (type) => {
  return getDatabaseInstancesArray()
    .filter((instance) => instance.type === type.toLowerCase())
    .map((instance) => ({
      id: instance.id,
      name: instance.name,
      type: instance.type,
    }));
};

/**
 * Get instance by ID (includes connection details for internal use)
 * FIX: Returns flat structure with host, port, user, password directly
 *      instead of nested in _connection
 * @param {string} instanceId - Instance identifier
 * @returns {Object|null} Instance object or null
 */
const getInstanceById = (instanceId) => {
  const instances = getDatabaseInstancesArray();
  const instance = instances.find((inst) => inst.id === instanceId);
  
  if (!instance) return null;
  
  // Return the full instance with all connection details at top level
  // Services expect: instance.host, instance.port, instance.user, instance.password
  // NOT: instance._connection.host
  return instance;
};

/**
 * Get databases for an instance
 * @param {string} instanceId - Instance identifier
 * @returns {Array} Array of database names
 */
const getDatabasesForInstance = (instanceId) => {
  const instances = getDatabaseInstancesArray();
  const instance = instances.find((inst) => inst.id === instanceId);
  return instance ? instance.databases : [];
};

/**
 * Validate if instance and database combination exists
 * @param {string} instanceId - Instance identifier
 * @param {string} databaseName - Database name
 * @returns {boolean} Validation result
 */
const validateInstanceDatabase = (instanceId, databaseName) => {
  const instances = getDatabaseInstancesArray();
  const instance = instances.find((inst) => inst.id === instanceId);
  if (!instance) return false;
  return instance.databases.includes(databaseName);
};

module.exports = {
  pods,
  // Export getter for backward compatibility
  get databaseInstances() { return getDatabaseInstancesArray(); },
  getAllPods,
  getPodById,
  getPodsByManager,
  getAllInstances,
  getInstancesByType,
  getInstanceById,
  getDatabasesForInstance,
  validateInstanceDatabase,
};