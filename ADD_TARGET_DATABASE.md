# Add Target PostgreSQL Database

## Current Status

✅ **Removed:** Portal database (internal use only)  
✅ **Active:** MongoDB Atlas - Ships Cluster

## Add Your Target PostgreSQL Database

You need to add the PostgreSQL database that users will query against.

### Option 1: Add Neon Target Database

If you want to use your Neon database as a target:

```sql
INSERT INTO database_instances (
    id,
    name,
    type,
    host,
    port,
    connection_string_env,
    is_active,
    created_at,
    updated_at
) VALUES (
    'neon-target-db',
    'Neon Production Database',
    'postgresql',
    'ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech',
    5432,
    'TARGET_NEON_URL',
    true,
    NOW(),
    NOW()
);
```

Then add to Railway:
```bash
TARGET_NEON_URL=postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/your_target_db?sslmode=require
```

### Option 2: Add Different PostgreSQL Database

If you have a different target database:

```sql
INSERT INTO database_instances (
    id,
    name,
    type,
    host,
    port,
    connection_string_env,
    is_active,
    created_at,
    updated_at
) VALUES (
    'prod-postgres-target',
    'Production PostgreSQL',
    'postgresql',
    'your-postgres-host.com',
    5432,
    'PROD_TARGET_URL',
    true,
    NOW(),
    NOW()
);
```

Then add to Railway:
```bash
PROD_TARGET_URL=postgresql://username:password@host:5432/database?sslmode=require
```

### Option 3: No Target PostgreSQL (MongoDB Only)

If you only want MongoDB Atlas for now, you're all set! Users will only see:
- ✅ MongoDB Atlas - Ships Cluster

---

## Quick Add Script

Tell me which option you want and I'll add it for you:

1. **Neon database as target** - Use the Neon instance you showed me
2. **Different PostgreSQL** - Provide connection details
3. **MongoDB only** - No PostgreSQL target needed

---

## Current Database Instances

After removing the portal database:

| ID | Name | Type | Purpose |
|----|------|------|---------|
| mongodb-atlas-ships | MongoDB Atlas - Ships Cluster | MongoDB | ✅ Target for queries |

**Portal database (zluri_portal_db) is NOT listed** - it's only used internally for user management.

---

## What Users Will See

In the query submission page, users will see:
- MongoDB Atlas - Ships Cluster (if you add PROD_MONGO_URI)
- [Your target PostgreSQL] (if you add one)

They will NOT see the portal database.

---

**Let me know which target PostgreSQL database you want to add, or if MongoDB only is fine!**
