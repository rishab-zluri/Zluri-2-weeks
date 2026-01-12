-- ============================================================================
-- TARGET DATABASES - SAMPLE SCHEMA
-- ============================================================================
-- 
-- Purpose: This file contains sample schemas for TARGET databases that the
--          portal will execute queries against. These are NOT the portal's
--          own database - they are the customer/application databases.
--
-- Usage: Run this on your target PostgreSQL instances to create sample
--        tables for testing the query execution portal.
--
-- ============================================================================

-- ============================================================================
-- SAMPLE DATABASE 1: customer_db
-- ============================================================================
-- A typical customer/application database with users and orders

-- Create database (run separately as superuser)
-- CREATE DATABASE customer_db;

-- Connect to customer_db before running the rest
-- \c customer_db

-- ----------------------------------------------------------------------------
-- Table: users
-- ----------------------------------------------------------------------------
-- Sample users table for a typical application

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ----------------------------------------------------------------------------
-- Table: orders
-- ----------------------------------------------------------------------------
-- Sample orders table linked to users

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: products
-- ----------------------------------------------------------------------------
-- Sample products catalog

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_quantity INTEGER DEFAULT 0,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- ----------------------------------------------------------------------------
-- Table: order_items
-- ----------------------------------------------------------------------------
-- Line items for each order

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for order_items table
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ----------------------------------------------------------------------------
-- Sample Data
-- ----------------------------------------------------------------------------

-- Insert sample users
INSERT INTO users (name, email, status) VALUES
    ('John Doe', 'john.doe@example.com', 'active'),
    ('Jane Smith', 'jane.smith@example.com', 'active'),
    ('Bob Wilson', 'bob.wilson@example.com', 'active'),
    ('Alice Brown', 'alice.brown@example.com', 'inactive')
ON CONFLICT (email) DO NOTHING;

-- Insert sample products
INSERT INTO products (sku, name, description, price, stock_quantity, category) VALUES
    ('PROD-001', 'Widget A', 'A standard widget', 29.99, 100, 'Widgets'),
    ('PROD-002', 'Widget B', 'A premium widget', 49.99, 50, 'Widgets'),
    ('PROD-003', 'Gadget X', 'An innovative gadget', 99.99, 25, 'Gadgets'),
    ('PROD-004', 'Gadget Y', 'A compact gadget', 79.99, 75, 'Gadgets')
ON CONFLICT (sku) DO NOTHING;

-- Insert sample orders
INSERT INTO orders (user_id, order_number, total, status) VALUES
    (1, 'ORD-2024-001', 129.97, 'delivered'),
    (1, 'ORD-2024-002', 49.99, 'shipped'),
    (2, 'ORD-2024-003', 199.98, 'processing'),
    (3, 'ORD-2024-004', 29.99, 'pending')
ON CONFLICT (order_number) DO NOTHING;

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
    (1, 1, 2, 29.99, 59.98),
    (1, 2, 1, 49.99, 49.99),
    (1, 4, 1, 19.99, 19.99),
    (2, 2, 1, 49.99, 49.99),
    (3, 3, 2, 99.99, 199.98),
    (4, 1, 1, 29.99, 29.99)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SAMPLE DATABASE 2: analytics_db
-- ============================================================================
-- A typical analytics/reporting database

-- Create database (run separately as superuser)
-- CREATE DATABASE analytics_db;

-- Connect to analytics_db before running the rest
-- \c analytics_db

-- ----------------------------------------------------------------------------
-- Table: events
-- ----------------------------------------------------------------------------
-- Event tracking table for analytics

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    properties JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_properties ON events USING GIN(properties);

-- ----------------------------------------------------------------------------
-- Table: daily_metrics
-- ----------------------------------------------------------------------------
-- Aggregated daily metrics

CREATE TABLE IF NOT EXISTS daily_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 4) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_date, metric_name, dimensions)
);

-- Indexes for daily_metrics table
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_name ON daily_metrics(metric_name);

-- ----------------------------------------------------------------------------
-- Sample Analytics Data
-- ----------------------------------------------------------------------------

INSERT INTO events (event_type, event_name, user_id, session_id, properties) VALUES
    ('page_view', 'Homepage View', 'user_123', 'sess_abc', '{"page": "/", "referrer": "google.com"}'),
    ('page_view', 'Product View', 'user_123', 'sess_abc', '{"page": "/products/1", "product_id": 1}'),
    ('click', 'Add to Cart', 'user_123', 'sess_abc', '{"product_id": 1, "quantity": 1}'),
    ('purchase', 'Order Completed', 'user_123', 'sess_abc', '{"order_id": "ORD-001", "total": 29.99}'),
    ('page_view', 'Homepage View', 'user_456', 'sess_def', '{"page": "/", "referrer": "direct"}')
ON CONFLICT DO NOTHING;

INSERT INTO daily_metrics (metric_date, metric_name, metric_value, dimensions) VALUES
    ('2024-01-01', 'active_users', 1250, '{"platform": "web"}'),
    ('2024-01-01', 'active_users', 850, '{"platform": "mobile"}'),
    ('2024-01-01', 'revenue', 15420.50, '{"currency": "USD"}'),
    ('2024-01-02', 'active_users', 1320, '{"platform": "web"}'),
    ('2024-01-02', 'active_users', 920, '{"platform": "mobile"}'),
    ('2024-01-02', 'revenue', 18750.25, '{"currency": "USD"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Target DB sample schema created successfully!' AS status;
