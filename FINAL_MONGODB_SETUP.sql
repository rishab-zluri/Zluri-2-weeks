-- Final MongoDB Setup SQL
-- Run this on your Neon database to enable MongoDB support

-- Step 1: Create or update the MongoDB instance
INSERT INTO database_instances 
(id, name, type, host, port, connection_string_env, is_active, created_at, updated_at)
VALUES 
('mongodb-atlas-ships', 'MongoDB Atlas - Ships Cluster', 'mongodb', NULL, NULL, 'PROD_MONGO_URI', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  connection_string_env = 'PROD_MONGO_URI',
  host = NULL,
  port = NULL,
  updated_at = CURRENT_TIMESTAMP;

-- Step 2: Add all MongoDB databases from your cluster
INSERT INTO databases (instance_id, name, is_active, created_at, updated_at) VALUES
('mongodb-atlas-ships', 'als_database', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'local', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'config', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_airbnb', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_analytics', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_geospatial', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_guides', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_mflix', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_restaurants', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_supplies', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_training', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('mongodb-atlas-ships', 'sample_weatherdata', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (instance_id, name) DO NOTHING;

-- Step 3: Verify the setup
SELECT 'MongoDB Instance:' as info, id, name, type, connection_string_env 
FROM database_instances 
WHERE id = 'mongodb-atlas-ships';

SELECT 'MongoDB Databases:' as info, COUNT(*) as total 
FROM databases 
WHERE instance_id = 'mongodb-atlas-ships';
