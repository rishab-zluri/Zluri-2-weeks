-- Target Database Seed Script
-- Use this to populate your "Target" database (e.g., prod-target-db) with sample data.
-- Run using: psql "$TARGET_DB_URL" -f scripts/seed_target_db.sql

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    salary INTEGER,
    joined_at DATE DEFAULT CURRENT_DATE
);

-- Insert Departments
INSERT INTO departments (name, location) VALUES 
('Engineering', 'San Francisco'),
('Sales', 'New York'),
('HR', 'London'),
('Marketing', 'Tokyo')
ON CONFLICT DO NOTHING;

-- Insert Employees
INSERT INTO employees (name, email, role, department_id, salary, joined_at) VALUES
('Alice Johnson', 'alice@company.com', 'Senior Engineer', 1, 120000, '2023-01-15'),
('Bob Smith', 'bob@company.com', 'Product Manager', 1, 130000, '2023-02-20'),
('Charlie brown', 'charlie@company.com', 'Sales Lead', 2, 90000, '2023-03-10'),
('Diana Prince', 'diana@company.com', 'HR Specialist', 3, 75000, '2023-04-05'),
('Evan Wright', 'evan@company.com', 'Marketing Director', 4, 110000, '2023-05-12')
ON CONFLICT DO NOTHING;

-- Create a View
CREATE OR REPLACE VIEW employee_details AS
SELECT e.id, e.name, e.role, d.name as department, d.location
FROM employees e
JOIN departments d ON e.department_id = d.id;

SELECT '✅ Target Database Seeded Successfully' as status;
