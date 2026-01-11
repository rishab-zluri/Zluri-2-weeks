-- Create databases (run separately first)
-- CREATE DATABASE customer_db_1;
-- CREATE DATABASE customer_db_2;

-- This file is for customer_db_1
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, 
    name VARCHAR(100), 
    email VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY, 
    user_id INT, 
    total DECIMAL(10,2)
);

INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com');
INSERT INTO users (name, email) VALUES ('Alice Smith', 'alice@example.com');
INSERT INTO orders (user_id, total) VALUES (1, 99.99);
