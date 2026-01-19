# 🔧 Quick Fix Reference

## The SSL Error You're Seeing

```
connection is insecure (try using `sslmode=require`)
```

## Immediate Fix (2 minutes)

### In Railway Dashboard:

1. Go to your backend service
2. Click "Variables" tab
3. Add this variable:

```
PORTAL_DB_SSL=true
```

4. Verify this exists:

```
NODE_ENV=production
```

5. Save (auto-redeploys)

### That's it! ✅

The error will disappear after redeployment.

---

## Why This Happens

Railway's PostgreSQL **requires SSL connections** for security. Your app wasn't configured to use SSL, so the database rejected the connection.

The code changes I made enable SSL when:
- `PORTAL_DB_SSL=true` is set
- `NODE_ENV=production`
- Running on Railway (detects `RAILWAY_ENVIRONMENT`)
- Host is not localhost

---

## Other Common Errors & Fixes

### Error: relation "users" does not exist

**Symptom:** `relation "users" does not exist` or similar for other tables

**Fix:**

You need to run database migrations to create the tables.

```bash
# Install Railway CLI
brew install railway

# Login and link
railway login
cd backend
railway link

# Run migrations
railway run npm run orm:migration:up
```

**Alternative:** See `RUN_MIGRATIONS_NOW.md` for detailed instructions.

---

### Error: CORS Policy Blocked

**Symptom:** Browser console shows CORS error

**Fix:**

```bash
# Railway Backend:
CORS_ORIGIN=https://your-app.vercel.app

# Vercel Frontend:
VITE_API_URL=https://your-backend.up.railway.app
```

---

### Error: 401 Unauthorized on All Requests

**Symptom:** Can't login, all API calls fail with 401

**Fix:**

1. Check JWT secrets are set in Railway:

```bash
JWT_SECRET=<64-char-hex-string>
JWT_REFRESH_SECRET=<different-64-char-hex-string>
```

2. Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

3. Set cookie config:

```bash
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=none
```

---

### Error: Refresh Token Reuse Detected

**Symptom:** `🚨 SECURITY ALERT: Refresh Token Reuse Detected!`

**Fix:**

1. Clear browser cookies
2. Close all tabs
3. Login again
4. Don't open multiple tabs during login

---

### Error: Build Failed

**Backend Build Fails:**

```bash
# Check these in Railway:
- Root Directory: backend
- Build Command: npm install && npm run build
- Start Command: npm start
```

**Frontend Build Fails:**

```bash
# Check these in Vercel:
- Root Directory: frontend
- Build Command: npm run build
- Output Directory: dist
- Framework: Vite
```

---

### Error: Cannot Connect to Database

**Symptom:** `ECONNREFUSED` or timeout errors

**Fix:**

Check Railway database variables:

```bash
PORTAL_DB_HOST=${{Postgres.PGHOST}}
PORTAL_DB_PORT=${{Postgres.PGPORT}}
PORTAL_DB_NAME=${{Postgres.PGDATABASE}}
PORTAL_DB_USER=${{Postgres.PGUSER}}
PORTAL_DB_PASSWORD=${{Postgres.PGPASSWORD}}
PORTAL_DB_SSL=true
```

---

### Error: MikroORM Initialization Failed

**Symptom:** `MikroORM failed to initialize`

**Fix:**

1. Ensure database exists
2. Run migrations:

```bash
railway run npm run orm:migration:up
```

3. Check connection variables are correct

---

## Environment Variables Checklist

### Railway Backend (Minimum Required):

```bash
✅ PORTAL_DB_SSL=true
✅ NODE_ENV=production
✅ PORTAL_DB_HOST=<from-railway>
✅ PORTAL_DB_PORT=5432
✅ PORTAL_DB_NAME=<from-railway>
✅ PORTAL_DB_USER=<from-railway>
✅ PORTAL_DB_PASSWORD=<from-railway>
✅ JWT_SECRET=<64-char-hex>
✅ JWT_REFRESH_SECRET=<64-char-hex>
✅ CORS_ORIGIN=https://your-app.vercel.app
✅ COOKIE_SECURE=true
✅ COOKIE_HTTP_ONLY=true
✅ COOKIE_SAME_SITE=none
```

### Vercel Frontend (Minimum Required):

```bash
✅ VITE_API_URL=https://your-backend.up.railway.app
✅ NODE_ENV=production
```

---

## Testing Commands

### Test Backend Health:

```bash
curl https://your-backend.up.railway.app/health
```

Expected:

```json
{"status":"ok","timestamp":"...","uptime":123}
```

### Test Backend API:

```bash
curl https://your-backend.up.railway.app/api/v1/health
```

### View Railway Logs:

```bash
railway logs --follow
```

### View Vercel Logs:

Go to: Vercel Dashboard → Your Project → Deployments → View Logs

---

## Quick Links

- **Railway Dashboard**: https://railway.app/dashboard
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Generate Secrets**: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## Files to Reference

1. **DEPLOY_NOW.md** - Complete deployment guide
2. **DEPLOYMENT_CHECKLIST.md** - Verification checklist
3. **RAILWAY_DEPLOYMENT_FIX.md** - Detailed SSL fix explanation
4. **RAILWAY_ENV_TEMPLATE.txt** - All Railway environment variables
5. **VERCEL_ENV_TEMPLATE.txt** - All Vercel environment variables

---

## Still Having Issues?

1. Check Railway logs for specific errors
2. Check Vercel logs for build/runtime errors
3. Check browser console for frontend errors
4. Verify all environment variables are set
5. Try clearing browser cache and cookies
6. Redeploy both backend and frontend

---

## Success Indicators

✅ Railway logs show: `MikroORM initialized successfully`
✅ Railway logs show: `Server running on port 8080`
✅ No SSL errors in logs
✅ Backend health check returns 200
✅ Frontend loads without errors
✅ Can login successfully
✅ No CORS errors in browser console

---

**Remember:** The main fix for your current issue is just adding `PORTAL_DB_SSL=true` to Railway! 🎯
