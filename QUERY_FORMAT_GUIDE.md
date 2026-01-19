# Query Format Guide

## MongoDB Query Format

MongoDB queries in this portal must follow specific formats:

### ✅ Valid MongoDB Query Formats

#### 1. Standard Format: `db.collection.method(...)`

**Read Operations:**
```javascript
// Find all documents
db.ships.find()

// Find with filter
db.ships.find({status: "active"})

// Find with filter and projection
db.ships.find({status: "active"}, {name: 1, port: 1})

// Find one document
db.ships.findOne({name: "Titanic"})

// Count documents
db.ships.countDocuments({status: "active"})

// Distinct values
db.ships.distinct("status")
```

**Aggregation:**
```javascript
// Aggregate pipeline
db.ships.aggregate([
  {$match: {status: "active"}},
  {$group: {_id: "$port", count: {$sum: 1}}}
])
```

**Write Operations (if allowed):**
```javascript
// Insert one
db.ships.insertOne({name: "Queen Mary", port: "Southampton"})

// Insert many
db.ships.insertMany([
  {name: "Ship1", port: "Port1"},
  {name: "Ship2", port: "Port2"}
])

// Update one
db.ships.updateOne(
  {name: "Titanic"},
  {$set: {status: "inactive"}}
)

// Delete one
db.ships.deleteOne({name: "OldShip"})
```

#### 2. JSON Command Format

```json
{
  "find": "ships",
  "filter": {"status": "active"},
  "limit": 10
}
```

```json
{
  "aggregate": "ships",
  "pipeline": [
    {"$match": {"status": "active"}},
    {"$count": "total"}
  ]
}
```

### ❌ Invalid MongoDB Queries

```javascript
// ❌ Missing db. prefix
ships.find()

// ❌ Missing parentheses
db.ships.find

// ❌ Random text
hv
G
test

// ❌ SQL syntax (this is MongoDB, not SQL!)
SELECT * FROM ships

// ❌ Incomplete query
db.ships
```

---

## PostgreSQL Query Format

PostgreSQL queries must be valid SQL:

### ✅ Valid PostgreSQL Queries

**Read Operations:**
```sql
-- Select all
SELECT * FROM users LIMIT 10;

-- Select with filter
SELECT id, name, email FROM users WHERE active = true;

-- Count
SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '7 days';

-- Join
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.name;

-- Aggregate
SELECT status, COUNT(*) as count
FROM orders
GROUP BY status;
```

**Write Operations (if allowed):**
```sql
-- Insert
INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com');

-- Update
UPDATE users SET active = true WHERE id = 123;

-- Delete
DELETE FROM temp_data WHERE created_at < NOW() - INTERVAL '30 days';
```

### ❌ Invalid PostgreSQL Queries

```sql
-- ❌ Random text
G
hv
test

-- ❌ MongoDB syntax (this is PostgreSQL, not MongoDB!)
db.users.find()

-- ❌ Incomplete query
SELECT * FROM

-- ❌ Syntax errors
SELCT * FROM users  -- typo in SELECT
```

---

## Common Mistakes

### 1. Wrong Database Type

**Problem:** Submitting MongoDB query to PostgreSQL database (or vice versa)

**Example:**
- Selected: PostgreSQL database `customer_db`
- Query: `db.users.find()` ❌

**Fix:** 
- Use SQL for PostgreSQL: `SELECT * FROM users LIMIT 10;` ✅

### 2. Incomplete Query

**Problem:** Not finishing the query syntax

**Example:**
- `db.ships` ❌
- `SELECT * FROM` ❌

**Fix:**
- `db.ships.find()` ✅
- `SELECT * FROM users LIMIT 10;` ✅

### 3. Testing with Random Text

**Problem:** Typing "test", "hv", "G" to test the form

**Example:**
- Query: `hv` ❌

**Fix:** Use a real query:
- MongoDB: `db.ships.find().limit(5)` ✅
- PostgreSQL: `SELECT 1;` ✅

---

## Quick Test Queries

### MongoDB Test Queries

```javascript
// Safest - just count documents
db.ships.countDocuments()

// List first 5 documents
db.ships.find().limit(5)

// Check if collection exists
db.ships.findOne()
```

### PostgreSQL Test Queries

```sql
-- Safest - just return a constant
SELECT 1;

-- Check current time
SELECT NOW();

-- Count rows (replace 'users' with your table)
SELECT COUNT(*) FROM users;

-- List first 5 rows
SELECT * FROM users LIMIT 5;
```

---

## Error Messages Explained

### "Query must be in format: db.collection.method(...)"

**Cause:** Your MongoDB query doesn't match the expected format

**Fix:** Make sure your query starts with `db.` and includes a method with parentheses:
- ✅ `db.ships.find()`
- ❌ `ships.find()`
- ❌ `db.ships`

### "syntax error at or near \"X\""

**Cause:** Your PostgreSQL query has invalid SQL syntax

**Fix:** Check for:
- Typos in SQL keywords (SELECT, FROM, WHERE, etc.)
- Missing semicolons (optional but recommended)
- Incomplete statements
- Using MongoDB syntax in PostgreSQL

---

## Tips

1. **Start simple:** Test with a basic query first (e.g., `SELECT 1;` or `db.collection.find().limit(1)`)

2. **Check database type:** Make sure you're using the right query language for the database type

3. **Use comments field:** Explain what your query does - helps with approval

4. **Test locally first:** If possible, test your query in MongoDB Compass or pgAdmin before submitting

5. **Read error messages:** They usually tell you exactly what's wrong

---

## Need Help?

If you're unsure about query syntax:

- **MongoDB:** Check [MongoDB Query Documentation](https://docs.mongodb.com/manual/tutorial/query-documents/)
- **PostgreSQL:** Check [PostgreSQL SELECT Documentation](https://www.postgresql.org/docs/current/sql-select.html)

Or ask your manager/admin for example queries that work with your specific database!
