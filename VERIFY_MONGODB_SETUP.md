# Verify MongoDB Setup - Checklist

## Issue: Still getting "bad auth : Authentication failed"

This means Railway is NOT using the correct MongoDB connection string.

---

## Checklist - Do ALL of these:

### ☐ 1. Verify Railway Environment Variable

Go to Railway Dashboard → Backend Service → Variables

**Check:**
- [ ] Variable name is EXACTLY: `PROD_MONGO_URI` (case-sensitive!)
- [ ] Variable value is: `mongodb+srv://rishab3:123rishabacharjee@ships.gwsbr.mongodb.net/`
- [ ] No extra spaces before or after the value
- [ ] No typos in username or password

**Take a screenshot and share it if unsure!**

---

### ☐ 2. Verify Database Instance Exists

Run this SQL on Neon:

```sql
SELECT id, name, type, connection_string_env 
FROM database_instances 
WHERE id = 'mongodb-atlas-ships';
```

**Expected result:**
```
id                  | name                          | type    | connection_string_env
--------------------|-------------------------------|---------|----------------------
mongodb-atlas-ships | MongoDB Atlas - Ships Cluster | mongodb | PROD_MONGO_URI
```

**If you get NO ROWS**, the instance doesn't exist. Run:

```sql
INSERT INTO database_instances 
(id, name, type, host, port, connection_string_env, is_active, created_at, updated_at)
VALUES 
('mongodb-atlas-ships', 'MongoDB Atlas - Ships Cluster', 'mongodb', NULL, NULL, 'PROD_MONGO_URI', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

---

### ☐ 3. Force Railway to Restart

Railway might be using cached environment variables. Force a restart:

**Option A: Redeploy in Dashboard**
1. Go to Railway → Backend Service → Deployments
2. Click the three dots on latest deployment
3. Click "Redeploy"

**Option B: Push a change**
```bash
echo "# Force restart $(date)" >> backend/README.md
git add backend/README.md
git commit -m "Force restart for MongoDB"
git push
```

**Wait 3-5 minutes** for Railway to fully redeploy.

---

### ☐ 4. Check Railway Startup Logs

After restart, check Railway logs for this line:

```
[info]: Starting database sync for instance {"instanceId":"mongodb-atlas-ships"}
```

**If you see:**
- ✅ `[info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13}` → SUCCESS!
- ❌ `[warn]: Fetch Mongo Databases Error` → Still failing

---

### ☐ 5. Verify MongoDB Atlas IP Whitelist

Go to MongoDB Atlas → Network Access

**Must have:**
- Entry for `0.0.0.0/0` (Allow access from anywhere)
- Status: **Active** (green dot)

If not, add it and wait 5 minutes.

---

## Common Mistakes

### ❌ Wrong variable name
- `MONGO_URI` ← WRONG
- `MONGODB_URI` ← WRONG
- `PROD_MONGO_URL` ← WRONG
- `PROD_MONGO_URI` ← ✅ CORRECT

### ❌ Wrong connection string format
- Missing `mongodb+srv://` prefix
- Wrong username (should be `rishab3`)
- Wrong password (should be `123rishabacharjee`)
- Extra spaces or characters

### ❌ Railway not restarted
- Environment variables only load on startup
- Must redeploy after changing variables

### ❌ Instance doesn't exist in database
- The `mongodb-atlas-ships` row must exist in `database_instances` table
- Must have `connection_string_env = 'PROD_MONGO_URI'`

---

## Debug: Check What Railway is Using

Add this temporarily to your code to log the connection string (REMOVE AFTER DEBUGGING):

In `backend/src/services/databaseSyncService.ts`, find the MongoDB connection code and add:

```typescript
console.log('MongoDB URI exists:', !!process.env.PROD_MONGO_URI);
console.log('MongoDB URI (safe):', process.env.PROD_MONGO_URI?.replace(/:[^:@]+@/, ':****@'));
```

This will show in Railway logs if the variable is being read.

---

## Still Not Working?

If you've done ALL the above and it still fails, share:

1. Screenshot of Railway Variables showing `PROD_MONGO_URI`
2. Result of the SQL query checking the instance
3. Railway logs from startup (first 50 lines)

Then I can pinpoint the exact issue!
