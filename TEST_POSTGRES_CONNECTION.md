# Test PostgreSQL Connection

## Quick Test Script

Run this to verify the PostgreSQL instance works:

```bash
# Test connection directly
psql 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require' -c "SELECT 'Connection successful!' as status"
```

## Test via Node.js Script

```bash
# Set environment variable
export PROD_TARGET_URL="postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require"

# Run test script
CONNECTION_STRING="$PROD_TARGET_URL" node test-postgres-script.js
```

Expected output:
```
Starting PostgreSQL test...
✅ Connected to PostgreSQL
Database: zluri_portal_db
Version: PostgreSQL 16.4 on x86_64-pc-linux-gnu, compiled by...

Tables in database:
  - access_token_blacklist
  - audit_logs
  - database_blacklist
  - database_instances
  - database_sync_history
  - databases
  - pods
  - query_requests
  - refresh_tokens
  - slack_notifications
  - user_token_invalidations
  - users

✅ PostgreSQL test completed successfully!
```

## Verify Instance Configuration

Check that the instance is properly configured in the database:

```bash
psql 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require' -c "
SELECT 
    id, 
    name, 
    type, 
    connection_string_env,
    last_sync_status,
    last_sync_at
FROM database_instances 
WHERE id = 'prod-target-aws';
"
```

Expected output:
```
      id       |        name        |    type    | connection_string_env | last_sync_status |      last_sync_at       
---------------+--------------------+------------+-----------------------+------------------+-------------------------
 prod-target-aws | Zluri Query Portal | postgresql | PROD_TARGET_URL       | success          | 2026-01-19 08:00:00.000
```

## Verify Databases

Check that databases are synced for this instance:

```bash
psql 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require' -c "
SELECT 
    name, 
    is_active, 
    source,
    last_seen_at
FROM databases 
WHERE instance_id = 'prod-target-aws'
ORDER BY name;
"
```

Expected output:
```
     name     | is_active | source |      last_seen_at       
--------------+-----------+--------+-------------------------
 analytics_db | t         | synced | 2026-01-19 08:00:00.000
 customer_db  | t         | synced | 2026-01-19 08:00:00.000
 postgres     | t         | synced | 2026-01-19 08:00:00.000
```

## Test Script Upload (Manual)

1. Go to the application UI
2. Navigate to "Query Submission" or "Script Upload"
3. Select:
   - **Instance**: Zluri Query Portal
   - **Database**: analytics_db
4. Upload this test script (`test-simple.js`):

```javascript
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.CONNECTION_STRING,
        ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Current time:', result.rows[0].current_time);
    
    await client.end();
}

main().catch(console.error);
```

5. Click "Execute" or "Submit"
6. Expected result:
   - ✅ Status: Success
   - ✅ Output shows: "Connected successfully!" and current timestamp
   - ✅ No "Invalid instance" error

## Troubleshooting

### If you see "Invalid instance" error:
1. Check Railway environment variables:
   ```bash
   railway variables
   ```
   
2. Verify `PROD_TARGET_URL` is set correctly

3. Check backend logs:
   ```bash
   railway logs
   ```
   
4. Look for errors like:
   - "Instance not found: prod-target-aws"
   - "connection_string_env not found"

### If connection fails:
1. Verify the connection string works directly:
   ```bash
   psql "$PROD_TARGET_URL" -c "SELECT 1"
   ```

2. Check SSL settings (must have `sslmode=require`)

3. Verify Neon database is accessible from Railway's network

### If databases don't show:
1. Trigger a manual sync:
   ```bash
   # Via API (if you have admin access)
   curl -X POST https://your-backend.railway.app/api/v1/admin/sync \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. Check sync status:
   ```bash
   psql "$PROD_TARGET_URL" -c "
   SELECT id, name, last_sync_status, last_sync_error 
   FROM database_instances;
   "
   ```

## Success Criteria

✅ PostgreSQL connection works
✅ Instance loads from database
✅ Credentials retrieved from environment
✅ Script executes successfully
✅ Results displayed in UI
✅ No "Invalid instance" errors
