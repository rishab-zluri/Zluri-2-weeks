# Script Testing Guide

## 🧪 Test Scripts for Connection Verification

These scripts are designed to test that script execution is working properly in the Database Query Portal. Upload these first before running any production scripts.

---

## JavaScript Test Scripts

### 1. `test-postgres-connection.js` ✅
**Purpose**: Verify PostgreSQL script execution is working  
**Database**: PostgreSQL  
**Risk**: 🟢 SAFE (read-only)

**What it tests**:
- Database connection
- Query execution
- Table listing
- Database size queries
- Connection statistics
- Server time

**Expected output**:
```
🚀 Starting PostgreSQL connection test...
📊 Test 1: Database Information
✅ Database: portal_db
✅ User: neondb_owner
✅ Version: PostgreSQL 16.0...
...
✅ All tests completed successfully!
```

**When to use**: First script to upload when testing PostgreSQL

---

### 2. `test-mongodb-connection.js` ✅
**Purpose**: Verify MongoDB script execution is working  
**Database**: MongoDB  
**Risk**: 🟢 SAFE (read-only)

**What it tests**:
- Database connection
- Collection discovery
- Document counting
- Sample data retrieval
- Aggregation pipelines
- FindOne queries

**Expected output**:
```
🚀 Starting MongoDB connection test...
📋 Test 1: Collections in Database
✅ Collection: ships (1234 documents)
✅ Collection: users (567 documents)
...
✅ All tests completed successfully!
```

**When to use**: First script to upload when testing MongoDB

---

## Python Test Scripts

### 3. `test-postgres-connection.py` 🐍
**Purpose**: Verify Python script execution with PostgreSQL  
**Database**: PostgreSQL  
**Language**: Python 3  
**Risk**: 🟢 SAFE

**What it tests**:
- Python sandbox environment
- Script execution flow
- Error handling
- Console output

**Expected output**:
```
🚀 Starting PostgreSQL connection test (Python)...
🐍 Test 5: Python Environment
✅ Python version: 3.x.x
✅ Script running in sandbox: Yes
...
✅ All tests completed successfully!
```

**When to use**: Test Python script execution capability

---

### 4. `test-mongodb-connection.py` 🐍
**Purpose**: Verify Python script execution with MongoDB  
**Database**: MongoDB  
**Language**: Python 3  
**Risk**: 🟢 SAFE

**What it tests**:
- Python sandbox environment
- JSON processing
- Data analysis capabilities
- String processing
- List comprehensions

**Expected output**:
```
🚀 Starting MongoDB connection test (Python)...
🐍 Test 1: Python Environment
✅ Python version: 3.x.x
📊 Test 2: JSON Processing
...
✅ All tests completed successfully!
```

**When to use**: Test Python script execution capability

---

## Analysis Scripts

### 5. `postgres-data-analysis.js` 📊
**Purpose**: Comprehensive PostgreSQL database analysis  
**Database**: PostgreSQL  
**Risk**: 🟢 SAFE (read-only)

**What it analyzes**:
- Database overview (size, user)
- Table sizes and row counts
- Index analysis
- Connection statistics
- Recent activity
- Performance metrics

**Use case**: Database health check, capacity planning

---

### 6. `mongodb-data-analysis.js` 📊
**Purpose**: Comprehensive MongoDB database analysis  
**Database**: MongoDB  
**Risk**: 🟢 SAFE (read-only)

**What it analyzes**:
- Collection discovery
- Document counts
- Data distribution
- Document structure
- Query performance
- Sample data inspection

**Use case**: Database health check, data exploration

---

## 🚀 Quick Start Testing Workflow

### Step 1: Test PostgreSQL Connection
1. Upload `test-postgres-connection.js`
2. Select PostgreSQL instance
3. Select any database
4. Submit for approval
5. Verify output shows connection success

### Step 2: Test MongoDB Connection
1. Upload `test-mongodb-connection.js`
2. Select MongoDB instance
3. Select any database
4. Submit for approval
5. Verify output shows connection success

### Step 3: Run Analysis (Optional)
1. Upload `postgres-data-analysis.js` or `mongodb-data-analysis.js`
2. Review comprehensive database insights

### Step 4: Test Python (Optional)
1. Upload `test-postgres-connection.py` or `test-mongodb-connection.py`
2. Verify Python execution works

---

## ⚠️ Important Notes

### JavaScript Scripts - No `require()`

**❌ This will NOT work**:
```javascript
const { Client } = require('pg');
const { MongoClient } = require('mongodb');
```

**✅ Use the provided wrappers instead**:
```javascript
// PostgreSQL
const result = await db.query('SELECT * FROM users LIMIT 10');

// MongoDB
const docs = await mongodb.collection('users').find({}).toArray();
```

### Available in JavaScript Scripts

**Database Wrappers**:
- `db` or `pgClient` - PostgreSQL query wrapper
- `mongodb` - MongoDB operations wrapper

**Console**:
- `console.log()`, `console.error()`, `console.warn()`, `console.info()`

**Built-in Objects**:
- `JSON`, `Math`, `Date`, `Array`, `Object`, `String`, `Number`
- `setTimeout`, `clearTimeout` (max 5 seconds)

**Blocked for Security**:
- `require()` - Module loading
- `eval()` - Code evaluation
- `Function()` - Dynamic function creation
- `process` - Process access
- `fs` - File system
- `child_process` - Process spawning

### Python Scripts

**Current Status**:
- Python scripts run successfully in sandbox
- Best for data processing and analysis
- Cannot directly query databases yet (use JavaScript for that)
- Can process JSON, perform calculations, string operations

---

## 🔧 Troubleshooting

### Error: "require is not a function"
**Problem**: Script tries to use `require()`  
**Solution**: Remove `require()` statements, use provided wrappers

### Error: "connection is insecure"
**Problem**: PostgreSQL SSL configuration issue  
**Solution**: Fixed in latest version, redeploy if needed

### Error: "Script timed out"
**Problem**: Script took longer than 30 seconds  
**Solution**: Optimize queries, add LIMIT clauses

### Error: "Collection not found"
**Problem**: MongoDB collection doesn't exist  
**Solution**: Check collection name, verify database selection

---

## 📝 Test Checklist

Before running production scripts, verify:

- [ ] PostgreSQL connection test passes
- [ ] MongoDB connection test passes
- [ ] Can query tables/collections
- [ ] Can retrieve data
- [ ] Console logging works
- [ ] Error handling works
- [ ] Python execution works (if needed)

---

## 🎯 Next Steps

After successful testing:

1. Review the main `README.md` for production scripts
2. Try the data analysis scripts
3. Customize scripts for your use case
4. Always test with small datasets first
5. Use DRY_RUN mode for write operations

---

**Last Updated**: January 2026  
**Version**: 2.0
