# 🚀 Railway Setup - Complete Guide

## Current Status

✅ SSL Error Fixed - Database connection works!  
❌ Tables Don't Exist - Need to run migrations

## What You're Seeing

```
relation "users" does not exist
relation "refresh_tokens" does not exist
relation "database_instances" does not exist
```

This is normal! Your PostgreSQL database is connected but empty.

---

## Step-by-Step Setup

### Step 1: Install Railway CLI

```bash
# macOS
brew install railway

# Or using npm
npm install -g @railway/cli
```

Verify installation:
```bash
railway --version
```

---

### Step 2: Login to Railway

```bash
railway login
```

This opens your browser to authenticate. Click "Authorize" and return to terminal.

---

### Step 3: Link Your Project

```bash
# Navigate to backend directory
cd backend

# Link to your Railway project
railway link
```

You'll see a list of your Railway projects. Select the one with your backend.

---

### Step 4: Run Migrations

```bash
railway run npm run orm:migration:up
```

You should see:
```
✅ Migration executed successfully
✅ All migrations completed
```

This creates all the database tables:
- users
- refresh_tokens
- access_token_blacklist
- query_requests
- database_instances
- pods
- audit_logs
- slack_notifications
- etc.

---

### Step 5: Create Admin User

Now create your first user so you can login:

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

**Save these credentials:**
- Email: `admin@yourdomain.com`
- Password: `Admin123!`

---

### Step 6: Verify Setup

#### Check Tables Exist:

```bash
railway run psql $DATABASE_URL -c "\dt"
```

Should show all tables.

#### Check User Exists:

```bash
railway run psql $DATABASE_URL -c "SELECT email, role, is_active FROM users;"
```

Should show your admin user.

---

### Step 7: Test Login

1. Visit your frontend: `https://your-app.vercel.app`
2. Login with:
   - Email: `admin@yourdomain.com`
   - Password: `Admin123!`
3. Should redirect to dashboard ✅

---

## Alternative: Manual SQL Setup

If Railway CLI doesn't work, you can run SQL manually:

### Connect to PostgreSQL

1. Railway Dashboard → PostgreSQL service
2. Click "Connect" tab
3. Copy the connection string

### Run Schema

```bash
# Using psql
psql "<railway-postgres-url>" < backend/portal_db_schema.sql
```

### Create Admin User

```bash
psql "<railway-postgres-url>" < CREATE_ADMIN_USER.sql
```

Or use Railway's Query tab in the dashboard.

---

## Verification Checklist

- [ ] Railway CLI installed
- [ ] Logged in to Railway
- [ ] Project linked
- [ ] Migrations run successfully
- [ ] Admin user created
- [ ] Can see tables in database
- [ ] Can login to frontend
- [ ] No errors in Railway logs

---

## Common Issues

### Issue: "railway: command not found"

**Fix:**
```bash
# macOS
brew install railway

# Or npm
npm install -g @railway/cli
```

### Issue: "No project linked"

**Fix:**
```bash
cd backend
railway link
```

Select your project from the list.

### Issue: "Cannot find module"

**Fix:** Build first:
```bash
npm run build
railway run npm run orm:migration:up
```

### Issue: "Migration already executed"

**Fix:** This is fine! Migrations are idempotent. If you need to reset:

```bash
# ⚠️ WARNING: This deletes all data!
railway run npm run orm:schema:drop
railway run npm run orm:migration:up
```

### Issue: "User already exists"

**Fix:** This is fine! Just login with existing credentials.

To reset password, connect to database and run:

```sql
UPDATE users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3q'
WHERE email = 'admin@yourdomain.com';
-- Password is now: Admin123!
```

---

## What's Next?

### Immediate:
1. ✅ Login to your app
2. ✅ Change admin password
3. ✅ Create more users

### Soon:
4. 📝 Add database instances
5. 📝 Configure Slack notifications (optional)
6. 📝 Set up custom domain
7. 📝 Enable monitoring

---

## Railway CLI Quick Reference

```bash
# Login
railway login

# Link project
railway link

# Run command in Railway environment
railway run <command>

# View logs
railway logs --follow

# Open dashboard
railway open

# Check environment variables
railway variables

# Connect to PostgreSQL
railway run psql $DATABASE_URL
```

---

## Database Management Commands

```bash
# Run migrations
railway run npm run orm:migration:up

# Create new migration
railway run npm run orm:migration:create

# Check pending migrations
railway run npm run orm:migration:pending

# Drop all tables (⚠️ deletes data!)
railway run npm run orm:schema:drop

# Create fresh schema with seed data (⚠️ deletes data!)
railway run npm run orm:schema:fresh

# Update schema without migrations
railway run npm run orm:schema:update
```

---

## Success Indicators

After completing all steps:

✅ Railway logs show:
```
MikroORM initialized successfully
Server running on port 8080
Database sync scheduler started
```

✅ No errors about missing tables

✅ Can login to frontend

✅ Dashboard loads with data

---

## Support Files

- **RUN_MIGRATIONS_NOW.md** - Detailed migration guide
- **CREATE_ADMIN_USER.sql** - SQL to create users manually
- **backend/portal_db_schema.sql** - Complete database schema
- **QUICK_FIX_REFERENCE.md** - Troubleshooting guide

---

## Summary

Your Railway setup is almost complete! Just need to:

1. **Install Railway CLI:** `brew install railway`
2. **Login:** `railway login`
3. **Link project:** `cd backend && railway link`
4. **Run migrations:** `railway run npm run orm:migration:up`
5. **Create admin user:** Use the script above
6. **Login:** Visit your frontend and login!

That's it! 🎉

---

**Next Step: Run `railway run npm run orm:migration:up` to create the tables!** 🎯
