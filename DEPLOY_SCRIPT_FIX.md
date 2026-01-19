# 🚀 Deploy Script Upload Fix

## Changes Summary
Fixed "Invalid instance" error for MongoDB and PostgreSQL script uploads by loading instances from the database instead of static configuration.

## Pre-Deployment Checklist

### 1. Verify Build
```bash
cd backend
npm run build
```
✅ Build completed successfully
✅ No TypeScript errors
✅ Files compiled to `dist/` directory

### 2. Verify Environment Variables in Railway
```bash
railway variables
```

Required variables:
- ✅ `PROD_TARGET_URL` - PostgreSQL connection string
- ✅ `PROD_MONGO_URI` - MongoDB connection string
- ✅ `PORTAL_DB_SSL=true` - SSL enabled
- ✅ `NODE_ENV=production` - Production mode

### 3. Verify Database State
```bash
psql 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require' -c "
SELECT id, name, type, connection_string_env 
FROM database_instances 
WHERE is_active = true;
"
```

Expected output:
```
       id        |             name              |    type    | connection_string_env 
-----------------+-------------------------------+------------+-----------------------
 prod-target-aws | Zluri Query Portal            | postgresql | PROD_TARGET_URL
 mongodb-atlas-ships | MongoDB Atlas - Ships Cluster | mongodb    | PROD_MONGO_URI
```

## Deployment Steps

### Step 1: Commit Changes
```bash
git add backend/src/services/script/ScriptExecutor.ts
git add backend/src/services/queryExecution/strategies/MongoDriver.ts
git add backend/src/services/queryExecution/strategies/PostgresDriver.ts
git add FIX_SCRIPT_UPLOAD.md
git add SCRIPT_UPLOAD_FIX_SUMMARY.md
git add TEST_POSTGRES_CONNECTION.md
git add DEPLOY_SCRIPT_FIX.md

git commit -m "Fix: Load database instances from database for script execution

- Updated ScriptExecutor to load instances from databaseSyncService
- Updated MongoDriver to use database-driven instance config
- Updated PostgresDriver to use database-driven instance config
- Fixes 'Invalid instance' error for MongoDB script uploads
- Supports both .js and .py script files
- Properly loads connection strings from environment variables"
```

### Step 2: Push to Railway
```bash
git push origin main
```

Railway will automatically:
1. Detect the push
2. Run `npm install` (if package.json changed)
3. Run `npm run build` (compile TypeScript)
4. Run `npm start` (start server)
5. Deploy the new version

### Step 3: Monitor Deployment
```bash
# Watch Railway logs
railway logs --follow
```

Look for these success indicators:
- ✅ `MikroORM initialized successfully`
- ✅ `Server running on port 8080`
- ✅ `Database sync completed for instance`
- ✅ `Seeded/Updated instance: Zluri Query Portal`
- ✅ `Seeded/Updated instance: MongoDB Atlas - Ships Cluster`

Look for these error indicators (should NOT appear):
- ❌ `Instance not found`
- ❌ `connection is insecure`
- ❌ `Invalid instance`

## Post-Deployment Verification

### Test 1: Check Health Endpoint
```bash
curl https://your-backend.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-19T...",
  "uptime": 123.45,
  "database": "connected",
  "sync": {
    "isRunning": true,
    "lastSyncAt": "2026-01-19T...",
    "instancesCached": 2
  }
}
```

### Test 2: Check Instances API
```bash
curl https://your-backend.railway.app/api/v1/instances \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
[
  {
    "id": "prod-target-aws",
    "name": "Zluri Query Portal",
    "type": "postgresql"
  },
  {
    "id": "mongodb-atlas-ships",
    "name": "MongoDB Atlas - Ships Cluster",
    "type": "mongodb"
  }
]
```

### Test 3: Check Databases for PostgreSQL Instance
```bash
curl https://your-backend.railway.app/api/v1/instances/prod-target-aws/databases \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
[
  { "name": "analytics_db" },
  { "name": "customer_db" },
  { "name": "postgres" }
]
```

### Test 4: Check Databases for MongoDB Instance
```bash
curl https://your-backend.railway.app/api/v1/instances/mongodb-atlas-ships/databases \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
[
  { "name": "69401559e576ef4085e50133_test" },
  { "name": "69401559e576ef4085e50133_truth" },
  { "name": "694047d693600ea800754f3c_test" },
  ...
]
```

### Test 5: Upload PostgreSQL Script via UI

1. Login to the application
2. Navigate to "Query Submission" or "Script Upload"
3. Select:
   - **Instance**: Zluri Query Portal
   - **Database**: analytics_db
4. Create and upload `test-pg.js`:
```javascript
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.CONNECTION_STRING,
        ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ PostgreSQL connection successful!');
    
    const result = await client.query('SELECT current_database(), version()');
    console.log('Database:', result.rows[0].current_database);
    console.log('Version:', result.rows[0].version.substring(0, 80));
    
    await client.end();
}

main().catch(console.error);
```

5. Click "Execute"
6. Expected result:
   - ✅ Status: Success
   - ✅ Output shows connection success and database info
   - ✅ No "Invalid instance" error

### Test 6: Upload MongoDB Script via UI

1. Select:
   - **Instance**: MongoDB Atlas - Ships Cluster
   - **Database**: 69401559e576ef4085e50133_test
2. Create and upload `test-mongo.js`:
```javascript
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient(process.env.CONNECTION_STRING);
    
    await client.connect();
    console.log('✅ MongoDB connection successful!');
    
    const db = client.db(process.env.DATABASE_NAME);
    const collections = await db.listCollections().toArray();
    
    console.log('Database:', process.env.DATABASE_NAME);
    console.log('Collections:', collections.map(c => c.name).join(', '));
    
    await client.close();
}

main().catch(console.error);
```

3. Click "Execute"
4. Expected result:
   - ✅ Status: Success
   - ✅ Output shows connection success and collections
   - ✅ No "Invalid instance" error

### Test 7: Upload Python Script via UI

1. Select:
   - **Instance**: MongoDB Atlas - Ships Cluster
   - **Database**: 69401559e576ef4085e50133_test
2. Create and upload `test-mongo.py`:
```python
from pymongo import MongoClient
import os

def main():
    client = MongoClient(os.environ['CONNECTION_STRING'])
    print('✅ MongoDB connection successful!')
    
    db = client[os.environ['DATABASE_NAME']]
    collections = db.list_collection_names()
    
    print(f'Database: {os.environ["DATABASE_NAME"]}')
    print(f'Collections: {", ".join(collections)}')
    
    client.close()

if __name__ == '__main__':
    main()
```

3. Click "Execute"
4. Expected result:
   - ✅ Status: Success
   - ��� Output shows connection success and collections
   - ✅ No "Invalid instance" error

## Rollback Plan (If Needed)

If the deployment causes issues:

### Option 1: Revert via Git
```bash
# Find the commit before the fix
git log --oneline

# Revert to previous commit
git revert HEAD

# Push to trigger redeployment
git push origin main
```

### Option 2: Rollback via Railway Dashboard
1. Go to Railway dashboard
2. Click on your backend service
3. Go to "Deployments" tab
4. Find the previous successful deployment
5. Click "Redeploy"

## Success Criteria

✅ All tests pass
✅ No "Invalid instance" errors
✅ PostgreSQL scripts execute successfully
✅ MongoDB scripts execute successfully
✅ Both .js and .py files work
✅ Proper error messages if connection fails
✅ Results displayed correctly in UI
✅ No regression in existing functionality

## Troubleshooting

### Issue: "Instance not found" error
**Solution**: Check that database_instances table has the correct instances
```bash
psql "$PROD_TARGET_URL" -c "SELECT id, name FROM database_instances WHERE is_active = true;"
```

### Issue: "Connection string not found" error
**Solution**: Verify environment variables in Railway
```bash
railway variables | grep -E "(PROD_TARGET_URL|PROD_MONGO_URI)"
```

### Issue: MongoDB authentication fails
**Solution**: Check that password is URL-encoded in PROD_MONGO_URI
- Wrong: `123@Acharjee`
- Correct: `123%40Acharjee`

### Issue: PostgreSQL SSL error
**Solution**: Ensure connection string has `?sslmode=require`
```bash
echo $PROD_TARGET_URL | grep sslmode
```

## Deployment Timeline

- **Commit**: ~1 minute
- **Push**: ~1 minute
- **Railway Build**: ~2-3 minutes
- **Railway Deploy**: ~1 minute
- **Total**: ~5-6 minutes

## Post-Deployment Monitoring

Monitor for 24 hours:
- Check error logs for any "Invalid instance" errors
- Monitor script execution success rate
- Check connection pool statistics
- Verify no memory leaks from connection pools

## Status: Ready to Deploy ✅

All changes have been:
- ✅ Implemented
- ✅ Built successfully
- ✅ Tested locally
- ✅ Documented
- ✅ Ready for production deployment

Proceed with deployment when ready!
