# Database Migration Guide

## Overview

This document explains the database architecture and why migration scripts are required for the Database Query Execution Portal.

## Database Architecture

The portal uses a **two-database architecture**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE QUERY EXECUTION PORTAL                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐         ┌──────────────────────────────┐  │
│  │     PORTAL DB        │         │      TARGET DATABASES        │  │
│  │   (portal_db)        │         │   (customer_db, etc.)        │  │
│  ├──────────────────────┤         ├──────────────────────────────┤  │
│  │ • users              │         │ • Application tables         │  │
│  │ • refresh_tokens     │  ───►   │ • Customer data              │  │
│  │ • query_requests     │ Execute │ • Analytics data             │  │
│  │ • database_instances │ Queries │ • Any PostgreSQL/MongoDB     │  │
│  │ • databases          │         │                              │  │
│  │ • audit_logs         │         │                              │  │
│  └──────────────────────┘         └──────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Portal Database (`portal_db_schema.sql`)

This is the **application's own database** that stores:

| Table | Purpose |
|-------|---------|
| `users` | User accounts, authentication, roles |
| `refresh_tokens` | JWT refresh tokens for secure sessions |
| `pods` | Team configurations for approval routing |
| `database_instances` | Registry of target database connections |
| `databases` | Available databases within each instance |
| `database_blacklist` | Patterns to exclude from sync |
| `database_sync_history` | Audit trail of sync operations |
| `query_requests` | All submitted queries/scripts and their status |
| `slack_notifications` | Notification delivery tracking |
| `audit_logs` | Complete audit trail |

### 2. Target Databases (`target_db_schema.sql`)

These are the **databases that users query** through the portal:
- Customer application databases
- Analytics databases
- Any PostgreSQL or MongoDB instance

The portal executes approved queries against these databases.

---

## Why Migration Scripts Are Required

### Problem: Schema Evolution

As the application evolves, the database schema needs to change:

1. **New Features** → New tables or columns
2. **Bug Fixes** → Schema corrections
3. **Performance** → New indexes
4. **Security** → Additional constraints

### Migration Scripts Explained

#### `Migrationscript.sql`
**Purpose:** Adds tables for the hybrid database sync feature

```sql
-- Adds these tables:
-- • database_blacklist - Exclude system databases from sync
-- • database_sync_history - Track sync operations
```

**Why needed:** The original schema didn't support automatic database discovery. This migration adds the ability to sync databases from actual instances.

#### `Migrationhybridsync.sql`
**Purpose:** Extends existing tables for hybrid sync approach

```sql
-- Adds columns to database_instances:
-- • credentials_env_prefix - Reference to env vars for credentials
-- • connection_string_env - MongoDB connection string reference
-- • last_sync_at, last_sync_status - Sync tracking

-- Adds columns to databases:
-- • source - Track if database was synced or manually added
-- • last_seen_at - Detect stale databases
```

**Why needed:** Enables the "hybrid approach" where:
- Databases are cached locally for fast dropdown loading
- Periodic sync keeps the cache up-to-date
- Manual entries are preserved during sync

#### `RefreshTokens.SQL`
**Purpose:** Adds secure session management

```sql
-- Adds refresh_tokens table for:
-- • True logout (not just client-side token deletion)
-- • "Logout everywhere" functionality
-- • Session tracking per device
```

**Why needed:** Original JWT implementation only had access tokens. Refresh tokens enable:
- Shorter access token lifetime (more secure)
- Server-side session revocation
- Multi-device session management

---

## Migration Order

Run migrations in this order on an existing database:

```bash
# 1. Base schema (if fresh install)
psql -d portal_db -f portal_db_schema.sql

# 2. Hybrid sync tables (if upgrading)
psql -d portal_db -f Migrationscript.sql

# 3. Hybrid sync columns (if upgrading)
psql -d portal_db -f Migrationhybridsync.sql

# 4. Refresh tokens (if upgrading)
psql -d portal_db -f RefreshTokens.SQL
```

**Note:** The new `portal_db_schema.sql` includes ALL migrations consolidated, so for fresh installs, only run that file.

---

## File Summary

| File | Type | When to Use |
|------|------|-------------|
| `portal_db_schema.sql` | Complete Schema | Fresh installations |
| `target_db_schema.sql` | Sample Schema | Setting up test target databases |
| `Migrationscript.sql` | Migration | Upgrading existing portal DB |
| `Migrationhybridsync.sql` | Migration | Upgrading existing portal DB |
| `RefreshTokens.SQL` | Migration | Upgrading existing portal DB |

---

## Environment Variables

The portal uses environment variables for database credentials (not stored in DB):

```bash
# Portal Database
PORTAL_DB_HOST=localhost
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=portal_db
PORTAL_DB_USER=postgres
PORTAL_DB_PASSWORD=your_password

# Target Database Instance 1 (PostgreSQL)
PG_INSTANCE_1_HOST=localhost
PG_INSTANCE_1_PORT=5432
PG_INSTANCE_1_USER=postgres
PG_INSTANCE_1_PASSWORD=your_password

# Target Database Instance 2 (MongoDB)
MONGO_INSTANCE_1_URI=mongodb://localhost:27017

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES=30m
JWT_REFRESH_EXPIRES_DAYS=7
```

---

## Best Practices

1. **Always backup before migrations**
   ```bash
   pg_dump portal_db > backup_$(date +%Y%m%d).sql
   ```

2. **Test migrations on staging first**

3. **Use transactions for safety**
   ```sql
   BEGIN;
   -- migration statements
   COMMIT;
   ```

4. **Keep migration scripts idempotent**
   - Use `IF NOT EXISTS` for CREATE
   - Use `ON CONFLICT DO NOTHING` for INSERT

5. **Document breaking changes**
   - Column type changes
   - Removed columns
   - Changed constraints
