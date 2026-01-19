# Complete MongoDB Fix - 3 Issues to Resolve

## Issues Found in Logs

### ❌ Issue 1: Schema Error - host/port NOT NULL
```
[error]: null value in column "host" of relation "database_instances" violates not-null constraint
[error]: Failed to seed instances
```

### ❌ Issue 2: MongoDB Authentication Failure
```
[error]: bad auth : Authentication failed.
```

### ❌ Issue 3: Python3 Not Installed
```
[error]: spawn python3 ENOENT
```

---

## 🔧 FIX ALL THREE ISSUES

### STEP 1: Fix Database Schema (DO THIS FIRST!)

Run this SQL on your Neon database via Railway:

```bash
railway run psql $DATABASE_URL -f backend/fix-host-port-nullable.sql
```

Or copy/paste this SQL in Railway's database console:

```sql
ALTER TABLE database_instances ALTER COLUMN host DROP NOT NULL;
ALTER TABLE database_instances ALTER COLUMN port DROP NOT NULL;

ALTER TABLE database_instances DROP CONSTRAINT IF EXISTS check_connection_method;
ALTER TABLE database_instances ADD CONSTRAINT check_connection_method 
    CHECK (
        (host IS NOT NULL AND port IS NOT NULL) OR 
        (connection_string_env IS NOT NULL)
    );

UPDATE database_instances 
SET host = NULL, port = NULL 
WHERE connection_string_env IS NOT NULL AND (host = '' OR host = 'N/A');
```

**Why**: MongoDB Atlas instances use connection strings, not host/port. The schema needs to allow NULL host/port.

---

### STEP 2: Set MongoDB URI in Railway

1. Go to Railway Dashboard
2. Select your backend service
3. Click "Variables" tab
4. Add this variable:

```
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin
```

**CRITICAL**: 
- Password `123@Acharjee` MUST be `123%40Acharjee` (URL-encoded)
- Must include `&authSource=admin`

**Why**: Without correct MongoDB URI, authentication fails.

---

### STEP 3: Deploy Python3 Support

Commit and push the nixpacks.toml file:

```bash
git add backend/nixpacks.toml backend/fix-host-port-nullable.sql backend/portal_db_schema.sql
git commit -m "Fix MongoDB: schema, auth, and Python3 support"
git push
```

**Why**: Python scripts need Python3 installed in the container.

---

## ⏱️ Wait for Deployment

After pushing, Railway will:
1. Detect nixpacks.toml
2. Install Python3
3. Use new PROD_MONGO_URI
4. Redeploy (3-5 minutes)

---

## ✅ Verify All Fixes

### Check Railway Logs for Success:

**1. Schema Fix Success:**
```
✅ [info]: Seeded/Updated instance: mongodb-atlas-ships
✅ No more "null value in column host" errors
```

**2. MongoDB Auth Success:**
```
✅ [info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13}
✅ [info]: Database sync completed for instance {"instanceId":"mongodb-atlas-ships","success":true}
✅ No more "bad auth" errors
```

**3. Python3 Success:**
```
✅ [info]: Script language detected {"language":"python"}
✅ [info]: Script executed successfully
✅ No more "spawn python3 ENOENT" errors
```

---

## 🧪 Test Everything

### Test 1: MongoDB Query
1. Submit a MongoDB query
2. Approve it
3. Should execute successfully ✅

### Test 2: Python Script on MongoDB
1. Upload a .py script for MongoDB
2. Approve it
3. Should execute successfully ✅

### Test 3: JavaScript Script on MongoDB
1. Upload a .js script for MongoDB
2. Approve it
3. Should execute successfully ✅

### Test 4: PostgreSQL (Should Still Work)
1. Submit a PostgreSQL query
2. Should work as before ✅

---

## 📋 Quick Checklist

- [ ] Run schema fix SQL on Neon database
- [ ] Set PROD_MONGO_URI in Railway Variables
- [ ] Commit and push nixpacks.toml
- [ ] Wait for Railway deployment (3-5 min)
- [ ] Check logs for success messages
- [ ] Test MongoDB query
- [ ] Test Python script
- [ ] Test JavaScript script

---

## 🎯 Expected Result

After all three fixes:
- ✅ Instance seeding works for both PostgreSQL and MongoDB
- ✅ MongoDB authentication succeeds
- ✅ All 13 MongoDB databases are available
- ✅ Python scripts execute successfully
- ✅ JavaScript scripts execute successfully
- ✅ PostgreSQL continues to work

---

## 🔗 Related Files

- `backend/fix-host-port-nullable.sql` - Schema migration
- `backend/nixpacks.toml` - Python3 configuration
- `backend/portal_db_schema.sql` - Updated schema
- `FIX_HOST_PORT_SCHEMA.md` - Detailed schema fix guide
- `MONGODB_FIX_ACTION_REQUIRED.md` - Auth and Python3 guide

---

## ⚠️ Order Matters!

1. **FIRST**: Fix schema (or seeding will keep failing)
2. **SECOND**: Set MongoDB URI (or auth will keep failing)
3. **THIRD**: Deploy Python3 (or scripts will keep failing)

Do them in this order for best results!
