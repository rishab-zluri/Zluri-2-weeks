# 🚨 RUN THIS SQL NOW - Fix Schema Error

## The Error You're Seeing

```
[error]: null value in column "host" of relation "database_instances" violates not-null constraint
[error]: Failed to seed instances
```

This means the database schema still requires `host` to be NOT NULL, but MongoDB instances don't have a host - they use connection strings.

---

## ✅ SOLUTION: Run This SQL on Your Neon Database

### Option 1: Via Railway CLI (Easiest)

```bash
# Make sure you're in the project root directory
railway link

# Then run the migration
railway run psql $DATABASE_URL -f backend/fix-host-port-nullable.sql
```

### Option 2: Copy/Paste in Railway Dashboard

1. Go to Railway Dashboard
2. Click on your **Postgres database** (not the backend service)
3. Click **"Data"** tab
4. Click **"Query"** button
5. Paste this SQL and click **"Run"**:

```sql
-- Make host and port nullable for connection-string-based instances
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

### Option 3: Via psql Directly

```bash
# Get your DATABASE_URL from Railway dashboard Variables tab
# Then run:
psql "your-neon-database-url-here" -f backend/fix-host-port-nullable.sql
```

---

## ✅ Verify It Worked

After running the SQL, check the schema:

```sql
\d database_instances
```

You should see:
```
Column |          Type          | Nullable
-------+------------------------+----------
host   | character varying(255) | YES      ← Should say YES (nullable)
port   | integer                | YES      ← Should say YES (nullable)
```

---

## ✅ Then Check Railway Logs

After the schema fix, restart your Railway backend service (or wait for next deployment).

You should see:
```
✅ [info]: Seeded/Updated instance: mongodb-atlas-ships
✅ No more "null value in column host" errors
```

---

## ⚠️ This Must Be Done BEFORE MongoDB Will Work

The schema error happens BEFORE the MongoDB auth check. So even if you set the PROD_MONGO_URI correctly, it won't help until you fix the schema first.

**Order of operations:**
1. **FIRST**: Fix schema (this step) ← YOU ARE HERE
2. **SECOND**: Set PROD_MONGO_URI in Railway Variables
3. **THIRD**: Deploy nixpacks.toml for Python3

---

## 🔗 Quick Links

- Railway Dashboard: https://railway.app
- Your Neon Database: Check Railway dashboard for connection details
- SQL File: `backend/fix-host-port-nullable.sql`

---

## ❓ Need Help?

If you can't access Railway CLI or the dashboard, you can also:
1. Connect to Neon directly using their dashboard
2. Run the SQL in Neon's SQL editor
3. The DATABASE_URL is the same connection string

The key is to run those ALTER TABLE commands on your production database!
