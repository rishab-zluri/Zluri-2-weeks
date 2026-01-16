-- =========================================================================
-- Comprehensive Database Schema Fix
-- Adds missing updated_at columns to all tables extending BaseEntity
-- Uses safe approach: add nullable → set defaults → make NOT NULL
-- =========================================================================

-- 1. database_instances (already fixed via command, but included for completeness)
ALTER TABLE database_instances ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE database_instances SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE database_instances ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE database_instances ALTER COLUMN updated_at SET DEFAULT NOW();

-- 2. databases
ALTER TABLE databases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE databases SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE databases ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE databases ALTER COLUMN updated_at SET DEFAULT NOW();

-- 3. query_requests
ALTER TABLE query_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE query_requests SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE query_requests ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE query_requests ALTER COLUMN updated_at SET DEFAULT NOW();

-- 4. refresh_tokens (already fixed earlier, but included for completeness)
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE refresh_tokens SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE refresh_tokens ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN updated_at SET DEFAULT NOW();

-- 5. user_token_invalidations
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_token_invalidations') THEN
        ALTER TABLE user_token_invalidations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        UPDATE user_token_invalidations SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
        ALTER TABLE user_token_invalidations ALTER COLUMN updated_at SET NOT NULL;
        ALTER TABLE user_token_invalidations ALTER COLUMN updated_at SET DEFAULT NOW();
    END IF;
END $$;

-- 6. slack_notifications
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'slack_notifications') THEN
        ALTER TABLE slack_notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        UPDATE slack_notifications SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
        ALTER TABLE slack_notifications ALTER COLUMN updated_at SET NOT NULL;
        ALTER TABLE slack_notifications ALTER COLUMN updated_at SET DEFAULT NOW();
    END IF;
END $$;

-- 7. audit_logs
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_logs') THEN
        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        UPDATE audit_logs SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
        ALTER TABLE audit_logs ALTER COLUMN updated_at SET NOT NULL;
        ALTER TABLE audit_logs ALTER COLUMN updated_at SET DEFAULT NOW();
    END IF;
END $$;

-- 8. access_token_blacklist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'access_token_blacklist') THEN
        ALTER TABLE access_token_blacklist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        UPDATE access_token_blacklist SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
        ALTER TABLE access_token_blacklist ALTER COLUMN updated_at SET NOT NULL;
        ALTER TABLE access_token_blacklist ALTER COLUMN updated_at SET DEFAULT NOW();
    END IF;
END $$;

-- 9. database_sync_history (already has triggered_by_id fix)
ALTER TABLE database_sync_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE database_sync_history SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE database_sync_history ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE database_sync_history ALTER COLUMN updated_at SET DEFAULT NOW();

-- 10. database_blacklist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'database_blacklist') THEN
        ALTER TABLE database_blacklist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        UPDATE database_blacklist SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
        ALTER TABLE database_blacklist ALTER COLUMN updated_at SET NOT NULL;
        ALTER TABLE database_blacklist ALTER COLUMN updated_at SET DEFAULT NOW();
    END IF;
END $$;

-- 11. users (extends UuidBaseEntity which also has updated_at)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE users SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE users ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW();

-- =========================================================================
-- Verification: Check all updated_at columns exist
-- =========================================================================
-- Run this query to verify:
-- SELECT table_name, column_name, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE column_name = 'updated_at' 
-- ORDER BY table_name;
