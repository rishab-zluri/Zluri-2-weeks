# 🔧 Run Database Migrations on Railway

## Problem

Your Railway logs show:
```
relation "users" does not exist
relation "refresh_tokens" does not exist
relation "database_instances" does not exist
```

This means the database tables haven't been created yet.

## Solution - Run Migrations

### Option 1: Railway CLI (Easiest)

#### Step 1: Install Railway CLI

```bash
# macOS
brew install railway

# Or using npm
npm install -g @railway/cli
```

#### Step 2: Login to Railway

```bash
railway login
```

This will open your browser to authenticate.

#### Step 3: Link to Your Project

```bash
# Navigate to your backend directory
cd backend

# Link to your Railway project
railway link
```

Select your project from the list.

#### Step 4: Run Migrations

```bash
railway run npm run orm:migration:up
```

This will:
- Connect to your Railway PostgreSQL
- Run all pending migrations
- Create all tables

#### Step 5: Verify

Check Railway logs - you should see:
```
✅ Migration executed successfully
```

Then test your app - login should work!

---

### Option 2: Use Railway Dashboard (Alternative)

If you don't want to install the CLI:

#### Step 1: Connect to PostgreSQL

1. Go to Railway Dashboard
2. Click on your PostgreSQL service
3. Go to "Connect" tab
4. Copy the connection string

#### Step 2: Run Migrations Locally

```bash
# Set the connection string temporarily
export PORTAL_DB_URL="<paste-railway-postgres-url>"

# Navigate to backend
cd backend

# Run migrations
npm run orm:migration:up
```

---

### Option 3: Create Tables Manually (Last Resort)

If migrations don't work, you can create tables manually:

#### Step 1: Get the Schema

The complete schema is in: `backend/portal_db_schema.sql`

#### Step 2: Connect to Railway PostgreSQL

1. Railway Dashboard → PostgreSQL service
2. Click "Connect" tab
3. Use the provided connection details with a PostgreSQL client (like pgAdmin, DBeaver, or psql)

#### Step 3: Run the Schema

```bash
# Using psql
psql "<railway-postgres-url>" < backend/portal_db_schema.sql
```

Or copy the contents of `portal_db_schema.sql` and paste into Railway's Query tab.

---

## After Running Migrations

### Create an Admin User

You'll need at least one user to login. Use Railway CLI:

```bash
railway run node -e "
const { MikroORM } = require('@mikro-orm/core');
const config = require('./dist/mikro-orm.config').default;
const bcrypt = require('bcryptjs');

(async () => {
  const orm = await MikroORM.init(config);
  const em = orm.em.fork();
  
  const User = require('./dist/entities/User').User;
  
  const admin = em.create(User, {
    email: 'admin@yourdomain.com',
    passwordHash: await bcrypt.hash('Admin123!', 12),
    name: 'Admin User',
    role: 'admin',
    isActive: true
  });
  
  await em.persistAndFlush(admin);
  console.log('✅ Admin user created!');
  console.log('Email: admin@yourdomain.com');
  console.log('Password: Admin123!');
  await orm.close();
})();
"
```

Or insert directly via SQL:

```sql
INSERT INTO users (
  id, 
  email, 
  password_hash, 
  name, 
  role, 
  is_active, 
  created_at, 
  updated_at
)
VALUES (
  gen_random_uuid(),
  'admin@yourdomain.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3q', -- Password: Admin123!
  'Admin User',
  'admin',
  true,
  NOW(),
  NOW()
);
```

---

## Verification

After running migrations and creating a user:

### Test 1: Check Tables Exist

```bash
railway run psql $DATABASE_URL -c "\dt"
```

Should show all tables:
- users
- refresh_tokens
- access_token_blacklist
- database_instances
- query_requests
- etc.

### Test 2: Check User Exists

```bash
railway run psql $DATABASE_URL -c "SELECT email, role FROM users;"
```

Should show your admin user.

### Test 3: Try Login

1. Visit your frontend: `https://your-app.vercel.app`
2. Login with: `admin@yourdomain.com` / `Admin123!`
3. Should work! ✅

---

## Common Issues

### Issue: "railway: command not found"

**Fix:** Install Railway CLI:
```bash
brew install railway
# or
npm install -g @railway/cli
```

### Issue: "No project linked"

**Fix:** Link your project:
```bash
cd backend
railway link
```

### Issue: "Migration failed"

**Fix:** Check the error, might need to:
1. Drop all tables: `railway run npm run orm:schema:drop`
2. Recreate: `railway run npm run orm:schema:fresh`

⚠️ **Warning:** This will delete all data!

### Issue: "Cannot find module"

**Fix:** Build first:
```bash
npm run build
railway run npm run orm:migration:up
```

---

## Quick Command Reference

```bash
# Install Railway CLI
brew install railway

# Login
railway login

# Link project
cd backend && railway link

# Run migrations
railway run npm run orm:migration:up

# Check tables
railway run psql $DATABASE_URL -c "\dt"

# Create fresh schema (⚠️ deletes data!)
railway run npm run orm:schema:fresh

# View logs
railway logs --follow
```

---

## Next Steps

1. ✅ Run migrations
2. ✅ Create admin user
3. ✅ Test login
4. 📝 Add more users
5. 📝 Configure Slack (optional)
6. 📝 Set up monitoring

---

**Bottom Line: Run `railway run npm run orm:migration:up` to create the tables!** 🎯
