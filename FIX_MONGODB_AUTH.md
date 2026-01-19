# 🔴 CRITICAL: MongoDB Authentication Fix

## Root Cause Found

**The problem:** Railway variable name doesn't match what the code expects!

- **Railway has:** `TARGET_MONGO_URI` 
- **Code expects:** `PROD_MONGO_URI`

This is why you keep getting "bad auth : Authentication failed" - Railway is NOT loading the MongoDB connection string at all!

---

## ✅ SOLUTION: Fix the Variable Name

### Option 1: Rename in Railway (RECOMMENDED)

1. Go to Railway Dashboard → Backend Service → Variables
2. **Delete** the variable named `TARGET_MONGO_URI`
3. **Add new variable:**
   - Name: `PROD_MONGO_URI`
   - Value: `mongodb+srv://rishab3:123rishabacharjee@ships.gwsbr.mongodb.net/`
4. Click "Redeploy" to restart the service
5. Wait 3-5 minutes for deployment

### Option 2: Update Database Instance

If you prefer to keep `TARGET_MONGO_URI` in Railway, update the database:

```sql
UPDATE database_instances 
SET connection_string_env = 'TARGET_MONGO_URI'
WHERE id = 'mongodb-atlas-ships';
```

Then redeploy Railway.

---

## 🔍 Why This Happened

Looking at the code:

**In `backend/src/config/staticData.ts` (line 138):**
```typescript
if (process.env.PROD_MONGO_URI) {
    instances.push({
        id: 'prod-mongo-atlas',
        name: 'Production-Atlas',
        type: 'mongodb',
        uri: process.env.PROD_MONGO_URI,  // ← Expects PROD_MONGO_URI
        connection_string_env: 'PROD_MONGO_URI',
        databases: [],
    });
}
```

**But in `backend/src/seeders/DatabaseSeeder.ts` (line 124):**
```typescript
...(process.env.TARGET_MONGO_URI ? [{  // ← Checks TARGET_MONGO_URI
    id: 'prod-mongo-atlas',
    connectionStringEnv: 'TARGET_MONGO_URI',
}] : []),
```

**There's a mismatch!** The seeder uses `TARGET_MONGO_URI` but the runtime code uses `PROD_MONGO_URI`.

---

## 📋 After Fixing - Verify

After renaming the variable and redeploying, check Railway logs for:

```
[info]: Starting database sync for instance {"instanceId":"mongodb-atlas-ships"}
[info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13}
```

If you see that, it's working! ✅

---

## 🚨 If Still Not Working

1. Verify the instance exists in database:
```sql
SELECT id, name, connection_string_env 
FROM database_instances 
WHERE id = 'mongodb-atlas-ships';
```

2. If no rows, create it:
```sql
INSERT INTO database_instances 
(id, name, type, host, port, connection_string_env, is_active, created_at, updated_at)
VALUES 
('mongodb-atlas-ships', 'MongoDB Atlas - Ships Cluster', 'mongodb', NULL, NULL, 'PROD_MONGO_URI', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

3. Force Railway restart after any changes

---

## 📝 MongoDB Compass Command

To create a collection in MongoDB Compass:

1. Connect to: `mongodb+srv://rishab3:123rishabacharjee@ships.gwsbr.mongodb.net/`
2. Select database: `als_database` (or create new one)
3. Click "Create Collection"
4. Enter collection name (e.g., `ships`)
5. Click "Create"

**Or use MongoDB shell:**
```javascript
use als_database
db.createCollection("ships")
```

---

## Summary

**DO THIS NOW:**
1. Go to Railway → Variables
2. Rename `TARGET_MONGO_URI` to `PROD_MONGO_URI`
3. Redeploy
4. Wait 5 minutes
5. Test a MongoDB query

That's it! The connection string is correct, just the variable name was wrong.
