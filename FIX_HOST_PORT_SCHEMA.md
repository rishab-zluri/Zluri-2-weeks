# Fix database_instances Schema - Make host/port Nullable

## Problem

The `database_instances` table has `host` and `port` as NOT NULL columns, but connection-string-based instances (like MongoDB Atlas) don't use host/port - they use a full connection string instead.

**Error in logs:**
```
[error]: Query execution error {"text":"INSERT INTO database_instances (id, name, type, host, port, connec","error":"null value in column \"host\" of relation \"database_instances\" violates not-null constraint"}
[error]: Failed to seed instances
```

## Solution

Make `host` and `port` nullable, and add a constraint to ensure either (host AND port) OR connection_string_env is provided.

---

## Run This Fix on Railway

### Option 1: Via Railway CLI (Recommended)

```bash
# Connect to your Neon database via Railway
railway run psql $DATABASE_URL -f backend/fix-host-port-nullable.sql
```

### Option 2: Via psql Directly

```bash
# Get your DATABASE_URL from Railway dashboard
# Then run:
psql "your-database-url-here" -f backend/fix-host-port-nullable.sql
```

### Option 3: Via Railway Dashboard SQL Console

Copy and paste this SQL into Railway's database console:

```sql
-- Make host and port nullable
ALTER TABLE database_instances ALTER COLUMN host DROP NOT NULL;
ALTER TABLE database_instances ALTER COLUMN port DROP NOT NULL;

-- Add constraint to ensure either (host AND port) OR connection_string_env
ALTER TABLE database_instances DROP CONSTRAINT IF EXISTS check_connection_method;
ALTER TABLE database_instances ADD CONSTRAINT check_connection_method 
    CHECK (
        (host IS NOT NULL AND port IS NOT NULL) OR 
        (connection_string_env IS NOT NULL)
    );

-- Clean up any existing records
UPDATE database_instances 
SET host = NULL, port = NULL 
WHERE connection_string_env IS NOT NULL AND (host = '' OR host = 'N/A');
```

---

## Verify the Fix

After running the migration, check the schema:

```sql
\d database_instances
```

You should see:
```
host         | character varying(255) |           |          |  -- NO "not null"
port         | integer                |           |          |  -- NO "not null"
```

And a constraint:
```
Check constraints:
    "check_connection_method" CHECK (host IS NOT NULL AND port IS NOT NULL OR connection_string_env IS NOT NULL)
```

---

## After This Fix

The seeding error will be resolved, and the system will be able to:
1. ✅ Seed instances with host/port (PostgreSQL)
2. ✅ Seed instances with connection_string_env (MongoDB Atlas)
3. ✅ Prevent invalid instances (neither host/port nor connection_string_env)

---

## Then Fix MongoDB Auth

After this schema fix, you still need to:
1. Set `PROD_MONGO_URI` in Railway Variables
2. Deploy the nixpacks.toml for Python3 support

See `MONGODB_FIX_ACTION_REQUIRED.md` for those steps.

---

## Files Modified

1. `backend/fix-host-port-nullable.sql` - Migration script (NEW)
2. `backend/portal_db_schema.sql` - Updated schema definition

---

## Expected Log After Fix

```
✅ [info]: Seeding/Updating database instances from static config...
✅ [info]: Seeded/Updated instance: Zluri Query Portal
✅ [info]: Seeded/Updated instance: prod-target-aws
✅ [info]: Seeded/Updated instance: mongodb-atlas-ships
```

No more "null value in column host" errors!
