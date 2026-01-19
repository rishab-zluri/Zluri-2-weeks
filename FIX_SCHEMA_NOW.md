# Fix Schema Issues

## The Problem

Your logs show:
```
column "created_by" of relation "database_blacklist" does not exist
```

This is a minor schema mismatch from the migrations.

## The Fix (1 minute)

Run this command in your terminal:

```bash
cd backend
railway run psql $DATABASE_URL < fix-schema.sql
```

This will:
1. Add the missing `created_by` column
2. Add a unique constraint on `pattern` (for ON CONFLICT to work)
3. Verify the fixes

## Expected Output

You should see:
```
NOTICE: Added created_by column to database_blacklist
NOTICE: Added unique constraint on pattern
```

Then a table showing all columns in `database_blacklist`.

## After the Fix

Restart your Railway service or wait for it to auto-restart. The error will be gone!

## Alternative: Run SQL Directly

If the above doesn't work, you can run this SQL directly in Railway's PostgreSQL Query tab:

```sql
-- Add created_by column
ALTER TABLE database_blacklist 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add unique constraint
ALTER TABLE database_blacklist 
ADD CONSTRAINT database_blacklist_pattern_key UNIQUE (pattern);
```

## Verify

Check Railway logs - you should no longer see the `created_by` error.

---

## About the Other Error

You also see:
```
database "target_db" does not exist
```

This is **normal and expected**! Your app is trying to sync to external target databases that you haven't configured yet. This won't affect your app's functionality - it's just trying to discover databases from AWS Secrets Manager or static config.

To fix this (optional):
1. Remove or update the `prod-target-aws` instance configuration
2. Or configure actual target databases you want to query

For now, you can ignore this error - it won't prevent login or basic functionality.
