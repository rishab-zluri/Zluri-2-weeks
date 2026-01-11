-- ============================================================================
-- Migration: Add tables for database sync service (hybrid approach)
-- FIXED: Uses correct types (UUID for users.id, VARCHAR for database_instances.id)
-- ============================================================================

-- Drop incorrectly created tables if they exist (from failed migration)
DROP TABLE IF EXISTS database_sync_history CASCADE;
DROP TABLE IF EXISTS database_blacklist CASCADE;

-- Create database_blacklist table with UUID for created_by
CREATE TABLE database_blacklist (
    id SERIAL PRIMARY KEY,
    pattern VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('exact', 'prefix', 'regex')),
    reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create database_sync_history table with VARCHAR for instance_id
CREATE TABLE database_sync_history (
    id SERIAL PRIMARY KEY,
    instance_id VARCHAR(100) NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('startup', 'scheduled', 'manual')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    databases_found INTEGER DEFAULT 0,
    databases_added INTEGER DEFAULT 0,
    databases_removed INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    triggered_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fix databases table if instance_id type is wrong
-- First check if it needs fixing
DO $$
BEGIN
    -- Check if databases.instance_id is INTEGER (wrong type)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'databases' 
        AND column_name = 'instance_id' 
        AND data_type = 'integer'
    ) THEN
        -- Drop and recreate with correct type
        DROP TABLE IF EXISTS databases CASCADE;
        
        CREATE TABLE databases (
            id SERIAL PRIMARY KEY,
            instance_id VARCHAR(100) NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            source VARCHAR(20) DEFAULT 'synced' CHECK (source IN ('synced', 'manual')),
            is_active BOOLEAN DEFAULT true,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(instance_id, name)
        );
        
        RAISE NOTICE 'Recreated databases table with VARCHAR instance_id';
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_databases_instance_id ON databases(instance_id);
CREATE INDEX IF NOT EXISTS idx_databases_is_active ON databases(is_active);
CREATE INDEX IF NOT EXISTS idx_database_sync_history_instance_id ON database_sync_history(instance_id);
CREATE INDEX IF NOT EXISTS idx_database_sync_history_created_at ON database_sync_history(created_at);
CREATE INDEX IF NOT EXISTS idx_database_blacklist_pattern ON database_blacklist(pattern);

-- Add default blacklist patterns (system databases to exclude)
INSERT INTO database_blacklist (pattern, pattern_type, reason) VALUES
    ('template0', 'exact', 'PostgreSQL template database'),
    ('template1', 'exact', 'PostgreSQL template database'),
    ('postgres', 'exact', 'PostgreSQL system database'),
    ('admin', 'exact', 'MongoDB admin database'),
    ('local', 'exact', 'MongoDB local database'),
    ('config', 'exact', 'MongoDB config database')
ON CONFLICT DO NOTHING;

-- Verify
SELECT 'Migration completed successfully!' AS status;
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('databases', 'database_blacklist', 'database_sync_history')
ORDER BY table_name;