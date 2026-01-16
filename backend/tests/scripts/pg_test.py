"""
PostgreSQL Test Script (Python)

Demonstrates how to execute PostgreSQL queries using the sandbox `db` object.
The sandbox provides a pre-connected database wrapper.

Available globals:
    - db.query(sql, params) - Execute query and return results
    - db.execute(sql, params) - Execute without returning (INSERT/UPDATE/DELETE)
    - print() - Output capture
    - json, datetime, re, math - Allowed modules

USAGE:
    Submit via API with .py extension or scriptLanguage: 'python'
"""

# Simple SELECT query
print("=== PostgreSQL Python Test ===")
print("Starting test queries...")

# 1. Get current time and database
result = db.query('SELECT NOW() as current_time, current_database() as db_name')
print(f"Current time: {result['rows'][0]['current_time']}")
print(f"Database: {result['rows'][0]['db_name']}")

# 2. Get PostgreSQL version
version_result = db.query('SELECT version()')
print(f"PostgreSQL version: {version_result['rows'][0]['version'][:50]}...")

# 3. List tables in public schema
tables_result = db.query("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
    LIMIT 10
""")
print(f"Tables found: {len(tables_result['rows'])}")
for row in tables_result['rows'][:5]:
    print(f"  - {row['table_name']}")

# 4. Parameterized query example
count_result = db.query(
    "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = %s",
    ('public',)
)
print(f"Total public tables: {count_result['rows'][0]['count']}")

print("=== Test Complete ===")
