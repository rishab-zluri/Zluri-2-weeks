-- ============================================================
-- Database Query Execution Portal - Complete Schema
-- ============================================================
-- This schema supports all functional requirements:
-- FR1: Authentication (users table)
-- FR2: Query Submission (query_requests table)
-- FR3: Approval Dashboard (query_requests with status filters)
-- FR4: Approval Actions (status updates, approver tracking)
-- FR5: Query/Script Execution (execution results storage)
-- FR6: Slack Integration (slack_user_id for DMs)
-- FR7: Developer History (user_id foreign key for filtering)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE (FR1: Authentication)
-- ============================================================
-- Stores user accounts with roles (developer, manager, admin)
-- Supports FR1.1 (username/password), FR1.2 (session tokens via JWT),
-- FR1.3 (email, name, POD membership)

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'developer' 
        CHECK (role IN ('developer', 'manager', 'admin')),
    pod_id VARCHAR(50),
    slack_user_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DATABASE INSTANCES TABLE (FR2: Query Submission)
-- ============================================================
-- Stores available database instances for PostgreSQL and MongoDB
-- Supports FR2.1 (Database Type, Instance dropdowns)

CREATE TABLE IF NOT EXISTS database_instances (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('postgresql', 'mongodb')),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DATABASES TABLE (FR2: Query Submission)
-- ============================================================
-- Stores available databases within each instance
-- Supports FR2.1 (Database Name dropdown - cascading)

CREATE TABLE IF NOT EXISTS databases (
    id SERIAL PRIMARY KEY,
    instance_id VARCHAR(100) REFERENCES database_instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instance_id, name)
);

-- ============================================================
-- PODS TABLE (FR2, FR3: POD Management)
-- ============================================================
-- Stores POD configurations for approval routing
-- Supports FR2.1 (POD dropdown), FR3.3 (Manager POD filtering)

CREATE TABLE IF NOT EXISTS pods (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_email VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- QUERY REQUESTS TABLE (FR2, FR3, FR4, FR5, FR7)
-- ============================================================
-- Main table for all query/script submissions
-- Supports:
-- FR2.1-2.4: Query submission with all fields
-- FR3.1-3.4: Approval dashboard queries
-- FR4.1-4.2: Approval/rejection actions
-- FR5.1-5.3: Execution results storage
-- FR7.1-7.3: Developer history and cloning

CREATE TABLE IF NOT EXISTS query_requests (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    
    -- Submitter info (FR2, FR7)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Database selection (FR2.1)
    database_type VARCHAR(20) NOT NULL CHECK (database_type IN ('postgresql', 'mongodb')),
    instance_id VARCHAR(100) NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    
    -- Submission type and content (FR2.1)
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('query', 'script')),
    query_content TEXT,
    script_filename VARCHAR(255),
    script_path VARCHAR(500),
    script_content TEXT,
    
    -- Comments and POD (FR2.1)
    comments TEXT NOT NULL,
    pod_id VARCHAR(50) NOT NULL,
    
    -- Status tracking (FR3, FR4)
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed')),
    
    -- Approval info (FR4)
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Execution results (FR5)
    execution_result TEXT,
    execution_error TEXT,
    execution_duration_ms INTEGER,
    rows_affected INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SLACK NOTIFICATIONS TABLE (FR6: Slack Integration)
-- ============================================================
-- Tracks all Slack notifications sent
-- Supports FR6: Notification tracking and retry logic

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

-- ============================================================
-- AUDIT LOG TABLE (Audit Trail Requirement)
-- ============================================================
-- Maintains audit trail of all requests and executions
-- Supports Goal #3: Maintain audit trail

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

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_pod_id ON users(pod_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Query requests indexes (FR3.2: Filters, FR7.1: User history)
CREATE INDEX IF NOT EXISTS idx_query_requests_user_id ON query_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_query_requests_status ON query_requests(status);
CREATE INDEX IF NOT EXISTS idx_query_requests_pod_id ON query_requests(pod_id);
CREATE INDEX IF NOT EXISTS idx_query_requests_database_type ON query_requests(database_type);
CREATE INDEX IF NOT EXISTS idx_query_requests_created_at ON query_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_requests_approver_id ON query_requests(approver_id);
CREATE INDEX IF NOT EXISTS idx_query_requests_uuid ON query_requests(uuid);

-- Database instances indexes
CREATE INDEX IF NOT EXISTS idx_database_instances_type ON database_instances(type);
CREATE INDEX IF NOT EXISTS idx_databases_instance_id ON databases(instance_id);

-- Slack notifications indexes
CREATE INDEX IF NOT EXISTS idx_slack_notifications_request_id ON slack_notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_status ON slack_notifications(status);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- SEED DATA: DEFAULT USERS
-- ============================================================
-- Password for all users: Test@123
-- Hash generated with bcrypt (10 rounds)

INSERT INTO users (email, password_hash, name, role, pod_id, is_active) VALUES
    ('admin@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Admin User', 'admin', NULL, true),
    ('manager1@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Pod 1 Manager', 'manager', 'pod-1', true),
    ('manager2@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'DE Manager', 'manager', 'de', true),
    ('developer1@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Developer One', 'developer', 'pod-1', true),
    ('developer2@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Developer Two', 'developer', 'de', true),
    ('rishab.a@zluri.com', '$2b$10$exP6MfZNoaOndNT.d.Ddv.elvBK1QEioHaSihJM5YC3frRNde6Q/i', 'Rishab Acharjee', 'admin', 'pod-1', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- SEED DATA: POD CONFIGURATIONS
-- ============================================================
-- As per PRD POD Configuration

INSERT INTO pods (id, name, manager_email, description) VALUES
    ('pod-1', 'Pod 1', 'manager1@zluri.com', 'Product Development Pod 1'),
    ('pod-2', 'Pod 2', 'manager1@zluri.com', 'Product Development Pod 2'),
    ('pod-3', 'Pod 3', 'manager1@zluri.com', 'Product Development Pod 3'),
    ('pod-4', 'Pod 4', 'manager1@zluri.com', 'Product Development Pod 4'),
    ('pod-5', 'Pod 5', 'manager1@zluri.com', 'Product Development Pod 5'),
    ('pod-6', 'Pod 6', 'manager1@zluri.com', 'Product Development Pod 6'),
    ('de', 'DE', 'manager2@zluri.com', 'Data Engineering Team'),
    ('sre', 'SRE', 'admin@zluri.com', 'Site Reliability Engineering'),
    ('db', 'DB', 'admin@zluri.com', 'Database Administration Team')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: DATABASE INSTANCES
-- ============================================================
-- Sample database instances as shown in the reference screenshots

INSERT INTO database_instances (id, name, type, host, port, description) VALUES
    ('database-1', 'Database-1', 'postgresql', 'localhost', 5432, 'Primary PostgreSQL Instance'),
    ('prod-be-app-rds', 'prod-be-app-rds', 'postgresql', 'prod-be-app-rds.cluster.amazonaws.com', 5432, 'Production Backend RDS'),
    ('dev-be-app-rds', 'dev-be-app-rds', 'postgresql', 'dev-be-app-rds.cluster.amazonaws.com', 5432, 'Development Backend RDS'),
    ('mongo-zluri-1', 'mongo-zluri-1', 'mongodb', 'mongo-zluri-1.cluster.mongodb.net', 27017, 'Primary MongoDB Cluster'),
    ('zluri-proddb', 'Zluri-ProdDB', 'mongodb', 'zluri-proddb.cluster.mongodb.net', 27017, 'Production MongoDB')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: DATABASES WITHIN INSTANCES
-- ============================================================
-- Sample databases as shown in reference screenshots

INSERT INTO databases (instance_id, name, description) VALUES
    -- PostgreSQL databases
    ('database-1', 'dev_sre_internal_portal', 'SRE Internal Portal Dev Database'),
    ('database-1', 'dev_pft_db', 'PFT Development Database'),
    ('database-1', 'dev_prefect_gcp_db', 'Prefect GCP Database'),
    ('database-1', 'dev_n8n_db_rds', 'N8N RDS Database'),
    ('database-1', 'backend_triggers', 'Backend Triggers Database'),
    ('database-1', 'dev_n8n_db', 'N8N Development Database'),
    ('database-1', 'n8n', 'N8N Database'),
    ('database-1', 'dev_prefect_db', 'Prefect Dev Database'),
    ('database-1', 'postgres', 'Default Postgres Database'),
    ('database-1', 'dev_n8n_trigger_db', 'N8N Trigger Database'),
    ('database-1', 'agents_db', 'Agents Database'),
    ('database-1', 'dev_mongodb_monitoring', 'MongoDB Monitoring Database'),
    ('database-1', 'dev_cs_n8n_db', 'CS N8N Database'),
    ('database-1', 'test_backup', 'Test Backup Database'),
    ('database-1', 'dev_retool_db', 'Retool Dev Database'),
    ('database-1', 'postgres_exporter', 'Postgres Exporter Database'),
    ('database-1', 'dev_n8n_database', 'N8N Database Dev'),
    ('database-1', 'dbsonarqube', 'SonarQube Database'),
    ('database-1', 'dev_de_schema', 'DE Schema Database'),
    
    -- MongoDB databases (from screenshots)
    ('mongo-zluri-1', '69401559e576ef4085e50133_test', 'Test Database 1'),
    ('mongo-zluri-1', '69401559e576ef4085e50133_truth', 'Truth Database 1'),
    ('mongo-zluri-1', '694047d693600ea800754f3c_test', 'Test Database 2'),
    ('mongo-zluri-1', '694047d693600ea800754f3c_truth', 'Truth Database 2'),
    ('mongo-zluri-1', '69412bf1f70d11f5688c5151_test', 'Test Database 3'),
    ('mongo-zluri-1', '69412bf1f70d11f5688c5151_truth', 'Truth Database 3')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FUNCTION: Update timestamp trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_query_requests_updated_at ON query_requests;
CREATE TRIGGER update_query_requests_updated_at
    BEFORE UPDATE ON query_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

SELECT 'Schema creation completed!' AS status;
SELECT 'Users created: ' || COUNT(*) FROM users;
SELECT 'PODs created: ' || COUNT(*) FROM pods;
SELECT 'Database instances created: ' || COUNT(*) FROM database_instances;
SELECT 'Databases created: ' || COUNT(*) FROM databases;
