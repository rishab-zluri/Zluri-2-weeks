# Fix MongoDB Authentication Error

## The Error

```
bad auth : Authentication failed.
```

This means the MongoDB credentials are incorrect or the connection string format is wrong.

## The Issue

Your password `123@Acharjee` contains special characters that need proper URL encoding.

## The Fix

### Correct MongoDB Connection String

```bash
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin
```

**Key points:**
- `@` in password is encoded as `%40`
- Added `authSource=admin` to specify authentication database

### Alternative: If username is different

Check your MongoDB Atlas dashboard for the correct username. It might be:
- `rishab1` (what we're using)
- Or something else

## How to Fix

### Option 1: Update Railway Variable

```bash
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"
```

### Option 2: Railway Dashboard

1. Go to Railway Dashboard
2. Click your backend service
3. Variables tab
4. Find `PROD_MONGO_URI`
5. Update to: `mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin`
6. Save

## Verify MongoDB Atlas Credentials

1. Go to https://cloud.mongodb.com
2. Click "Database Access" (left sidebar)
3. Check:
   - Username: Should be `rishab1`
   - Password: Should be `123@Acharjee`
   - Database User Privileges: Should have "Read and write to any database" or specific database access

## Test Connection Locally

```bash
mongosh "mongodb+srv://rishab1:123@Acharjee@ships.gwsbr.mongodb.net/?authSource=admin"
```

If this works locally, the credentials are correct.

## Common Issues

### Issue 1: Wrong Username
**Solution:** Check MongoDB Atlas → Database Access for correct username

### Issue 2: Wrong Password
**Solution:** Reset password in MongoDB Atlas:
1. Database Access → Edit user
2. Edit Password
3. Set to: `123@Acharjee`
4. Update

### Issue 3: User Doesn't Exist
**Solution:** Create user in MongoDB Atlas:
1. Database Access → Add New Database User
2. Username: `rishab1`
3. Password: `123@Acharjee`
4. Database User Privileges: "Read and write to any database"
5. Add User

### Issue 4: IP Not Whitelisted
**Solution:** 
1. Network Access → Add IP Address
2. Select "Allow Access from Anywhere" (0.0.0.0/0)
3. Confirm

## After Fixing

Railway will auto-redeploy. Check logs:

```bash
railway logs --follow
```

Look for:
```
✅ Synced databases for instance: mongodb-atlas-ships
```

Instead of:
```
❌ bad auth : Authentication failed
```

## Quick Fix Command

```bash
# Update the variable with correct format
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin"
```

---

**Most likely fix: Add `&authSource=admin` to the connection string!**
