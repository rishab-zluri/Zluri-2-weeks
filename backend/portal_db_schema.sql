-- ============================================================================
-- DATABASE QUERY EXECUTION PORTAL - PORTAL DATABASE SCHEMA
-- ============================================================================
-- 
-- Purpose: This is the main application database that stores all portal data
--          including users, query requests, approvals, and audit trails.
--
-- Database Name: portal_db (or your chosen name)
-- Database Type: PostgreSQL 12+
--
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
-- Required PostgreSQL extensions for UUID generation and cryptographic functions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Stores user accounts with authentication and authorization data
-- Supports three roles: developer, manager, admin
--
-- Features:
--   - UUID primary key for security (prevents enumeration)
--   - Password hashing with bcrypt
--   - POD membership for team organization
--   - Slack integration for notifications
--   - Soft delete via is_active flag

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'developer' 
        CHECK (role IN ('developer', 'manager', 'admin')),
    pod_id VARCHAR(50),
    slack_user_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_pod_id ON users(pod_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- TABLE: refresh_tokens
-- ============================================================================
-- Stores refresh tokens for JWT authentication
-- Enables secure logout and "logout everywhere" functionality
--
-- Features:
--   - Token stored as SHA-256 hash (not plain text)
--   - Device/IP tracking for session management
--   - Soft revocation with timestamp

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for refresh_tokens table
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id, is_revoked, expires_at);

-- ============================================================================
-- TABLE: access_token_blacklist
-- ============================================================================
-- Stores blacklisted access tokens (logged out tokens)
-- Enables immediate token invalidation on logout
--
-- Features:
--   - Token stored as SHA-256 hash (not plain text)
--   - Auto-cleanup of expired entries
--   - Prevents use of access tokens after logout

CREATE TABLE IF NOT EXISTS access_token_blacklist (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(50) DEFAULT 'logout'
);

-- Indexes for access_token_blacklist table
CREATE INDEX IF NOT EXISTS idx_blacklist_token_hash ON access_token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON access_token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_user_id ON access_token_blacklist(user_id);

-- ============================================================================
-- TABLE: user_token_invalidation
-- ============================================================================
-- Tracks bulk token invalidation (logout-all functionality)
-- When a user logs out from all devices, all tokens issued before
-- the invalidation timestamp are considered invalid

CREATE TABLE IF NOT EXISTS user_token_invalidation (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    invalidated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: pods
-- ============================================================================
-- Stores POD (team) configurations for approval routing
-- Each POD has a designated manager who approves requests

CREATE TABLE IF NOT EXISTS pods (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_email VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: database_instances
-- ============================================================================
-- Stores target database instance configurations
-- Supports both PostgreSQL and MongoDB instances
--
-- Features:
--   - Credentials stored via environment variable prefix (not in DB)
--   - Sync tracking for hybrid database discovery
--   - Connection string support for MongoDB Atlas

CREATE TABLE IF NOT EXISTS database_instances (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('postgresql', 'mongodb')),
    host VARCHAR(255),  -- Nullable for connection-string-based instances
    port INTEGER,       -- Nullable for connection-string-based instances
    description TEXT,
    credentials_env_prefix VARCHAR(100),
    connection_string_env VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('success', 'failed', 'pending')),
    last_sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Ensure either (host AND port) OR connection_string_env is provided
    CONSTRAINT check_connection_method CHECK (
        (host IS NOT NULL AND port IS NOT NULL) OR 
        (connection_string_env IS NOT NULL)
    )
);

-- Indexes for database_instances table
CREATE INDEX IF NOT EXISTS idx_database_instances_type ON database_instances(type);
CREATE INDEX IF NOT EXISTS idx_database_instances_is_active ON database_instances(is_active);

-- ============================================================================
-- TABLE: databases
-- ============================================================================
-- Stores available databases within each instance
-- Populated via sync from actual instances or manual entry
--
-- Features:
--   - Source tracking (synced vs manual)
--   - Soft delete via is_active flag
--   - Last seen timestamp for stale detection

CREATE TABLE IF NOT EXISTS databases (
    id SERIAL PRIMARY KEY,
    instance_id VARCHAR(100) NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(20) DEFAULT 'synced' CHECK (source IN ('synced', 'manual')),
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instance_id, name)
);

-- Indexes for databases table
CREATE INDEX IF NOT EXISTS idx_databases_instance_id ON databases(instance_id);
CREATE INDEX IF NOT EXISTS idx_databases_is_active ON databases(is_active);
CREATE INDEX IF NOT EXISTS idx_databases_name ON databases(name);

-- ============================================================================
-- TABLE: database_blacklist
-- ============================================================================
-- Stores patterns for databases to exclude from sync
-- Prevents system databases from appearing in dropdowns
--
-- Pattern types:
--   - exact: Exact match (e.g., "postgres")
--   - prefix: Starts with (e.g., "template")
--   - regex: Regular expression match

CREATE TABLE IF NOT EXISTS database_blacklist (
    id SERIAL PRIMARY KEY,
    pattern VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(20) NOT NULL DEFAULT 'exact' 
        CHECK (pattern_type IN ('exact', 'prefix', 'regex')),
    reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for database_blacklist table
CREATE INDEX IF NOT EXISTS idx_database_blacklist_pattern ON database_blacklist(pattern);

-- ============================================================================
-- TABLE: database_sync_history
-- ============================================================================
-- Tracks database sync operations for auditing and debugging
--
-- Sync types:
--   - startup: Automatic sync on server start
--   - scheduled: Periodic background sync
--   - manual: Admin-triggered sync

CREATE TABLE IF NOT EXISTS database_sync_history (
    id SERIAL PRIMARY KEY,
    instance_id VARCHAR(100) NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'startup')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    databases_found INTEGER DEFAULT 0,
    databases_added INTEGER DEFAULT 0,
    databases_removed INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    triggered_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for database_sync_history table
CREATE INDEX IF NOT EXISTS idx_database_sync_history_instance_id ON database_sync_history(instance_id);
CREATE INDEX IF NOT EXISTS idx_database_sync_history_created_at ON database_sync_history(created_at DESC);

-- ============================================================================
-- TABLE: query_requests
-- ============================================================================
-- Main table for all query/script submission requests
-- This is the core table of the application
--
-- Workflow states:
--   pending -> approved -> executing -> completed/failed
--   pending -> rejected
--
-- Features:
--   - UUID for external references (prevents enumeration)
--   - Full audit trail with timestamps
--   - Execution results storage

CREATE TABLE IF NOT EXISTS query_requests (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    
    -- Submitter information
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Target database selection
    database_type VARCHAR(20) NOT NULL CHECK (database_type IN ('postgresql', 'mongodb')),
    instance_id VARCHAR(100) NOT NULL,
    instance_name VARCHAR(255) NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    
    -- Submission content
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('query', 'script')),
    query_content TEXT,
    script_filename VARCHAR(255),
    script_content TEXT,
    
    -- Request metadata
    comments TEXT NOT NULL,
    pod_id VARCHAR(50) NOT NULL,
    pod_name VARCHAR(100) NOT NULL,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed')),
    
    -- Approval information
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approver_email VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Execution results
    execution_result TEXT,
    execution_error TEXT,
    execution_started_at TIMESTAMP WITH TIME ZONE,
    execution_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query_requests table
CREATE INDEX IF NOT EXISTS idx_query_requests_uuid ON query_requests(uuid);
CREATE INDEX IF NOT EXISTS idx_query_requests_user_id ON query_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_query_requests_status ON query_requests(status);
CREATE INDEX IF NOT EXISTS idx_query_requests_pod_id ON query_requests(pod_id);
CREATE INDEX IF NOT EXISTS idx_query_requests_database_type ON query_requests(database_type);
CREATE INDEX IF NOT EXISTS idx_query_requests_created_at ON query_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_requests_approver_id ON query_requests(approver_id);

-- ============================================================================
-- TABLE: slack_notifications
-- ============================================================================
-- Tracks all Slack notifications sent by the system
-- Supports retry logic and delivery confirmation

CREATE TABLE IF NOT EXISTS slack_notifications (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES query_requests(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL 
        CHECK (notification_type IN ('new_submission', 'approval', 'rejection', 'execution_success', 'execution_failure')),
    channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('channel', 'dm')),
    recipient VARCHAR(255) NOT NULL,
    message_ts VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for slack_notifications table
CREATE INDEX IF NOT EXISTS idx_slack_notifications_request_id ON slack_notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_status ON slack_notifications(status);

-- ============================================================================
-- TABLE: audit_logs
-- ============================================================================
-- Maintains comprehensive audit trail of all system actions
-- Stores before/after values as JSONB for flexibility

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Cleanup expired refresh tokens (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
       OR is_revoked = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Cleanup expired blacklist entries (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_blacklist()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM access_token_blacklist
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Auto-update users.updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update query_requests.updated_at
DROP TRIGGER IF EXISTS update_query_requests_updated_at ON query_requests;
CREATE TRIGGER update_query_requests_updated_at
    BEFORE UPDATE ON query_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update databases.updated_at
DROP TRIGGER IF EXISTS update_databases_updated_at ON databases;
CREATE TRIGGER update_databases_updated_at
    BEFORE UPDATE ON databases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update database_instances.updated_at
DROP TRIGGER IF EXISTS update_database_instances_updated_at ON database_instances;
CREATE TRIGGER update_database_instances_updated_at
    BEFORE UPDATE ON database_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Default Users
-- ============================================================================
-- Password for all users: Test@123
-- Hash generated with bcrypt (10 rounds)

INSERT INTO users (email, password_hash, name, role, pod_id, is_active) VALUES
    ('admin@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Admin User', 'admin', NULL, true),
    ('manager1@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Pod 1 Manager', 'manager', 'pod-1', true),
    ('manager2@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'DE Manager', 'manager', 'de', true),
    ('developer1@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Developer One', 'developer', 'pod-1', true),
    ('developer2@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Developer Two', 'developer', 'de', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- SEED DATA: POD Configurations
-- ============================================================================

INSERT INTO pods (id, name, manager_email, description) VALUES
    ('pod-1', 'Pod 1', 'manager1@zluri.com', 'Product Development Pod 1'),
    ('pod-2', 'Pod 2', 'manager2@zluri.com', 'Product Development Pod 2'),
    ('pod-3', 'Pod 3', 'manager3@zluri.com', 'Product Development Pod 3'),
    ('pod-4', 'Pod 4', 'manager4@zluri.com', 'Product Development Pod 4'),
    ('pod-5', 'Pod 5', 'manager5@zluri.com', 'Product Development Pod 5'),
    ('pod-6', 'Pod 6', 'manager6@zluri.com', 'Product Development Pod 6'),
    ('de', 'DE', 'de-lead@zluri.com', 'Data Engineering Team'),
    ('sre', 'SRE', 'sre-lead@zluri.com', 'Site Reliability Engineering')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED DATA: Database Instances
-- ============================================================================
-- Note: Actual credentials are stored in environment variables, not in DB

INSERT INTO database_instances (id, name, type, host, port, description, credentials_env_prefix) VALUES
    ('database-1', 'Database-1', 'postgresql', 'localhost', 5432, 'Primary PostgreSQL Instance', 'PG_INSTANCE_1'),
    ('mongo-zluri-1', 'mongo-zluri-1', 'mongodb', 'localhost', 27017, 'Primary MongoDB Instance', 'MONGO_INSTANCE_1')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED DATA: Database Blacklist (System databases to exclude)
-- ============================================================================

INSERT INTO database_blacklist (pattern, pattern_type, reason) VALUES
    ('template0', 'exact', 'PostgreSQL template database - read only'),
    ('template1', 'exact', 'PostgreSQL template database'),
    ('postgres', 'exact', 'PostgreSQL system database'),
    ('rdsadmin', 'exact', 'AWS RDS admin database'),
    ('admin', 'exact', 'MongoDB admin database'),
    ('local', 'exact', 'MongoDB local database'),
    ('config', 'exact', 'MongoDB config database')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Portal DB Schema created successfully!' AS status;
SELECT 'Tables created: ' || COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
