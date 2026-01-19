# Railway Deployment SSL Fix

## Problem
Your backend is failing with: `connection is insecure (try using sslmode=require)`

This happens because Railway's PostgreSQL requires SSL connections, but your app isn't configured to use SSL.

## Solution

### Step 1: Update Railway Environment Variables

Go to your Railway backend service and add/update these environment variables:

```bash
# Critical - Enable SSL
PORTAL_DB_SSL=true

# Ensure production mode
NODE_ENV=production

# Your existing database variables should remain
PORTAL_DB_HOST=<your-railway-postgres-host>
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=railway
PORTAL_DB_USER=postgres
PORTAL_DB_PASSWORD=<your-password>
```

### Step 2: Alternative - Use Connection URL

If Railway provides a `DATABASE_URL`, you can use that instead:

```bash
# Option A: Use the full connection URL with SSL
PORTAL_DB_URL=postgresql://postgres:password@host:5432/railway?sslmode=require

# OR Option B: Use individual params with SSL flag
PORTAL_DB_HOST=<host>
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=railway
PORTAL_DB_USER=postgres
PORTAL_DB_PASSWORD=<password>
PORTAL_DB_SSL=true
```

### Step 3: Verify Other Required Variables

Make sure these are also set in Railway:

```bash
# JWT Secrets (use strong random values)
JWT_SECRET=<your-secret-here>
JWT_REFRESH_SECRET=<your-refresh-secret-here>

# CORS - Your Vercel frontend URL
CORS_ORIGIN=https://your-app.vercel.app

# API Base URL - Your Railway backend URL
API_BASE_URL=https://your-backend.up.railway.app

# Cookie security
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true

# Frontend URL
FRONTEND_URL=https://your-app.vercel.app
```

### Step 4: Redeploy

After setting the environment variables, Railway should automatically redeploy. If not, trigger a manual redeploy.

### Step 5: Verify

Check your Railway logs. You should see:
```
✅ MikroORM initialized successfully
✅ Server running on port 8080
✅ Database sync scheduler started
```

Without the SSL errors.

## Additional Notes

### The Fix Applied

I've updated two files to properly handle SSL:

1. **backend/src/config/index.ts** - Now checks `PORTAL_DB_SSL` environment variable
2. **backend/src/mikro-orm.config.ts** - Enhanced SSL detection logic

The SSL will be enabled when:
- `PORTAL_DB_SSL=true` is set
- `NODE_ENV=production`
- `RAILWAY_ENVIRONMENT` is detected
- Host is not localhost

### Refresh Token Reuse Issue

You also have this error:
```
🚨 SECURITY ALERT: Refresh Token Reuse Detected!
```

This is likely happening because:
1. Multiple tabs/windows are open
2. The frontend is making concurrent refresh requests
3. Network issues causing retries

**To fix:** Clear your browser cookies and login again after the SSL fix is deployed.

## Testing

After deployment:

1. Visit your frontend: `https://your-app.vercel.app`
2. Try to login
3. Check Railway logs - should see successful database connections
4. Try submitting a query

## Troubleshooting

If you still see SSL errors:

1. **Check Railway PostgreSQL settings** - Ensure SSL is required
2. **Verify environment variables** - Use Railway's dashboard to confirm `PORTAL_DB_SSL=true`
3. **Check connection string** - If using `PORTAL_DB_URL`, ensure it includes `?sslmode=require`
4. **Review logs** - Look for "MikroORM initialized successfully"

## Railway PostgreSQL Connection String Format

Railway typically provides:
```
postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

Add SSL mode:
```
postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway?sslmode=require
```

Or use the individual params approach with `PORTAL_DB_SSL=true`.
