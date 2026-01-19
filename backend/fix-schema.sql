-- Fix schema issues for Railway deployment
-- Run this with: railway run psql $DATABASE_URL < fix-schema.sql

-- 1. Add missing created_by column to database_blacklist if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'database_blacklist' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE database_blacklist 
        ADD COLUMN created_by UUID REFERENCES users(id);
        
        RAISE NOTICE 'Added created_by column to database_blacklist';
    ELSE
        RAISE NOTICE 'created_by column already exists in database_blacklist';
    END IF;
END $$;

-- 2. Add unique constraint on pattern if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'database_blacklist_pattern_key'
    ) THEN
        ALTER TABLE database_blacklist 
        ADD CONSTRAINT database_blacklist_pattern_key UNIQUE (pattern);
        
        RAISE NOTICE 'Added unique constraint on pattern';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- 3. Verify the fixes
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'database_blacklist'
ORDER BY ordinal_position;

-- 4. Show constraints
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'database_blacklist'::regclass;
