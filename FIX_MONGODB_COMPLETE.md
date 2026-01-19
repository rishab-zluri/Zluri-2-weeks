# Complete MongoDB Fix - Step by Step

## The Problem

You're getting "Invalid database for this instance" because:
1. MongoDB authentication is failing
2. Database sync can't fetch databases from MongoDB Atlas
3. The `databases` table is empty for `mongodb-atlas-ships`
4. Form validation rejects your submission

## Root Cause

Looking at the logs, MongoDB sync is still failing with "bad auth : Authentication failed"

This means **one of these is wrong:**
1. Railway doesn't have `PROD_MONGO_URI` variable
2. The variable value is incorrect
3. The instance in database doesn't exist or has wrong `connection_string_env`

---

## Step 1: Verify Railway Variable

Go to Railway Dashboard → Backend Service → Variables

**Check these EXACT things:**

### ✅ Variable name must be EXACTLY:
```
PROD_MONGO_URI
```
(NOT `TARGET_MONGO_URI`, NOT `MONGO_URI`, NOT `MONGODB_URI`)

### ✅ Variable value must be EXACTLY:
```
mongodb+srv://rishab3:123rishabacharjee@ships.gwsbr.mongodb.net/
```

**Take a screenshot if unsure!**

---

## Step 2: Verify Database Instance

Run this SQL on your Neon database:

```sql
-- Check if instance exists
SELECT id, name, type, connection_string_env, is_active
FROM database_instances 
WHERE id = 'mongodb-atlas-ships';
```

### Expected Result:
```
id                  | name                          | type    | connection_string_env | is_active
--------------------|-------------------------------|---------|----------------------|----------
mongodb-atlas-ships | MongoDB Atlas - Ships Cluster | mongodb | PROD_MONGO_URI       | true
```

### If NO ROWS returned, create the instance:

```sql
INSERT INTO database_instances 
(id, name, type, host, port, connection_string_env, is_active, created_at, updated_at)
VALUES 
('mongodb-atlas-ships', 'MongoDB Atlas - Ships Cluster', 'mongodb', NULL, NULL, 'PROD_MONGO_URI', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

### If row exists but `connection_string_env` is wrong:

```sql
UPDATE database_instances 
SET connection_string_env = 'PROD_MONGO_URI',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'mongodb-atlas-ships';
```

---

## Step 3: Force Railway Restart

After fixing the variable name, you MUST restart Railway:

### Option A: Redeploy in Dashboard
1. Go to Railway → Backend Service → Deployments
2. Click three dots on latest deployment
3. Click "Redeploy"

### Option B: Push a dummy change
```bash
echo "# Restart $(date)" >> backend/README.md
git add backend/README.md
git commit -m "Force restart for MongoDB fix"
git push
```

**Wait 3-5 minutes** for full deployment.

---

## Step 4: Verify Sync Success

After Railway restarts, check the logs for:

### ✅ Success looks like:
```
[info]: Starting database sync for instance {"instanceId":"mongodb-atlas-ships"}
[info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13}
[info]: Database sync completed for instance {"instanceId":"mongodb-atlas-ships","success":true}
```

### ❌ Still failing looks like:
```
[warn]: Fetch Mongo Databases Error {"instanceId":"mongodb-atlas-ships","code":8000,"msg":"bad auth"}
[error]: Database sync failed for instance {"instanceId":"mongodb-atlas-ships","error":"bad auth"}
```

---

## Step 5: Verify Databases in Table

After successful sync, check the databases table:

```sql
SELECT name, is_active, last_seen_at
FROM databases
WHERE instance_id = 'mongodb-atlas-ships'
ORDER BY name;
```

You should see databases like:
- `69401559e576ef4085e50133_test`
- `69401559e576ef4085e50133_truth`
- `als_database`
- etc.

---

## Step 6: Test Form Submission

Now try submitting a query again. It should work!

---

## If Still Failing After All Steps

### Debug: Check what Railway is actually using

Add this temporarily to `backend/src/services/databaseSyncService.ts` around line 400:

```typescript
// TEMPORARY DEBUG - REMOVE AFTER FIXING
console.log('=== MONGODB DEBUG ===');
console.log('PROD_MONGO_URI exists:', !!process.env.PROD_MONGO_URI);
console.log('TARGET_MONGO_URI exists:', !!process.env.TARGET_MONGO_URI);
console.log('Connection string (safe):', 
  (process.env.PROD_MONGO_URI || process.env.TARGET_MONGO_URI || 'NONE')
    .substring(0, 30) + '...'
);
console.log('====================');
```

Then check Railway logs to see what's actually loaded.

---

## Quick Checklist

- [ ] Railway has variable named `PROD_MONGO_URI` (exact spelling)
- [ ] Variable value is `mongodb+srv://rishab3:123rishabacharjee@ships.gwsbr.mongodb.net/`
- [ ] Database instance exists with `connection_string_env = 'PROD_MONGO_URI'`
- [ ] Railway has been redeployed after variable change
- [ ] Waited 5 minutes for full deployment
- [ ] Checked logs for successful sync
- [ ] Verified databases exist in `databases` table

---

## Alternative: Manual Database Entry (Temporary Workaround)

If you need to test immediately while fixing the sync, you can manually add the database:

```sql
INSERT INTO databases 
(instance_id, name, source, is_active, last_seen_at, created_at, updated_at)
VALUES 
('mongodb-atlas-ships', '69401559e576ef4085e50133_test', 'manual', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (instance_id, name) DO NOTHING;
```

But this is NOT a permanent solution - you still need to fix the sync!

---

## Summary

The issue is a chain reaction:
1. MongoDB can't authenticate → Sync fails → No databases in table → Form validation fails

Fix the authentication first (Steps 1-3), then everything else will work automatically.

**Most likely issue:** Railway variable is still named `TARGET_MONGO_URI` instead of `PROD_MONGO_URI`.
