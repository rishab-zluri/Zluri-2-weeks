# Security Limits Quick Reference Card

## 🚦 Rate Limits

| What | Limit | Error Code |
|------|-------|------------|
| Scripts per user per hour | 10 | `RATE_LIMIT_EXCEEDED` |
| Queries per user per hour | 20 | `RATE_LIMIT_EXCEEDED` |
| Pending requests per user | 10 | `RATE_LIMIT_EXCEEDED` |
| Pending requests per POD | 50 | `RATE_LIMIT_EXCEEDED` |
| Concurrent executions (global) | 5 | `RATE_LIMIT_EXCEEDED` |

## 💾 Result Size Limits

| What | Limit | Action |
|------|-------|--------|
| Max result size | 10MB | Truncate + warn |
| Max display size | 1MB | Summarize |
| Max rows to store | 1000 | Truncate array |

## 🖥️ Resource Limits

| What | Limit | Action |
|------|-------|--------|
| Total memory (all scripts) | 2GB | Queue request |
| Memory per script | 512MB | Hard limit |
| Max concurrent scripts | 5 | Queue request |
| Queue timeout | 5 minutes | Error |
| Script timeout | 30 seconds | Kill process |

## ⚙️ Configuration

```bash
# .env file
RATE_LIMIT_SCRIPTS_PER_HOUR=10
RATE_LIMIT_QUERIES_PER_HOUR=20
RATE_LIMIT_PENDING_PER_USER=10
RATE_LIMIT_PENDING_PER_POD=50
RATE_LIMIT_MAX_CONCURRENT=5

MAX_RESULT_SIZE_BYTES=10485760
MAX_DISPLAY_SIZE_BYTES=1048576
MAX_ROWS_TO_STORE=1000

POOL_MAX_TOTAL_MEMORY_MB=2048
POOL_MEMORY_PER_SCRIPT_MB=512
POOL_MAX_CONCURRENT=5
POOL_QUEUE_TIMEOUT_MS=300000
```

## 📊 User Experience

### Scenario 1: Rate Limit Hit
```
User submits 11th script in an hour
→ 429 Error: "Maximum 10 script submissions per hour"
→ User waits until next hour
```

### Scenario 2: Result Too Large
```
Script returns 50MB of data
→ Result truncated to 10MB
→ Warning: "Result was truncated from 50MB to 10MB"
→ User sees summary instead of full data
```

### Scenario 3: System Busy
```
6th concurrent script submitted
→ Request queued
→ Message: "System busy, request queued"
→ Executes when slot available (up to 5 min wait)
```

### Scenario 4: Queue Timeout
```
Request queued for 5 minutes
→ Still no available slot
→ Error: "Resource acquisition timeout"
→ User retries later
```

## 🔍 Monitoring

### Check Your Rate Limits:
```bash
GET /api/users/me/rate-limits
```

### Check System Status:
```bash
# In logs:
[INFO] Resource pool status: 3/5 slots used, 2 queued
```

## ⚠️ What's Still Allowed (Warnings Only)

These operations show warnings but are NOT blocked:

- ❌ `db.collection.deleteMany({})` - Deletes ALL documents
- ❌ `db.dropDatabase()` - Drops entire database
- ❌ `DROP TABLE` - Drops table
- ❌ `TRUNCATE TABLE` - Truncates table
- ❌ `DELETE FROM table;` - Deletes all rows

**Manager must review warnings carefully before approving!**

## 📞 Support

If you hit limits frequently:
1. Check if your scripts can be optimized
2. Consider batching operations
3. Contact admin to increase limits (if justified)

---

**Last Updated**: January 20, 2026
