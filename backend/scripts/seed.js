/**
 * Database Seed Script
 * Populates the database with initial test data
 * 
 * Run with: node scripts/seed.js
 */

require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'db_query_portal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Hash password helper
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// Seed users
const seedUsers = async (client) => {
  console.log('🌱 Seeding users...');
  
  const users = [
    // Admin users
    {
      email: 'admin@zluri.com',
      password: 'Admin@123!',
      name: 'System Admin',
      role: 'admin',
      podId: null,
      slackUserId: 'U001ADMIN',
    },
    
    // Manager users (one for each POD)
    {
      email: 'manager1@zluri.com',
      password: 'Manager@123!',
      name: 'POD 1 Manager',
      role: 'manager',
      podId: 'pod-1',
      slackUserId: 'U002MGR1',
    },
    {
      email: 'manager2@zluri.com',
      password: 'Manager@123!',
      name: 'POD 2 Manager',
      role: 'manager',
      podId: 'pod-2',
      slackUserId: 'U003MGR2',
    },
    {
      email: 'manager3@zluri.com',
      password: 'Manager@123!',
      name: 'POD 3 Manager',
      role: 'manager',
      podId: 'pod-3',
      slackUserId: 'U004MGR3',
    },
    {
      email: 'sre-manager@zluri.com',
      password: 'Manager@123!',
      name: 'SRE Manager',
      role: 'manager',
      podId: 'sre',
      slackUserId: 'U005MGRSRE',
    },
    {
      email: 'de-manager@zluri.com',
      password: 'Manager@123!',
      name: 'DE Manager',
      role: 'manager',
      podId: 'de',
      slackUserId: 'U006MGRDE',
    },
    
    // Developer users
    {
      email: 'dev1@zluri.com',
      password: 'Developer@123!',
      name: 'Developer One',
      role: 'developer',
      podId: 'pod-1',
      slackUserId: 'U007DEV1',
    },
    {
      email: 'dev2@zluri.com',
      password: 'Developer@123!',
      name: 'Developer Two',
      role: 'developer',
      podId: 'pod-1',
      slackUserId: 'U008DEV2',
    },
    {
      email: 'dev3@zluri.com',
      password: 'Developer@123!',
      name: 'Developer Three',
      role: 'developer',
      podId: 'pod-2',
      slackUserId: 'U009DEV3',
    },
    {
      email: 'dev4@zluri.com',
      password: 'Developer@123!',
      name: 'Developer Four',
      role: 'developer',
      podId: 'pod-3',
      slackUserId: 'U010DEV4',
    },
    {
      email: 'sre-dev@zluri.com',
      password: 'Developer@123!',
      name: 'SRE Developer',
      role: 'developer',
      podId: 'sre',
      slackUserId: 'U011DEVSR',
    },
    {
      email: 'de-dev@zluri.com',
      password: 'Developer@123!',
      name: 'DE Developer',
      role: 'developer',
      podId: 'de',
      slackUserId: 'U012DEVDE',
    },
    
    // Test user from reference
    {
      email: 'rishab.a@zluri.com',
      password: '123@Acharjee',
      name: 'Rishab Acharjee',
      role: 'developer',
      podId: 'pod-1',
      slackUserId: null,  // Will be looked up by email automatically
    },
  ];
  
  for (const user of users) {
    const passwordHash = await hashPassword(user.password);
    
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, pod_id, slack_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        pod_id = EXCLUDED.pod_id,
        slack_user_id = EXCLUDED.slack_user_id,
        updated_at = CURRENT_TIMESTAMP
    `, [user.email, passwordHash, user.name, user.role, user.podId, user.slackUserId]);
    
    console.log(`  ✅ Created/Updated user: ${user.email} (${user.role})`);
  }
  
  console.log(`✅ Seeded ${users.length} users`);
};

// Seed sample query requests
const seedQueryRequests = async (client) => {
  console.log('\n🌱 Seeding sample query requests...');
  
  // Get user IDs
  const userResult = await client.query(
    "SELECT id, email FROM users WHERE email IN ('dev1@zluri.com', 'dev2@zluri.com', 'dev3@zluri.com')"
  );
  
  if (userResult.rows.length === 0) {
    console.log('  ⚠️ No users found, skipping query request seeding');
    return;
  }
  
  const users = userResult.rows.reduce((acc, user) => {
    acc[user.email] = user.id;
    return acc;
  }, {});
  
  const requests = [
    // Pending request
    {
      userId: users['dev1@zluri.com'],
      databaseType: 'postgresql',
      instanceId: 'Database-1',
      instanceName: 'Database-1',
      databaseName: 'dev_sre_internal_portal',
      submissionType: 'query',
      queryContent: 'SELECT * FROM users LIMIT 10;',
      comments: 'Fetching sample user data for development testing',
      podId: 'pod-1',
      podName: 'Pod 1',
      status: 'pending',
    },
    
    // Another pending request (MongoDB)
    {
      userId: users['dev2@zluri.com'],
      databaseType: 'mongodb',
      instanceId: 'mongo-zluri-1',
      instanceName: 'mongo-zluri-1',
      databaseName: '69401559e576ef4085e50133_test',
      submissionType: 'query',
      queryContent: 'db.getCollection("orgintegrations").find({}).limit(5)',
      comments: 'Checking org integrations data structure',
      podId: 'pod-1',
      podName: 'Pod 1',
      status: 'pending',
    },
    
    // Completed request
    {
      userId: users['dev1@zluri.com'],
      databaseType: 'postgresql',
      instanceId: 'Database-1',
      instanceName: 'Database-1',
      databaseName: 'dev_pft_db',
      submissionType: 'query',
      queryContent: 'SELECT COUNT(*) FROM query_requests;',
      comments: 'Getting count of query requests for reporting',
      podId: 'pod-1',
      podName: 'Pod 1',
      status: 'completed',
      executionResult: { rowCount: 1, rows: [{ count: 42 }] },
    },
    
    // Rejected request
    {
      userId: users['dev3@zluri.com'],
      databaseType: 'postgresql',
      instanceId: 'Database-1',
      instanceName: 'Database-1',
      databaseName: 'prod_database',
      submissionType: 'query',
      queryContent: 'DELETE FROM users WHERE status = inactive;',
      comments: 'Cleaning up inactive users',
      podId: 'pod-2',
      podName: 'Pod 2',
      status: 'rejected',
      rejectionReason: 'DELETE without specific conditions is too dangerous. Please add more specific WHERE clauses.',
    },
    
    // Script request (pending)
    {
      userId: users['dev1@zluri.com'],
      databaseType: 'postgresql',
      instanceId: 'Database-1',
      instanceName: 'Database-1',
      databaseName: 'dev_sre_internal_portal',
      submissionType: 'script',
      scriptFilename: 'data_cleanup.js',
      scriptContent: `const { Client } = require('pg');
const config = require(process.env.DB_CONFIG_FILE);
const client = new Client(config);

async function main() {
  await client.connect();
  const result = await client.query('SELECT COUNT(*) FROM sessions WHERE expires_at < NOW()');
  console.log('Expired sessions:', result.rows[0].count);
  await client.end();
}

main().catch(console.error);`,
      comments: 'Script to count expired sessions for cleanup planning',
      podId: 'pod-1',
      podName: 'Pod 1',
      status: 'pending',
    },
  ];
  
  for (const req of requests) {
    await client.query(`
      INSERT INTO query_requests (
        user_id, database_type, instance_id, instance_name, database_name,
        submission_type, query_content, script_filename, script_content,
        comments, pod_id, pod_name, status, rejection_reason, execution_result
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      req.userId,
      req.databaseType,
      req.instanceId,
      req.instanceName,
      req.databaseName,
      req.submissionType,
      req.queryContent || null,
      req.scriptFilename || null,
      req.scriptContent || null,
      req.comments,
      req.podId,
      req.podName,
      req.status,
      req.rejectionReason || null,
      req.executionResult ? JSON.stringify(req.executionResult) : null,
    ]);
    
    console.log(`  ✅ Created request: ${req.submissionType} - ${req.status}`);
  }
  
  console.log(`✅ Seeded ${requests.length} query requests`);
};

// Main seed function
const seed = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database seeding...\n');
    
    await client.query('BEGIN');
    
    await seedUsers(client);
    await seedQueryRequests(client);
    
    await client.query('COMMIT');
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('  Admin:     admin@zluri.com / Admin@123!');
    console.log('  Manager:   manager1@zluri.com / Manager@123!');
    console.log('  Developer: dev1@zluri.com / Developer@123!');
    console.log('  Reference: rishab.a@zluri.com / Rishab@123!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run seeding
seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
