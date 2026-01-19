# Example Scripts for Database Query Portal

This directory contains example scripts demonstrating various database operations for both PostgreSQL and MongoDB.

## 📁 Available Scripts

### PostgreSQL Scripts

#### 1. `postgres-read-only.js` ⭐ **SAFE - Start Here**
**Purpose:** Generate reports and analyze PostgreSQL data without making changes

**What it does:**
- Counts total users
- Shows status distribution
- Analyzes recent activity (last 7 days)
- Lists sample users

**Use case:** Daily/weekly reports, data analysis, monitoring

**Risk level:** 🟢 LOW (read-only)

---

#### 2. `postgres-data-cleanup.js` ⚠️ **CAUTION - Modifies Data**
**Purpose:** Archive and delete old records from PostgreSQL

**What it does:**
- Finds records older than 90 days
- Archives them to backup table
- Deletes from main table
- Uses transactions for safety

**Features:**
- DRY_RUN mode (preview without changes)
- Transaction rollback on error
- Detailed progress reporting

**Use case:** Data retention policies, cleanup old temp data

**Risk level:** 🟡 MEDIUM (deletes data, but has safeguards)

---

#### 3. `postgres-report.py` ⭐ **SAFE - Python Version**
**Purpose:** Generate detailed formatted reports using Python

**What it does:**
- Overall statistics
- Status distribution with visual bars
- Growth trends (last 7 days)
- Recent users list
- Data quality checks

**Use case:** Executive reports, data quality audits

**Risk level:** 🟢 LOW (read-only)

---

### MongoDB Scripts

#### 4. `mongodb-read-only.js` ⭐ **SAFE - Start Here**
**Purpose:** Analyze MongoDB collections without making changes

**What it does:**
- Lists all collections
- Counts documents in each
- Shows sample documents
- Database statistics

**Use case:** Understanding data structure, collection analysis

**Risk level:** 🟢 LOW (read-only)

---

#### 5. `mongodb-data-migration.js` ⚠️ **CAUTION - Modifies Data**
**Purpose:** Transform and migrate MongoDB documents

**What it does:**
- Finds documents matching criteria
- Adds/updates fields
- Processes in batches
- Provides progress updates

**Features:**
- DRY_RUN mode (preview without changes)
- Batch processing (100 docs at a time)
- Error handling per document
- Verification step

**Use case:** Schema migrations, adding default values, data transformations

**Risk level:** 🟡 MEDIUM (modifies data, but has safeguards)

---

#### 6. `mongodb-analytics.py` ⭐ **SAFE - Python Version**
**Purpose:** Deep analytics on MongoDB data using Python

**What it does:**
- Database overview with size stats
- Collection analysis
- Document structure analysis
- Index analysis
- Data quality insights

**Use case:** Performance analysis, data quality audits, capacity planning

**Risk level:** 🟢 LOW (read-only)

---

## 🚀 How to Use

### Step 1: Choose a Script
- **First time?** Start with read-only scripts (marked with ⭐)
- **Need to modify data?** Use scripts marked with ⚠️ and enable DRY_RUN first

### Step 2: Customize (Optional)
Edit the script to match your needs:

```javascript
// For cleanup scripts
const DRY_RUN = true; // Set to false when ready
const DAYS_OLD = 90; // Adjust threshold

// For migration scripts
const COLLECTION_NAME = 'your_collection'; // Change target
const BATCH_SIZE = 100; // Adjust batch size
```

### Step 3: Upload to Portal
1. Go to Query Submission page
2. Select "Script" as submission type
3. Choose your database instance
4. Choose target database
5. Upload the script file
6. Add comments explaining what you're doing
7. Submit for approval

### Step 4: Review Results
After approval and execution:
- Check the execution result in "My Queries"
- Review the console output
- Verify changes (for write operations)

---

## 📝 Script Customization Guide

### Adapting to Your Schema

All scripts assume a `users` table/collection. To adapt:

**PostgreSQL:**
```javascript
// Change table name
const result = await pool.query('SELECT COUNT(*) FROM your_table');

// Change column names
const result = await pool.query(`
    SELECT id, name, status FROM your_table
    WHERE created_date > NOW() - INTERVAL '7 days'
`);
```

**MongoDB:**
```javascript
// Change collection name
const collection = db.collection('your_collection');

// Change field names
const result = await collection.find({
    your_status_field: 'active'
}).toArray();
```

### Adding Your Own Logic

**Example: Add email validation check**
```javascript
// PostgreSQL
const invalidEmails = await pool.query(`
    SELECT email FROM users 
    WHERE email NOT LIKE '%@%.%'
`);

// MongoDB
const invalidEmails = await collection.find({
    email: { $not: /@.+\..+/ }
}).toArray();
```

---

## 🛡️ Safety Features

### All Scripts Include:

1. **Error Handling**
   - Try-catch blocks
   - Graceful error messages
   - Proper cleanup

2. **Connection Management**
   - Automatic connection from environment
   - Proper connection closing
   - Timeout handling

3. **Detailed Logging**
   - Progress indicators
   - Summary statistics
   - Error reporting

### Write Scripts Also Include:

4. **DRY_RUN Mode**
   - Preview changes before applying
   - No data modified when enabled

5. **Transactions (PostgreSQL)**
   - Rollback on error
   - Atomic operations

6. **Batch Processing (MongoDB)**
   - Prevents memory issues
   - Progress tracking
   - Per-document error handling

---

## 🎯 Common Use Cases

### Daily Reports
Use: `postgres-report.py` or `mongodb-analytics.py`
- Schedule daily via portal
- Email results to team
- Track growth metrics

### Data Cleanup
Use: `postgres-data-cleanup.js`
- Run monthly
- Archive old data
- Free up storage

### Schema Migration
Use: `mongodb-data-migration.js`
- Add new required fields
- Rename fields
- Transform data structure

### Data Quality Audit
Use: `postgres-report.py` or `mongodb-analytics.py`
- Check for missing fields
- Validate data consistency
- Find anomalies

---

## ⚠️ Important Notes

### Before Running Write Operations:

1. ✅ **Always test with DRY_RUN=true first**
2. ✅ **Backup your data** (if possible)
3. ✅ **Test on non-production first** (if available)
4. ✅ **Review the preview output carefully**
5. ✅ **Get manager approval**
6. ✅ **Run during low-traffic hours**

### Environment Variables

Scripts automatically receive:
- `DATABASE_URL` (PostgreSQL)
- `MONGODB_URI` (MongoDB)

You don't need to configure connections!

### Dependencies

All required packages are pre-installed:
- `pg` (PostgreSQL for Node.js)
- `mongodb` (MongoDB for Node.js)
- `psycopg2` (PostgreSQL for Python)
- `pymongo` (MongoDB for Python)

---

## 🐛 Troubleshooting

### "Table/Collection not found"
- Check your database selection
- Verify table/collection name in script
- Ensure you have access permissions

### "Column/Field does not exist"
- Adapt script to your schema
- Check field names match your data
- Review sample document structure

### "Connection timeout"
- Database might be slow
- Increase timeout in script
- Check database health

### "Permission denied"
- You might not have write access
- Use read-only scripts instead
- Contact admin for permissions

---

## 📚 Additional Resources

### Learning More

**PostgreSQL:**
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres Guide](https://node-postgres.com/)
- [psycopg2 Documentation](https://www.psycopg.org/docs/)

**MongoDB:**
- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)
- [PyMongo Documentation](https://pymongo.readthedocs.io/)

### Getting Help

1. Check the `QUERY_FORMAT_GUIDE.md` in the root directory
2. Review execution logs in the portal
3. Ask your manager for guidance
4. Contact the platform admin

---

## 🎓 Best Practices

1. **Start Simple**
   - Begin with read-only scripts
   - Understand your data first
   - Test queries before scripting

2. **Document Everything**
   - Add comments to your scripts
   - Explain what you're doing in submission
   - Keep a log of changes

3. **Test Thoroughly**
   - Use DRY_RUN mode
   - Test on small datasets first
   - Verify results carefully

4. **Monitor Performance**
   - Check execution time
   - Watch for slow queries
   - Optimize if needed

5. **Handle Errors Gracefully**
   - Always use try-catch
   - Log errors clearly
   - Clean up resources

---

## 📞 Support

If you need help:
- Check the portal documentation
- Review error messages carefully
- Contact your team lead
- Reach out to platform admin

Happy scripting! 🚀
