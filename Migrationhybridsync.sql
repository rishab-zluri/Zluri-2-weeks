-- ============================================================================
-- MIGRATION: Add Hybrid Sync Features
-- ============================================================================
-- Run this AFTER your existing schema is already in place
-- This adds columns and tables needed for the hybrid database sync approach
-- ============================================================================

-- ============================================================================
-- 1. ADD COLUMNS TO database_instances TABLE
-- ============================================================================

-- Add credentials reference column
ALTER TABLE database_instances 
ADD COLUMN IF NOT EXISTS credentials_env_prefix VARCHAR(100);

-- Add MongoDB connection string env reference
ALTER TABLE database_instances 
ADD COLUMN IF NOT EXISTS connection_string_env VARCHAR(100);

-- Add sync tracking columns
ALTER TABLE database_instances 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE database_instances 
ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(20) 
CHECK (last_sync_status IN ('success', 'failed', 'pending'));

ALTER TABLE database_instances 
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

ALTER TABLE database_instances 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing instances with credentials_env_prefix
UPDATE database_instances SET credentials_env_prefix = 'DATABASE_1' WHERE id = 'database-1';
UPDATE database_instances SET credentials_env_prefix = 'PROD_BE_APP_RDS' WHERE id = 'prod-be-app-rds';
UPDATE database_instances SET credentials_env_prefix = 'DEV_BE_APP_RDS' WHERE id = 'dev-be-app-rds';
UPDATE database_instances SET credentials_env_prefix = 'MONGO_ZLURI_1' WHERE id = 'mongo-zluri-1';
UPDATE database_instances SET credentials_env_prefix = 'ZLURI_PRODDB' WHERE id = 'zluri-proddb';

-- ============================================================================
-- 2. ADD COLUMNS TO databases TABLE
-- ============================================================================

-- Add source tracking (manual vs synced)
ALTER TABLE databases 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual' 
CHECK (source IN ('manual', 'synced'));

-- Add last seen timestamp
ALTER TABLE databases 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at column
ALTER TABLE databases 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 3. CREATE database_blacklist TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS database_blacklist (
    id SERIAL PRIMARY KEY,
    pattern VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(20) NOT NULL DEFAULT 'exact' 
        CHECK (pattern_type IN ('exact', 'prefix', 'regex')),
    reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default blacklist entries
INSERT INTO database_blacklist (pattern, pattern_type, reason) VALUES
    ('template0', 'exact', 'PostgreSQL system database'),
    ('template1', 'exact', 'PostgreSQL system database'),
    ('postgres', 'exact', 'PostgreSQL default database'),
    ('rdsadmin', 'exact', 'AWS RDS admin database'),
    ('admin', 'exact', 'MongoDB admin database'),
    ('local', 'exact', 'MongoDB local database'),
    ('config', 'exact', 'MongoDB config database')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. CREATE database_sync_history TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS database_sync_history (
    id SERIAL PRIMARY KEY,
    instance_id VARCHAR(100) REFERENCES database_instances(id) ON DELETE CASCADE,
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

-- ============================================================================
-- 5. ADD NEW INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_database_instances_is_active ON database_instances(is_active);
CREATE INDEX IF NOT EXISTS idx_databases_is_active ON databases(is_active);
CREATE INDEX IF NOT EXISTS idx_databases_name ON databases(name);
CREATE INDEX IF NOT EXISTS idx_sync_history_instance_id ON database_sync_history(instance_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_created_at ON database_sync_history(created_at DESC);

-- ============================================================================
-- 6. ADD NEW TRIGGERS
-- ============================================================================

-- Trigger for databases table
DROP TRIGGER IF EXISTS update_databases_updated_at ON databases;
CREATE TRIGGER update_databases_updated_at
    BEFORE UPDATE ON databases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for database_instances table
DROP TRIGGER IF EXISTS update_database_instances_updated_at ON database_instances;
CREATE TRIGGER update_database_instances_updated_at
    BEFORE UPDATE ON database_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Migration completed!' AS status;
SELECT 'Blacklist entries: ' || COUNT(*) FROM database_blacklist;
SELECT 'database_instances now has columns: ' || string_agg(column_name, ', ') 
FROM information_schema.columns 
WHERE table_name = 'database_instances' 
  AND column_name IN ('credentials_env_prefix', 'last_sync_at', 'last_sync_status');