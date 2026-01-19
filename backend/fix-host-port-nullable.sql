-- Fix database_instances schema to allow NULL host/port for connection-string-based instances
-- This is needed for MongoDB Atlas and other cloud databases that use connection strings

-- Make host and port nullable (they're not needed when using connection_string_env)
ALTER TABLE database_instances ALTER COLUMN host DROP NOT NULL;
ALTER TABLE database_instances ALTER COLUMN port DROP NOT NULL;

-- Add a check constraint to ensure either (host AND port) OR connection_string_env is provided
ALTER TABLE database_instances DROP CONSTRAINT IF EXISTS check_connection_method;
ALTER TABLE database_instances ADD CONSTRAINT check_connection_method 
    CHECK (
        (host IS NOT NULL AND port IS NOT NULL) OR 
        (connection_string_env IS NOT NULL)
    );

-- Update existing records that might have issues
UPDATE database_instances 
SET host = NULL, port = NULL 
WHERE connection_string_env IS NOT NULL AND (host = '' OR host = 'N/A');
