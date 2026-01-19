# Add MongoDB Environment Variable

## Quick Copy-Paste

Add this to Railway:

```bash
PROD_MONGO_URI=mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority
```

## How to Add

### Railway Dashboard:
1. Go to https://railway.app/dashboard
2. Click your backend service
3. Click "Variables" tab
4. Click "+ New Variable"
5. Paste:
   - **Name:** `PROD_MONGO_URI`
   - **Value:** `mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority`
6. Click "Add"

### Railway CLI:
```bash
railway variables set PROD_MONGO_URI="mongodb+srv://rishab1:123%40Acharjee@ships.gwsbr.mongodb.net/?retryWrites=true&w=majority"
```

## After Adding

1. Railway will auto-redeploy (30-60 seconds)
2. Check logs: `railway logs --follow`
3. Refresh your frontend
4. MongoDB Atlas should appear in the dropdown!

## MongoDB Atlas Network Access

**IMPORTANT:** Allow Railway to connect:

1. Go to https://cloud.mongodb.com
2. Click "Network Access" (left sidebar)
3. Click "Add IP Address"
4. Select "Allow Access from Anywhere"
5. Or add: `0.0.0.0/0`
6. Click "Confirm"

## Verify It's Working

### Check Railway Logs:
```bash
railway logs --follow
```

Look for:
```
✅ Synced databases for instance: mongodb-atlas-ships
```

### Check Your App:
1. Login to frontend
2. Go to query submission
3. Select instance dropdown
4. You should see: "MongoDB Atlas - Ships Cluster"

## Troubleshooting

### Not showing up?
- Wait 60 seconds for redeploy
- Check `railway variables` to confirm it's set
- Check Railway logs for MongoDB errors

### Connection errors?
- Verify MongoDB Atlas Network Access allows 0.0.0.0/0
- Check username: `rishab1`
- Check password: `123@Acharjee`
- Verify user has database permissions

## Done!

Once added, you'll have both:
- ✅ Zluri Query Portal (PostgreSQL)
- ✅ MongoDB Atlas - Ships Cluster (MongoDB)
