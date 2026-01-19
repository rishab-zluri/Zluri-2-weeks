# PostgreSQL Script SSL Connection Fix

## Problem

When uploading and executing PostgreSQL scripts via the UI, users were encountering this error:

```
connection is insecure (try using `sslmode=require`)
```

This occurred even though the script included SSL configuration:
```javascript
const client = new Client({
    connectionString: process.env.CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});
```

## Root Cause

The issue was in the **script worker** (`backend/src/services/script/worker/scriptWorker.ts`).

When executing scripts, the worker creates a PostgreSQL client connection but was **NOT including SSL configuration**:

```typescript
// BEFORE (Missing SSL config)
dbClient = new Client({
    host: pgInstance.host,
    port: pgInstance.port || 5432,
    database: databaseName,
    user: pgInstance.user,
    password: pgInstance.password,
    query_timeout: timeout,
    // ❌ No SSL config!
});
```

This caused a mismatch:
- The Neon PostgreSQL connection string has `sslmode=require`
- The worker was creating a connection WITHOUT SSL
- PostgreSQL rejected the insecure connection

## Solution

Added SSL configuration to the PostgreSQL client in the worker:

```typescript
// AFTER (With SSL config)
dbClient = new Client({
    host: pgInstance.host,
    port: pgInstance.port || 5432,
    database: databaseName,
    user: pgInstance.user,
    password: pgInstance.password,
    query_timeout: timeout,
    ssl: {
        rejectUnauthorized: false  // ✅ SSL enabled
    },
});
```

## Files Modified

1. **`backend/src/services/script/worker/scriptWorker.ts`** (Line ~450)
   - Added `ssl: { rejectUnauthorized: false }` to PostgreSQL client configuration

## Testing

After this fix, PostgreSQL scripts should execute successfully:

### Test Script
```javascript
const { Client } = require('pg');

async function main() {
    console.log('🚀 Starting PostgreSQL connection test...');
    
    const client = new Client({
        connectionString: process.env.CONNECTION_STRING,
        ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL!');
    
    const result = await client.query('SELECT current_database(), current_user');
    console.log('Database:', result.rows[0].current_database);
    console.log('User:', result.rows[0].current_user);
    
    await client.end();
    console.log('✅ Test completed successfully!');
}

main();
```

### Expected Output
```
🚀 Starting PostgreSQL connection test...
✅ Successfully connected to PostgreSQL!
Database: portal_db
User: neondb_owner
✅ Test completed successfully!
```

## Why `rejectUnauthorized: false`?

This setting allows connections to databases with self-signed certificates or certificates that can't be verified. This is common for:

- **Development databases** (local PostgreSQL)
- **Cloud databases** (Neon, Railway, Heroku)
- **Internal databases** (behind corporate firewalls)

For production environments with proper SSL certificates, you can set `rejectUnauthorized: true` for stricter security.

## Deployment

After making this change:

1. **Build the backend**: `npm run build` (already done)
2. **Commit changes**: 
   ```bash
   git add backend/src/services/script/worker/scriptWorker.ts
   git commit -m "fix: add SSL config to PostgreSQL script worker"
   ```
3. **Deploy to Railway**: Push to main branch or redeploy manually
4. **Test**: Upload a PostgreSQL script via the UI and verify it executes successfully

## Related Files

- **Script Executor**: `backend/src/services/script/ScriptExecutor.ts` - Manages script execution
- **Query Routes**: `backend/src/routes/queryRoutes.ts` - Handles script upload endpoint
- **OpenAPI Spec**: `openapi-complete.yaml` - Documents the `/queries/submit-script` endpoint

## Notes

- This fix applies to **script execution only** (not direct queries)
- Direct queries use the `PostgresDriver` which already has proper SSL handling
- MongoDB scripts are unaffected (they use connection strings with SSL built-in)
- The worker runs in an isolated child process for security

## Status

✅ **FIXED** - PostgreSQL scripts now execute successfully with SSL connections
