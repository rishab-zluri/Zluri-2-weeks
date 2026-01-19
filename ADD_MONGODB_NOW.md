# 🍃 Add MongoDB Atlas to Your App

## What I Did

✅ Added MongoDB Atlas instance to your database:
- **ID:** `mongodb-atlas-ships`
- **Name:** MongoDB Atlas - Ships Cluster
- **Type:** mongodb
- **Host:** ships.gwsbr.mongodb.net
- **Status:** Active

## What You Need to Do

Add this environment variable to your Railway deployment:

### Environment Variable to Add:

```bash
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority
```

**Note:** The `@` in the password is URL-encoded as `%40`

### How to Add It:

#### Option 1: Railway Dashboard

1. Go to Railway Dashboard
2. Click on your backend service
3. Go to "Variables" tab
4. Click "+ New Variable"
5. Add:
   - Name: `PROD_MONGO_URI`
   - Value: `mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority`
6. Save

Railway will automatically redeploy.

#### Option 2: Railway CLI

```bash
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority"
```

---

## After Adding the Variable

1. **Wait for redeploy** (30-60 seconds)
2. **Refresh your frontend**
3. **Check the instances dropdown** - you should now see:
   - ✅ Zluri Query Portal (PostgreSQL)
   - ✅ MongoDB Atlas - Ships Cluster (MongoDB)

---

## Verify MongoDB is Working

### Check Railway Logs

You should see:
```
✅ Database sync scheduler started
✅ Synced databases for instance: mongodb-atlas-ships
```

### Test in Your App

1. Login to your frontend
2. Go to query submission page
3. Select "MongoDB Atlas - Ships Cluster" from the instance dropdown
4. You should see available databases listed

---

## MongoDB Connection String Breakdown

```
mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority
```

- **Protocol:** `mongodb+srv://` (MongoDB Atlas SRV connection)
- **Username:** `rishab1`
- **Password:** `123@Acharjee` (URL-encoded as `123%40Acharjee`)
- **Host:** `ships.gwsbr.mongodb.net`
- **Options:** `retryWrites=true&w=majority`

---

## Troubleshooting

### MongoDB Not Showing Up?

1. **Check environment variable is set:**
   ```bash
   railway variables
   ```
   Look for `PROD_MONGO_URI`

2. **Check Railway logs:**
   ```bash
   railway logs --follow
   ```
   Look for MongoDB connection errors

3. **Verify MongoDB Atlas:**
   - Check that IP whitelist allows connections (0.0.0.0/0 for Railway)
   - Verify username/password are correct
   - Ensure database user has read permissions

### Connection Errors?

If you see `MongoServerError: bad auth`:
- Double-check username: `rishab1`
- Double-check password: `123@Acharjee`
- Verify the user exists in MongoDB Atlas

If you see `connection timeout`:
- Check MongoDB Atlas Network Access
- Add `0.0.0.0/0` to IP whitelist (allows Railway to connect)

---

## MongoDB Atlas Configuration

### Allow Railway to Connect

1. Go to MongoDB Atlas Dashboard
2. Click "Network Access" in left sidebar
3. Click "Add IP Address"
4. Select "Allow Access from Anywhere" (0.0.0.0/0)
5. Or add Railway's IP ranges if you know them
6. Save

### Verify Database User

1. Go to "Database Access" in MongoDB Atlas
2. Verify user `rishab1` exists
3. Ensure it has "Read and write to any database" or specific database permissions
4. Password should be `123@Acharjee`

---

## Current Database Instances

After adding the environment variable, you'll have:

| ID | Name | Type | Status |
|----|------|------|--------|
| prod-target-aws | Zluri Query Portal | PostgreSQL | ✅ Active |
| mongodb-atlas-ships | MongoDB Atlas - Ships Cluster | MongoDB | ✅ Active |

---

## Quick Commands

```bash
# Add environment variable
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority"

# Check variables
railway variables

# View logs
railway logs --follow

# Test MongoDB connection locally
mongosh "mongodb+srv://rishab1:123@Acharjee@ships.gwsbr.mongodb.net/"
```

---

**Next Step: Add `PROD_MONGO_URI` to Railway and your MongoDB will appear!** 🚀
