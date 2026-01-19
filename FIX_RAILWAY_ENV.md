# 🔧 Fix Railway Environment Variables

## Issues Found in Logs

### 1. ✅ Database Schema - FIXED
**Error**: `null value in column "updated_at" of relation "database_blacklist"`
**Fix**: Added default value to `updated_at` column
```sql
ALTER TABLE database_blacklist 
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
```
Status: ✅ Fixed in database

### 2. ❌ MongoDB Authentication - NEEDS FIX
**Error**: `bad auth : Authentication failed` for `mongodb-atlas-ships`
**Cause**: `PROD_MONGO_URI` environment variable is either:
- Not set in Railway
- Set incorrectly (wrong password encoding)
- Missing authentication parameters

## Fix MongoDB Environment Variable in Railway

### Step 1: Go to Railway Dashboard
1. Open https://railway.app/dashboard
2. Click on your **backend service**
3. Click on **Variables** tab

### Step 2: Check if PROD_MONGO_URI Exists
Look for a variable named `PROD_MONGO_URI`

### Step 3: Set/Update PROD_MONGO_URI

**IMPORTANT**: The password `123@Acharjee` must be URL-encoded as `123%40Acharjee`

#### Correct Value:
```
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin
```

#### Key Points:
- ✅ Protocol: `mongodb+srv://` (for Atlas)
- ✅ Username: `rishab1`
- ✅ Password: `123%40Acharjee` (@ is encoded as %40)
- ✅ Host: `ships.gwsbr.mongodb.net`
- ✅ Parameters: `?retryWrites=true&w=majority&authSource=admin`

### Step 4: Add the Variable in Railway

**Option A: Via Railway Dashboard**
1. Click "New Variable"
2. Name: `PROD_MONGO_URI`
3. Value: `mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin`
4. Click "Add"
5. Railway will automatically redeploy

**Option B: Via Railway CLI**
```bash
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"
```

### Step 5: Verify Other Required Variables

Make sure these are also set:

```bash
# PostgreSQL
PROD_TARGET_URL=postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require

# Portal Database
PORTAL_DB_HOST=ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=zluri_portal_db
PORTAL_DB_USER=neondb_owner
PORTAL_DB_PASSWORD=npg_oG6uQWgUBz8a
PORTAL_DB_SSL=true

# Environment
NODE_ENV=production

# JWT (if not set)
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
```

## Test MongoDB Connection Locally

Before deploying, test the connection string:

```bash
# Install mongosh if you don't have it
# brew install mongosh

# Test connection
mongosh "mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"
```

Expected output:
```
Current Mongosh Log ID: ...
Connecting to: mongodb+srv://ships.gwsbr.mongodb.net/...
Using MongoDB: 7.0.x
Using Mongosh: 2.x.x

test>
```

If this works, the connection string is correct.

## After Setting Environment Variable

### Railway Will Automatically:
1. Detect the variable change
2. Redeploy the service (~2-3 minutes)
3. Restart with new environment variables

### Check Logs After Redeploy:
```bash
railway logs --follow
```

Look for:
- ✅ `Fetched databases from instance {"instanceId":"mongodb-atlas-ships",...}`
- ✅ `Database sync completed`
- ❌ No more "bad auth" errors

## Common MongoDB Connection Issues

### Issue: "bad auth : Authentication failed"
**Causes**:
1. Password not URL-encoded (@ should be %40)
2. Wrong username or password
3. Missing `authSource=admin` parameter
4. IP whitelist in MongoDB Atlas (should allow all: 0.0.0.0/0)

**Solution**: Use the exact connection string above

### Issue: "Server selection timeout"
**Causes**:
1. Wrong hostname
2. Network connectivity issue
3. MongoDB Atlas not accessible from Railway

**Solution**: Verify hostname is `ships.gwsbr.mongodb.net`

### Issue: "Authentication database not specified"
**Causes**:
1. Missing `authSource=admin` parameter

**Solution**: Add `?authSource=admin` to connection string

## Verify MongoDB Atlas Configuration

### Check IP Whitelist
1. Go to MongoDB Atlas dashboard
2. Click "Network Access"
3. Ensure `0.0.0.0/0` is whitelisted (allows all IPs)
4. Or add Railway's IP ranges

### Check Database User
1. Go to "Database Access"
2. Verify user `rishab1` exists
3. Verify password is `123@Acharjee`
4. Verify user has read/write permissions

## Quick Fix Script

Run this to set all required environment variables at once:

```bash
# Set all Railway environment variables
railway variables set \
  PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin" \
  PROD_TARGET_URL="postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require" \
  PORTAL_DB_SSL="true" \
  NODE_ENV="production"
```

## Timeline

1. **Set environment variable in Railway**: 1 minute
2. **Railway detects change**: 10-30 seconds
3. **Railway redeploys**: 2-3 minutes
4. **Service restarts**: 30 seconds
5. **Total**: ~4-5 minutes

## After Fix

Once Railway redeploys with the correct `PROD_MONGO_URI`:

### Test MongoDB Script Upload
1. Go to application UI
2. Select:
   - Instance: MongoDB Atlas - Ships Cluster
   - Database: 69401559e576ef4085e50133_test
3. Upload `test-mongodb-upload.js`
4. Execute

Expected: ✅ Connection successful, shows collections

### Check Logs
```bash
railway logs | grep mongodb-atlas-ships
```

Expected:
```
[info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13,"afterBlacklist":13,"blacklisted":0}
[info]: Database sync completed for instance {"instanceId":"mongodb-atlas-ships","success":true,...}
```

## Status

- ✅ Database schema fixed (updated_at default added)
- ⏳ MongoDB environment variable needs to be set in Railway
- ⏳ Waiting for Railway to redeploy after variable is set

## Next Steps

1. **Set `PROD_MONGO_URI` in Railway** (via dashboard or CLI)
2. **Wait for Railway to redeploy** (~5 minutes)
3. **Check logs** for successful MongoDB sync
4. **Test script upload** with MongoDB instance

The script upload fix is complete in the code. Once the environment variable is set correctly, everything will work!
