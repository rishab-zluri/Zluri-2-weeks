# Fix MongoDB Authentication & Python3 Installation

## Critical Issues Found

### Issue 1: MongoDB Authentication Failure
```
[error]: bad auth : Authentication failed.
```

### Issue 2: Python3 Not Installed
```
[error]: spawn python3 ENOENT
```

---

## SOLUTION 1: Fix MongoDB Connection String

### Step 1: Set Correct MongoDB URI in Railway

Go to Railway → Your Backend Service → Variables → Add/Update:

```bash
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin
```

**CRITICAL NOTES**:
- Password `123@Acharjee` MUST be URL-encoded as `123%40Acharjee`
- The `@` symbol becomes `%40`
- Must include `&authSource=admin` at the end
- No database name in the connection string (we connect to specific databases dynamically)

### Step 2: Verify the Variable is Set

In Railway dashboard, you should see:
```
PROD_MONGO_URI = mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin
```

### Step 3: Redeploy

After setting the variable, Railway will automatically redeploy. Wait 2-3 minutes.

---

## SOLUTION 2: Install Python3 in Railway Container

### Option A: Add Nixpacks Configuration (RECOMMENDED)

Create a file `nixpacks.toml` in the backend directory:

```toml
[phases.setup]
nixPkgs = ["nodejs", "python3", "python3Packages.pip"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

### Option B: Add to Dockerfile (if using Docker)

If you have a Dockerfile, add:
```dockerfile
RUN apt-get update && apt-get install -y python3 python3-pip
```

### Option C: Use Railway's Nixpacks (Automatic)

Railway uses Nixpacks by default. Create `nixpacks.toml` in your backend folder:

```toml
[phases.setup]
nixPkgs = ["python3"]
```

---

## Quick Fix Commands

### 1. Create nixpacks.toml
```bash
cd backend
cat > nixpacks.toml << 'EOF'
[phases.setup]
nixPkgs = ["nodejs", "python3", "python3Packages.pip"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
EOF
```

### 2. Commit and Push
```bash
git add backend/nixpacks.toml
git commit -m "Add Python3 support for script execution"
git push
```

### 3. Set MongoDB URI in Railway Dashboard
- Go to Railway dashboard
- Select your backend service
- Click "Variables" tab
- Add or update `PROD_MONGO_URI` with the correct value above
- Railway will auto-redeploy

---

## Verification Steps

### After Deployment, Check Logs for:

✅ **MongoDB Connection Success**:
```
[info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13,...}
[info]: Database sync completed for instance {"instanceId":"mongodb-atlas-ships","success":true}
```

✅ **Python3 Available**:
```
[info]: Script language detected {"language":"python","instanceId":"mongodb-atlas-ships"}
[info]: Script executed successfully
```

❌ **Still Failing** (what to look for):
```
[error]: bad auth : Authentication failed.  ← MongoDB URI still wrong
[error]: spawn python3 ENOENT  ← Python3 still not installed
```

---

## Testing After Fix

### Test 1: MongoDB Query
1. Submit a MongoDB query to any MongoDB database
2. Approve it
3. Should execute successfully

### Test 2: Python Script on MongoDB
1. Upload a Python script (.py) for MongoDB
2. Approve it
3. Should execute successfully

### Test 3: JavaScript Script on MongoDB
1. Upload a JavaScript script (.js) for MongoDB
2. Approve it
3. Should execute successfully

---

## Current Status

### Working ✅
- PostgreSQL connections
- PostgreSQL queries
- Database sync for PostgreSQL

### Broken ❌
- MongoDB authentication (wrong/missing URI)
- Python script execution (Python3 not installed)
- JavaScript scripts on MongoDB (auth fails before execution)

---

## Environment Variables Checklist

Make sure these are set in Railway:

```bash
# Portal Database (Neon PostgreSQL)
DATABASE_URL=postgresql://...
PORTAL_DB_SSL=true

# Target PostgreSQL Database
PROD_TARGET_URL=postgresql://...

# Target MongoDB Database (FIX THIS!)
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin

# Other required vars
NODE_ENV=production
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
FRONTEND_URL=https://your-frontend.vercel.app
```

---

## Why This Happens

### MongoDB Auth Issue
- MongoDB Atlas requires proper authentication
- Special characters in passwords must be URL-encoded
- `authSource=admin` is required for Atlas clusters
- Without correct URI, all MongoDB operations fail

### Python3 Issue
- Railway's default Node.js container doesn't include Python
- Script execution spawns `python3` process
- If Python3 not found, script fails with ENOENT (file not found)
- Need to explicitly add Python to the container

---

## Next Steps

1. **IMMEDIATELY**: Set `PROD_MONGO_URI` in Railway with correct value
2. **THEN**: Create `backend/nixpacks.toml` to add Python3
3. **COMMIT & PUSH**: Railway will auto-deploy
4. **WAIT**: 3-5 minutes for deployment
5. **TEST**: Try MongoDB query and Python script
6. **VERIFY**: Check logs for success messages

---

## Expected Log Output After Fix

```
[info]: Starting database sync for instance {"instanceId":"mongodb-atlas-ships"}
[info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13}
[info]: Database sync completed for instance {"instanceId":"mongodb-atlas-ships","success":true}
[info]: Script language detected {"language":"python"}
[info]: Script executed successfully {"requestId":58,"duration":1234}
```

No more "bad auth" or "spawn python3 ENOENT" errors!
