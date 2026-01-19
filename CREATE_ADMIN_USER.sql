-- Create Admin User for Railway PostgreSQL
-- Run this after migrations are complete

-- Create admin user
-- Password: Admin123! (change this after first login!)
INSERT INTO users (
    id,
    email,
    password_hash,
    name,
    role,
    is_active,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    'admin@yourdomain.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3q', -- Password: Admin123!
    'Admin User',
    'admin',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Create a developer user (optional)
INSERT INTO users (
    id,
    email,
    password_hash,
    name,
    role,
    is_active,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    'developer@yourdomain.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3q', -- Password: Admin123!
    'Developer User',
    'developer',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Create a manager user (optional)
INSERT INTO users (
    id,
    email,
    password_hash,
    name,
    role,
    is_active,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    'manager@yourdomain.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3q', -- Password: Admin123!
    'Manager User',
    'manager',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Verify users were created
SELECT 
    email,
    name,
    role,
    is_active,
    created_at
FROM users
ORDER BY created_at DESC;

-- Show user count
SELECT 
    role,
    COUNT(*) as count
FROM users
GROUP BY role;
