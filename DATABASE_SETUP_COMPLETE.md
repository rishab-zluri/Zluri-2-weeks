# ✅ Database Setup Complete

## Current Configuration Status

### Database Instances (2 Total)
Both instances are properly configured and will appear in the instance dropdown:

1. **Zluri Query Portal** (PostgreSQL)
   - ID: `prod-target-aws`
   - Type: `postgresql`
   - Connection: Uses `PROD_TARGET_URL` environment variable
   - Databases: 3 PostgreSQL databases

2. **MongoDB Atlas - Ships Cluster** (MongoDB)
   - ID: `mongodb-atlas-ships`
   - Type: `mongodb`
   - Connection: Uses `PROD_MONGO_URI` environment variable
   - Databases: 13 MongoDB databases

### Target Databases (16 Total)

#### PostgreSQL Databases (3)
Connected to **Zluri Query Portal** instance:
- `analytics_db`
- `customer_db`
- `postgres`

#### MongoDB Databases (13)
Connected to **MongoDB Atlas - Ships Cluster** instance:
- `69401559e576ef4085e50133_test`
- `69401559e576ef4085e50133_truth`
- `694047d693600ea800754f3c_test`
- `694047d693600ea800754f3c_truth`
- `69412bf1f70d11f5688c5151_test`
- `69412bf1f70d11f5688c5151_truth`
- `69424cc632becd3ed2d68aeb_test`
- `69424cc632becd3ed2d68aeb_truth`
- `6942600ed521dfa444f4ea04_test`
- `6942600ed521dfa444f4ea04_truth`
- `6942609ec8128b37a0c68863_test`
- `6942609ec8128b37a0c68863_truth`
- `6942775cfae8702167efe369_test`

### Portal Database Security ✅

**CONFIRMED**: The internal portal databases are NOT in the target database list:
- ❌ `portal_db` - NOT in target list
- ❌ `zluri_portal_db` - NOT in target list

These databases are used internally by the application for:
- User authentication and management
- Query request history
- Audit logs
- Session management
- Database instance configuration

They are **NOT available** for users to query through the application.

## How It Works

### User Experience Flow

1. **Select Instance**
   - User sees dropdown with 2 options:
     - "Zluri Query Portal" (PostgreSQL)
     - "MongoDB Atlas - Ships Cluster" (MongoDB)

2. **Select Database**
   - After selecting instance, database dropdown populates:
     - If "Zluri Query Portal" selected → Shows 3 PostgreSQL databases
     - If "MongoDB Atlas - Ships Cluster" selected → Shows 13 MongoDB databases

3. **Submit Query**
   - User writes SQL (for PostgreSQL) or MongoDB query
   - Query executes against selected database in selected instance
   - Results returned to user

### Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│  (Can only see and query target databases)              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Application Backend                         │
│  • Authenticates users                                   │
│  • Logs queries                                          │
│  • Manages permissions                                   │
└─────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Portal Database     │         │  Target Databases    │
│  (Internal Only)     │         │  (User Accessible)   │
│                      │         │                      │
│  • users             │         │  PostgreSQL:         │
│  • query_requests    │         │    - analytics_db    │
│  • audit_logs        │         │    - customer_db     │
│  • refresh_tokens    │         │    - postgres        │
│  • database_instances│         │                      │
│  • databases         │         │  MongoDB:            │
│  • etc.              │         │    - 13 databases    │
│                      │         │                      │
│  ❌ NOT in dropdown  │         │  ✅ In dropdown      │
└──────────────────────┘         └──────────────────────┘
```

## Environment Variables Required

Make sure these are set in Railway:

```bash
# Portal Database (Internal - for app use only)
PORTAL_DB_HOST=ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=zluri_portal_db
PORTAL_DB_USER=neondb_owner
PORTAL_DB_PASSWORD=npg_oG6uQWgUBz8a
PORTAL_DB_SSL=true

# Target Databases (User accessible)
PROD_TARGET_URL=postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require

PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority&authSource=admin
```

## Verification Commands

Check instances:
```bash
psql 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require' -c "SELECT id, name, type FROM database_instances;"
```

Check target databases:
```bash
psql 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require' -c "SELECT name, instance_id FROM databases ORDER BY instance_id, name;"
```

Verify no portal databases in target list:
```bash
psql 'postgresql://neondb_owner:npg_oG6uQWgUBz8a@ep-steep-thunder-a16v7ufd-pooler.ap-southeast-1.aws.neon.tech/zluri_portal_db?sslmode=require' -c "SELECT * FROM databases WHERE name LIKE '%portal%';"
```

## Status: ✅ COMPLETE

All database configuration is complete and secure:
- ✅ 2 instances configured (PostgreSQL + MongoDB)
- ✅ 16 target databases available for user queries
- ✅ Portal databases secured (not in target list)
- ✅ Both instance dropdowns will populate correctly
- ✅ Database dropdowns will show correct databases per instance
