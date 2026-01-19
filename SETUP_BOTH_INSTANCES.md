# Setup Both Database Instances

## Current Configuration

You have 2 instances configured:

1. **Zluri Query Portal** (PostgreSQL)
   - ID: `prod-target-aws`
   - Type: postgresql
   - Env var needed: `PROD_TARGET_URL`

2. **MongoDB Atlas - Ships Cluster** (MongoDB)
   - ID: `mongodb-atlas-ships`
   - Type: mongodb
   - Env var needed: `PROD_MONGO_URI`

## What You Need to Add to Railway

Add these 2 environment variables:

### 1. PostgreSQL Connection

```bash
PROD_TARGET_URL=postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require
```

**Note:** This points to your Neon database. The app will automatically discover all databases in this PostgreSQL instance.

### 2. MongoDB Connection

```bash
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority
```

**Note:** The app will automatically discover all databases in this MongoDB instance.

---

## How to Add (Choose One)

### Option 1: Railway CLI

```bash
# Add PostgreSQL
railway variables set PROD_TARGET_URL="postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require"

# Add MongoDB
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority"
```

### Option 2: Railway Dashboard

1. Go to Railway Dashboard
2. Click your backend service
3. Go to "Variables" tab
4. Add both variables:
   - Name: `PROD_TARGET_URL`, Value: (PostgreSQL connection string)
   - Name: `PROD_MONGO_URI`, Value: (MongoDB connection string)
5. Save

---

## What Will Happen

After adding these variables and redeploying:

### 1. Instance Dropdown Will Show:
- ✅ Zluri Query Portal (PostgreSQL)
- ✅ MongoDB Atlas - Ships Cluster (MongoDB)

### 2. When User Selects "Zluri Query Portal":
The database dropdown will show all databases in that PostgreSQL instance, like:
- zluri_portal_db
- postgres
- template1
- (any other databases in that instance)

### 3. When User Selects "MongoDB Atlas - Ships Cluster":
The database dropdown will show all databases in that MongoDB cluster, like:
- rishab1
- admin
- test
- (any other databases in that cluster)

---

## Database Discovery

The app automatically discovers databases by:

1. **PostgreSQL:** Runs `SELECT datname FROM pg_database WHERE datistemplate = false`
2. **MongoDB:** Runs `db.adminCommand({ listDatabases: 1 })`

This happens during the database sync (every 60 minutes or on startup).

---

## Excluding Databases

If you want to exclude certain databases (like system databases), they're already configured in the blacklist:
- postgres
- template1
- admin
- test
- etc.

These won't show up in the dropdown.

---

## Quick Add Script

Run this to add both at once:

```bash
railway variables set PROD_TARGET_URL="postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require" PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority"
```

---

## Verification

After adding and redeploying:

1. **Check Railway logs:**
   ```bash
   railway logs --follow
   ```
   
   Look for:
   ```
   ✅ Synced databases for instance: prod-target-aws
   ✅ Synced databases for instance: mongodb-atlas-ships
   ```

2. **Check your app:**
   - Login to frontend
   - Go to query submission
   - Instance dropdown should show both
   - Select each instance and verify databases appear

---

## Summary

**Add these 2 environment variables to Railway:**

1. `PROD_TARGET_URL` - PostgreSQL connection
2. `PROD_MONGO_URI` - MongoDB connection

**Then you'll have:**
- ✅ 2 instances in dropdown
- ✅ Databases auto-discovered for each
- ✅ Users can select instance → database → submit query

**That's it!** 🚀
