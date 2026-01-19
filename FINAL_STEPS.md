# Final Steps to Enable MongoDB

## Step 1: Run SQL on Neon Database

```bash
psql "your-neon-connection-string" -f FINAL_MONGODB_SETUP.sql
```

Or copy/paste the SQL from `FINAL_MONGODB_SETUP.sql` into Neon dashboard SQL editor.

## Step 2: Set Railway Environment Variable

Go to Railway → Backend Service → Variables

**Add or update:**
```
PROD_MONGO_URI=mongodb+srv://rishab3:123rishabacharjee@ships.gwsbr.mongodb.net/
```

## Step 3: Commit and Push to Restart Railway

```bash
git add .
git commit -m "Enable MongoDB support"
git push
```

## Step 4: Verify in Railway Logs

After deployment, check Railway logs for:

```
✅ [info]: Fetched databases from instance {"instanceId":"mongodb-atlas-ships","total":13}
✅ [info]: Database sync completed for instance {"instanceId":"mongodb-atlas-ships","success":true}
```

## Step 5: Test in Frontend

1. Go to your frontend
2. Click "Submit Query"
3. Select "MongoDB Atlas - Ships Cluster" from Instance dropdown
4. Select "als_database" from Database dropdown
5. Enter a MongoDB query:
   ```javascript
   db.ships.find({}).limit(10)
   ```
6. Submit and approve the request
7. Should execute successfully!

---

## What the Code Already Does

The application automatically:
- ✅ Reads `PROD_MONGO_URI` from Railway environment
- ✅ Connects to MongoDB Atlas
- ✅ Lists all databases
- ✅ Executes MongoDB queries
- ✅ Supports both JavaScript and Python scripts
- ✅ Handles authentication
- ✅ Manages connection pooling

**No code changes needed!** Just run the SQL and set the environment variable.

---

## Troubleshooting

### If MongoDB still doesn't work:

1. **Check Railway logs** for connection errors
2. **Verify Railway variable** is set correctly (no typos, no extra spaces)
3. **Check MongoDB Atlas IP whitelist** has `0.0.0.0/0`
4. **Verify database instance exists**:
   ```sql
   SELECT * FROM database_instances WHERE id = 'mongodb-atlas-ships';
   ```

### If login still fails:

Check if users exist:
```sql
SELECT email, role FROM users;
```

If no users, you need to seed the database or create users via the application's seed script.

---

## Summary

1. ✅ Run `FINAL_MONGODB_SETUP.sql` on Neon
2. ✅ Set `PROD_MONGO_URI` in Railway
3. ✅ Push code to restart Railway
4. ✅ Test MongoDB queries in frontend

That's it! MongoDB will work.
