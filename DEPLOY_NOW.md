# 🚀 Deploy Now - Step by Step Guide

## Prerequisites

- [ ] Railway account created
- [ ] Vercel account created
- [ ] GitHub repository with your code
- [ ] PostgreSQL database ready (Railway provides this)

---

## Part 1: Railway Backend Deployment (15 minutes)

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Select the `main` branch

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will create a PostgreSQL instance
4. Note: Railway auto-generates connection variables

### Step 3: Configure Backend Service

1. Click on your backend service (not the database)
2. Go to "Settings" tab
3. Set **Root Directory**: `backend`
4. Set **Build Command**: `npm install && npm run build`
5. Set **Start Command**: `npm start`

### Step 4: Set Environment Variables

Click "Variables" tab and add these (copy from `RAILWAY_ENV_TEMPLATE.txt`):

#### Critical Variables (MUST SET):

```bash
# SSL Configuration (CRITICAL!)
PORTAL_DB_SSL=true
NODE_ENV=production

# Database (use Railway's auto-generated variables)
PORTAL_DB_HOST=${{Postgres.PGHOST}}
PORTAL_DB_PORT=${{Postgres.PGPORT}}
PORTAL_DB_NAME=${{Postgres.PGDATABASE}}
PORTAL_DB_USER=${{Postgres.PGUSER}}
PORTAL_DB_PASSWORD=${{Postgres.PGPASSWORD}}

# Server
PORT=8080
```

#### Generate JWT Secrets:

Open your terminal and run:

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT_REFRESH_SECRET (run again for different value)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Add to Railway:

```bash
JWT_SECRET=<paste-first-generated-secret>
JWT_REFRESH_SECRET=<paste-second-generated-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

#### CORS Configuration:

```bash
# You'll update this after deploying frontend
CORS_ORIGIN=*
```

#### Security:

```bash
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=none
```

#### Logging:

```bash
LOG_LEVEL=info
LOG_CONSOLE=true
```

### Step 5: Deploy Backend

1. Click "Deploy" or wait for auto-deploy
2. Monitor the deployment logs
3. Wait for "Build successful" and "Deployment successful"

### Step 6: Get Backend URL

1. Go to "Settings" tab
2. Find "Domains" section
3. Click "Generate Domain"
4. Copy the URL (e.g., `https://your-app.up.railway.app`)

### Step 7: Test Backend

Open in browser or use curl:

```bash
curl https://your-app.up.railway.app/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-19T...",
  "uptime": 123.45
}
```

### Step 8: Run Database Migrations

In Railway dashboard:

1. Click on your backend service
2. Go to "Settings" → "Deploy"
3. Add a "Deploy Command" (one-time):

```bash
npm run orm:migration:up
```

Or connect via Railway CLI:

```bash
railway login
railway link
railway run npm run orm:migration:up
```

### Step 9: Seed Initial Data (Optional)

If you need to seed users/data:

```bash
railway run npm run orm:schema:fresh
```

⚠️ **Warning:** This will drop and recreate all tables!

---

## Part 2: Vercel Frontend Deployment (10 minutes)

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect it's a Vite project

### Step 2: Configure Build Settings

1. **Framework Preset**: Vite
2. **Root Directory**: `frontend`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Install Command**: `npm install`

### Step 3: Set Environment Variables

Click "Environment Variables" and add:

```bash
# Your Railway backend URL (from Part 1, Step 6)
VITE_API_URL=https://your-app.up.railway.app

# Environment
NODE_ENV=production
```

### Step 4: Deploy Frontend

1. Click "Deploy"
2. Wait for build to complete
3. Vercel will provide a URL (e.g., `https://your-app.vercel.app`)

### Step 5: Update Backend CORS

Go back to Railway:

1. Open your backend service
2. Go to "Variables"
3. Update `CORS_ORIGIN`:

```bash
CORS_ORIGIN=https://your-app.vercel.app
```

4. Also add:

```bash
FRONTEND_URL=https://your-app.vercel.app
API_BASE_URL=https://your-backend.up.railway.app
```

5. Save and redeploy

---

## Part 3: Verification & Testing (5 minutes)

### Test 1: Frontend Loads

1. Visit `https://your-app.vercel.app`
2. Should see login page
3. Open browser DevTools → Console
4. Should see no CORS errors

### Test 2: Login Works

1. Try to login with test credentials
2. Should redirect to dashboard
3. Check Network tab - API calls should succeed

### Test 3: Backend Health

```bash
curl https://your-backend.up.railway.app/health
```

### Test 4: Check Railway Logs

1. Go to Railway dashboard
2. Click on backend service
3. View "Deployments" → Latest deployment → "View Logs"
4. Should see:

```
✅ MikroORM initialized successfully
✅ Server running on port 8080
✅ Database sync scheduler started
```

❌ Should NOT see:

```
❌ connection is insecure (try using sslmode=require)
```

---

## Part 4: Post-Deployment Setup

### Create Admin User

Option 1: Via Railway CLI

```bash
railway login
railway link
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
    password: await bcrypt.hash('ChangeMe123!', 12),
    role: 'admin',
    isActive: true
  });
  
  await em.persistAndFlush(admin);
  console.log('Admin user created!');
  await orm.close();
})();
"
```

Option 2: Via Database Console

Connect to Railway PostgreSQL and run:

```sql
INSERT INTO users (id, email, password, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@yourdomain.com',
  '$2a$12$...',  -- Use bcrypt to hash password
  'admin',
  true,
  NOW(),
  NOW()
);
```

### Configure Custom Domains (Optional)

#### Railway:

1. Go to Settings → Domains
2. Add custom domain: `api.yourdomain.com`
3. Update DNS records as instructed

#### Vercel:

1. Go to Settings → Domains
2. Add custom domain: `app.yourdomain.com`
3. Update DNS records as instructed

---

## Troubleshooting

### Issue: "connection is insecure"

**Solution:**

```bash
# In Railway, ensure these are set:
PORTAL_DB_SSL=true
NODE_ENV=production
```

### Issue: CORS Error

**Solution:**

```bash
# Backend (Railway):
CORS_ORIGIN=https://your-app.vercel.app

# Frontend (Vercel):
VITE_API_URL=https://your-backend.up.railway.app
```

### Issue: 401 Unauthorized

**Solution:**

1. Clear browser cookies
2. Check JWT secrets are set in Railway
3. Verify `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`

### Issue: Build Fails

**Backend:**

```bash
# Check Railway logs
# Ensure package.json has correct scripts
# Verify Node version compatibility
```

**Frontend:**

```bash
# Check Vercel build logs
# Ensure VITE_API_URL is set
# Verify all dependencies are in package.json
```

---

## Success Checklist

- [ ] Backend deployed to Railway
- [ ] PostgreSQL database created
- [ ] Backend health check returns 200 OK
- [ ] Frontend deployed to Vercel
- [ ] Frontend loads without errors
- [ ] CORS configured correctly
- [ ] Can login successfully
- [ ] Can view databases/pods
- [ ] Can submit queries
- [ ] No SSL errors in Railway logs
- [ ] No CORS errors in browser console

---

## Next Steps

1. **Set up monitoring**: Add Sentry or LogRocket
2. **Configure backups**: Enable Railway PostgreSQL backups
3. **Add custom domains**: For professional URLs
4. **Set up CI/CD**: Automate deployments on git push
5. **Enable Slack notifications**: Configure Slack integration
6. **Add more users**: Create accounts for your team

---

## Support

If you encounter issues:

1. Check Railway logs: `railway logs --follow`
2. Check Vercel logs: Vercel Dashboard → Deployments → View Logs
3. Review `DEPLOYMENT_CHECKLIST.md`
4. Review `RAILWAY_DEPLOYMENT_FIX.md`

---

## Quick Reference

### Railway CLI Commands

```bash
# Login
railway login

# Link to project
railway link

# View logs
railway logs --follow

# Run commands
railway run <command>

# Open dashboard
railway open
```

### Useful URLs

- Railway Dashboard: https://railway.app/dashboard
- Vercel Dashboard: https://vercel.com/dashboard
- Your Backend: https://your-app.up.railway.app
- Your Frontend: https://your-app.vercel.app
- Backend Health: https://your-app.up.railway.app/health
- Backend API Docs: https://your-app.up.railway.app/api-docs

---

🎉 **Congratulations!** Your app is now live in production!
