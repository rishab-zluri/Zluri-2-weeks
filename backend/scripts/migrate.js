/**
 * Database Migration Script
 * Creates all required tables with proper constraints, indexes, and security measures
 * 
 * Run with: node scripts/migrate.js
 */

require('dotenv').config();

const { Pool } = require('pg');
const logger = require('../src/utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'db_query_portal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const migrations = [
  // Enable UUID extension
  {
    name: 'enable_uuid_extension',
    up: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    down: `DROP EXTENSION IF EXISTS "uuid-ossp";`,
  },
  
  // Create users table
  {
    name: 'create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'developer' CHECK (role IN ('developer', 'manager', 'admin')),
        pod_id VARCHAR(100),
        slack_user_id VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_pod_id ON users(pod_id);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      
      -- Create updated_at trigger function
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      -- Create trigger for users
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
    down: `
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      DROP TABLE IF EXISTS users CASCADE;
    `,
  },
  
  // Create query_requests table
  {
    name: 'create_query_requests_table',
    up: `
      CREATE TABLE IF NOT EXISTS query_requests (
        id SERIAL PRIMARY KEY,
        uuid UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Database selection
        database_type VARCHAR(50) NOT NULL CHECK (database_type IN ('postgresql', 'mongodb')),
        instance_id VARCHAR(100) NOT NULL,
        instance_name VARCHAR(255) NOT NULL,
        database_name VARCHAR(255) NOT NULL,
        
        -- Submission details
        submission_type VARCHAR(50) NOT NULL CHECK (submission_type IN ('query', 'script')),
        query_content TEXT,
        script_filename VARCHAR(255),
        script_content TEXT,
        comments TEXT NOT NULL,
        
        -- POD assignment
        pod_id VARCHAR(100) NOT NULL,
        pod_name VARCHAR(255) NOT NULL,
        
        -- Status tracking
        status VARCHAR(50) NOT NULL DEFAULT 'pending' 
          CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed')),
        
        -- Approval details
        approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
        approver_email VARCHAR(255),
        approved_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        
        -- Execution results
        execution_result JSONB,
        execution_error TEXT,
        execution_started_at TIMESTAMP WITH TIME ZONE,
        execution_completed_at TIMESTAMP WITH TIME ZONE,
        
        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- Constraints
        CONSTRAINT query_or_script_required CHECK (
          (submission_type = 'query' AND query_content IS NOT NULL AND query_content <> '') OR
          (submission_type = 'script' AND script_content IS NOT NULL AND script_content <> '')
        )
      );
      
      -- Create indexes for query_requests
      CREATE INDEX IF NOT EXISTS idx_query_requests_uuid ON query_requests(uuid);
      CREATE INDEX IF NOT EXISTS idx_query_requests_user_id ON query_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_query_requests_status ON query_requests(status);
      CREATE INDEX IF NOT EXISTS idx_query_requests_pod_id ON query_requests(pod_id);
      CREATE INDEX IF NOT EXISTS idx_query_requests_database_type ON query_requests(database_type);
      CREATE INDEX IF NOT EXISTS idx_query_requests_instance_id ON query_requests(instance_id);
      CREATE INDEX IF NOT EXISTS idx_query_requests_created_at ON query_requests(created_at);
      CREATE INDEX IF NOT EXISTS idx_query_requests_approver_id ON query_requests(approver_id);
      
      -- Composite index for pending requests by POD
      CREATE INDEX IF NOT EXISTS idx_query_requests_pending_pod 
        ON query_requests(status, pod_id) WHERE status = 'pending';
      
      -- Create trigger for query_requests
      DROP TRIGGER IF EXISTS update_query_requests_updated_at ON query_requests;
      CREATE TRIGGER update_query_requests_updated_at
        BEFORE UPDATE ON query_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
    down: `
      DROP TRIGGER IF EXISTS update_query_requests_updated_at ON query_requests;
      DROP TABLE IF EXISTS query_requests CASCADE;
    `,
  },
  
  // Create audit_logs table for security tracking
  {
    name: 'create_audit_logs_table',
    up: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create indexes for audit_logs
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      
      -- Composite index for user action history
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action 
        ON audit_logs(user_id, action, created_at);
    `,
    down: `
      DROP TABLE IF EXISTS audit_logs CASCADE;
    `,
  },
  
  // Create sessions table for token blacklisting/management
  {
    name: 'create_sessions_table',
    up: `
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        is_valid BOOLEAN NOT NULL DEFAULT true,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create indexes for sessions
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON sessions(is_valid);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      
      -- Create function to clean up expired sessions
      CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
      RETURNS void AS $$
      BEGIN
        DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP OR is_valid = false;
      END;
      $$ language 'plpgsql';
    `,
    down: `
      DROP FUNCTION IF EXISTS cleanup_expired_sessions;
      DROP TABLE IF EXISTS sessions CASCADE;
    `,
  },
  
  // Create database for RBAC permissions
  {
    name: 'create_permissions_table',
    up: `
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        role VARCHAR(50) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        conditions JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(role, resource, action)
      );
      
      -- Insert default permissions
      INSERT INTO permissions (role, resource, action) VALUES
        -- Developer permissions
        ('developer', 'query_request', 'create'),
        ('developer', 'query_request', 'read_own'),
        ('developer', 'query_request', 'clone_own'),
        ('developer', 'instances', 'read'),
        ('developer', 'databases', 'read'),
        ('developer', 'pods', 'read'),
        
        -- Manager permissions (inherits developer + additional)
        ('manager', 'query_request', 'create'),
        ('manager', 'query_request', 'read_own'),
        ('manager', 'query_request', 'clone_own'),
        ('manager', 'query_request', 'read_pod'),
        ('manager', 'query_request', 'approve'),
        ('manager', 'query_request', 'reject'),
        ('manager', 'instances', 'read'),
        ('manager', 'databases', 'read'),
        ('manager', 'pods', 'read'),
        
        -- Admin permissions (full access)
        ('admin', 'query_request', 'create'),
        ('admin', 'query_request', 'read_all'),
        ('admin', 'query_request', 'approve'),
        ('admin', 'query_request', 'reject'),
        ('admin', 'query_request', 'delete'),
        ('admin', 'users', 'create'),
        ('admin', 'users', 'read'),
        ('admin', 'users', 'update'),
        ('admin', 'users', 'delete'),
        ('admin', 'instances', 'read'),
        ('admin', 'databases', 'read'),
        ('admin', 'pods', 'read'),
        ('admin', 'audit_logs', 'read')
      ON CONFLICT (role, resource, action) DO NOTHING;
      
      CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role);
      CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
    `,
    down: `
      DROP TABLE IF EXISTS permissions CASCADE;
    `,
  },
];

// Migration tracking table
const createMigrationTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

// Check if migration has been run
const hasMigrationRun = async (name) => {
  const result = await pool.query(
    'SELECT id FROM schema_migrations WHERE name = $1',
    [name]
  );
  return result.rows.length > 0;
};

// Record migration as completed
const recordMigration = async (name) => {
  await pool.query(
    'INSERT INTO schema_migrations (name) VALUES ($1)',
    [name]
  );
};

// Run all migrations
const runMigrations = async () => {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migrations...\n');
    
    await createMigrationTable();
    
    for (const migration of migrations) {
      const hasRun = await hasMigrationRun(migration.name);
      
      if (hasRun) {
        console.log(`⏭️  Skipping: ${migration.name} (already executed)`);
        continue;
      }
      
      console.log(`🔄 Running: ${migration.name}`);
      
      await client.query('BEGIN');
      
      try {
        await client.query(migration.up);
        await recordMigration(migration.name);
        await client.query('COMMIT');
        console.log(`✅ Completed: ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Rollback last migration
const rollbackMigration = async () => {
  const client = await pool.connect();
  
  try {
    // Get last migration
    const result = await client.query(
      'SELECT name FROM schema_migrations ORDER BY executed_at DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0].name;
    const migration = migrations.find(m => m.name === lastMigration);
    
    if (!migration) {
      console.error(`Migration ${lastMigration} not found in migrations list`);
      return;
    }
    
    console.log(`🔄 Rolling back: ${lastMigration}`);
    
    await client.query('BEGIN');
    
    try {
      await client.query(migration.down);
      await client.query('DELETE FROM schema_migrations WHERE name = $1', [lastMigration]);
      await client.query('COMMIT');
      console.log(`✅ Rolled back: ${lastMigration}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Rollback failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// CLI interface
const command = process.argv[2];

if (command === 'rollback') {
  rollbackMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations, rollbackMigration };
