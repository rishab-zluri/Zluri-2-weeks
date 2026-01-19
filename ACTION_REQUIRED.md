# ⚠️ ACTION REQUIRED - Set MongoDB Environment Variable

## Current Status

### ✅ What's Fixed
1. ✅ Code fixed - All 4 files now load instances from database
2. ✅ Code deployed - Pushed to Railway
3. ✅ Database schema fixed - `updated_at` column has default value
4. ✅ PostgreSQL instance working - `prod-target-aws` is configured correctly

### ❌ What's Broken
1. ❌ MongoDB environment variable not set in Railway
2. ❌ MongoDB authentication failing: "bad auth : Authentication failed"

## The Problem

Railway logs show:
```
[warn]: Fetch Mongo Databases Error {"instanceId":"mongodb-atlas-ships","code":8000,"msg":"bad auth : Authentication failed."}
```

This means the `PROD_MONGO_URI` environment variable is either:
- Not set in Railway
- Set incorrectly (password not URL-encoded)

## The Solution

### You Need to Set This Environment Variable in Railway:

```
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin
```

**CRITICAL**: The `@` in the password MUST be encoded as `%40`

## How to Fix (Choose One Method)

### Method 1: Railway Dashboard (Easiest)

1. Go to https://railway.app/dashboard
2. Click on your **backend service**
3. Click **Variables** tab
4. Click **New Variable**
5. Set:
   - **Name**: `PROD_MONGO_URI`
   - **Value**: `mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin`
6. Click **Add**
7. Railway will automatically redeploy (~3 minutes)

### Method 2: Railway CLI

```bash
railway login
railway link
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"
```

### Method 3: Copy-Paste Ready Command

```bash
# Just copy and paste this entire block
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"
```

## After Setting the Variable

### Railway Will:
1. Detect the new variable (10-30 seconds)
2. Trigger a redeploy (2-3 minutes)
3. Restart the service with new environment

### Check Logs:
```bash
railway logs --follow
```

### Look For:
✅ `Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13,...}`
✅ `Database sync completed for instance {"instanceId":"mongodb-atlas-ships","success":true,...}`
❌ No more "bad auth" errors

## Verify It's Working

### Test 1: Check Logs (After 5 minutes)
```bash
railway logs | grep mongodb-atlas-ships
```

Should show successful database sync, not authentication errors.

### Test 2: Upload MongoDB Script
1. Go to application UI
2. Select:
   - **Instance**: MongoDB Atlas - Ships Cluster
   - **Database**: 69401559e576ef4085e50133_test
3. Upload `test-mongodb-upload.js`
4. Click Execute

Expected result:
```
✅ Successfully connected to MongoDB!
✅ Collections found: 5
✅ Test completed successfully!
```

### Test 3: Check Instance Dropdown
The "MongoDB Atlas - Ships Cluster" instance should:
- ✅ Appear in the instance dropdown
- ✅ Show 13 databases when selected
- ✅ Allow script uploads without "Invalid instance" error

## Why This Happened

The MongoDB connection string requires:
1. **URL-encoded password**: `@` → `%40`
2. **authSource parameter**: `?authSource=admin`
3. **Correct protocol**: `mongodb+srv://` for Atlas

Without these, MongoDB Atlas rejects the connection.

## All Required Environment Variables

For reference, here are ALL the environment variables that should be set in Railway:

```bash
# MongoDB (THIS IS WHAT YOU NEED TO ADD)
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin

# PostgreSQL (should already be set)
PROD_TARGET_URL=postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require

# Portal Database (should already be set)
PORTAL_DB_HOST=ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=zluri_portal_db
PORTAL_DB_USER=neondb_owner
PORTAL_DB_PASSWORD=npg_oG6uQWgUBz8a
PORTAL_DB_SSL=true

# Environment (should already be set)
NODE_ENV=production

# JWT (should already be set)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
```

## Timeline

1. **Set variable in Railway**: 1 minute
2. **Railway redeploys**: 3 minutes
3. **Service restarts**: 30 seconds
4. **Database sync runs**: 30 seconds
5. **Ready to test**: ~5 minutes total

## Quick Checklist

- [ ] Set `PROD_MONGO_URI` in Railway
- [ ] Wait 5 minutes for Railway to redeploy
- [ ] Check logs for successful MongoDB sync
- [ ] Test MongoDB script upload
- [ ] Verify no "Invalid instance" errors

## Status Summary

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Code Fix | ✅ Complete | None |
| Database Schema | ✅ Fixed | None |
| PostgreSQL Instance | ✅ Working | None |
| MongoDB Instance | ❌ Auth Failed | **Set PROD_MONGO_URI in Railway** |
| Script Upload | ⏳ Waiting | Wait for MongoDB fix |

## Next Step

**👉 Set the `PROD_MONGO_URI` environment variable in Railway now!**

Once that's done, wait 5 minutes and test the script upload. Everything should work!
