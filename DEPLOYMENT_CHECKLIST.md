# Deployment Checklist

## Railway Backend Setup

### 1. Environment Variables (CRITICAL)

Set these in Railway dashboard → Your Service → Variables:

```bash
# Database Connection - SSL REQUIRED
PORTAL_DB_SSL=true
NODE_ENV=production

# Database credentials (from Railway PostgreSQL service)
PORTAL_DB_HOST=<from-railway-postgres>
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=railway
PORTAL_DB_USER=postgres
PORTAL_DB_PASSWORD=<from-railway-postgres>

# JWT Secrets (generate strong random strings)
JWT_SECRET=<generate-64-char-random-string>
JWT_REFRESH_SECRET=<generate-64-char-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS - Your Vercel frontend URL
CORS_ORIGIN=https://your-app.vercel.app

# API Configuration
API_BASE_URL=https://your-backend.up.railway.app
PORT=8080

# Security
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=none

# Frontend
FRONTEND_URL=https://your-app.vercel.app

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true

# Optional: Slack Integration
SLACK_ENABLED=false
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_APPROVAL_CHANNEL=C...
```

### 2. Railway PostgreSQL Plugin

- Add PostgreSQL plugin to your Railway project
- Railway will auto-populate: `DATABASE_URL`, `PGHOST`, `PGPORT`, etc.
- You can reference these in your variables

### 3. Build Configuration

Ensure your `railway.json` or Railway settings have:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && npm install && npm run build"
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Vercel Frontend Setup

### 1. Environment Variables

Set these in Vercel → Your Project → Settings → Environment Variables:

```bash
# Backend API URL (your Railway backend)
VITE_API_BASE_URL=https://your-backend.up.railway.app

# API Configuration
VITE_API_PREFIX=/api
VITE_API_VERSION=v1

# Environment
NODE_ENV=production
```

### 2. Build Configuration

Ensure your `vercel.json` has:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Post-Deployment Verification

### Backend Health Check

```bash
curl https://your-backend.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-19T...",
  "uptime": 123.45
}
```

### Frontend Check

1. Visit: `https://your-app.vercel.app`
2. Should see login page
3. Open browser console - no CORS errors
4. Try logging in

### Database Connection Check

Check Railway logs for:
```
✅ MikroORM initialized successfully
✅ Server running on port 8080
✅ Database sync scheduler started
```

❌ Should NOT see:
```
❌ connection is insecure (try using sslmode=require)
```

## Common Issues & Fixes

### Issue: SSL Connection Error

**Symptom:** `connection is insecure (try using sslmode=require)`

**Fix:** Set `PORTAL_DB_SSL=true` in Railway environment variables

### Issue: CORS Error

**Symptom:** Frontend shows CORS policy error in console

**Fix:** 
- Backend: Set `CORS_ORIGIN=https://your-app.vercel.app`
- Frontend: Set `VITE_API_BASE_URL=https://your-backend.up.railway.app`

### Issue: 401 Unauthorized

**Symptom:** All API calls return 401

**Fix:**
- Clear browser cookies
- Check JWT secrets are set in Railway
- Verify `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`

### Issue: Refresh Token Reuse

**Symptom:** `🚨 SECURITY ALERT: Refresh Token Reuse Detected!`

**Fix:**
- Clear browser cookies
- Close all tabs
- Login again
- Don't open multiple tabs during login

## Generate Strong Secrets

Use these commands to generate secure secrets:

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT Refresh Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Monitoring

### Railway Logs

```bash
# View real-time logs
railway logs --follow
```

### Vercel Logs

Check in Vercel dashboard → Your Project → Deployments → View Function Logs

## Rollback Plan

If deployment fails:

1. **Railway:** Redeploy previous version from deployments tab
2. **Vercel:** Promote previous deployment to production
3. **Database:** Restore from Railway PostgreSQL backup if needed

## Success Criteria

- [ ] Backend health check returns 200 OK
- [ ] Frontend loads without errors
- [ ] Can login successfully
- [ ] Can view databases/pods
- [ ] Can submit a query
- [ ] No SSL errors in Railway logs
- [ ] No CORS errors in browser console
