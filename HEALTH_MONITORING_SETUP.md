# Health Monitoring Setup Guide

## Overview

Your application now has **automatic health monitoring** that checks if your app is running and alerts you when issues are detected.

---

## Features

✅ **Automatic Health Checks** - Runs every 5 minutes  
✅ **Multiple Subsystem Monitoring** - Database, Memory, Resource Pool, Sync Status  
✅ **Smart Alerting** - Only alerts after multiple failures (prevents false alarms)  
✅ **Slack Notifications** - Get notified in Slack when issues occur  
✅ **Webhook Support** - Send alerts to external monitoring services  
✅ **Recovery Notifications** - Get notified when issues are resolved  
✅ **Health Endpoints** - Check health via HTTP requests  

---

## Quick Start

### 1. Enable Health Monitoring

Add to your `.env` file:

```bash
# Health Monitoring
HEALTH_MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL_MS=300000        # 5 minutes
HEALTH_FAILURE_THRESHOLD=2             # Alert after 2 failures
HEALTH_ALERT_COOLDOWN_MS=1800000       # 30 minutes between alerts
HEALTH_ALERT_SLACK_CHANNEL=#alerts     # Slack channel for alerts
```

### 2. Start Your Server

Health monitoring starts automatically when your server starts:

```bash
npm run dev
# or
npm start
```

You'll see in the logs:
```
[INFO] Health monitoring started
[INFO] Health check passed
```

### 3. Test the Health Endpoint

```bash
# Basic health check (no auth required)
curl http://localhost:3000/health

# Response:
{
  "status": "ok",
  "timestamp": "2026-01-20T12:00:00.000Z"
}
```

---

## Health Check Endpoints

### 1. Basic Health Check

**No authentication required** - Perfect for load balancers and uptime monitors

```bash
GET /health
GET /api/health
GET /api/v1/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-20T12:00:00.000Z"
}
```

### 2. Detailed Health Check

**Requires authentication** - Shows detailed status of all subsystems

```bash
GET /health/detailed
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "healthy": true,
      "timestamp": "2026-01-20T12:00:00.000Z",
      "checks": {
        "database": {
          "healthy": true,
          "latency": 15
        },
        "memory": {
          "healthy": true,
          "usage": 256,
          "limit": 512
        },
        "resourcePool": {
          "healthy": true,
          "activeExecutions": 2,
          "queuedRequests": 0
        },
        "databaseSync": {
          "healthy": true,
          "lastSyncAt": "2026-01-20T11:55:00.000Z"
        }
      },
      "errors": []
    },
    "history": {
      "consecutiveFailures": 0,
      "totalChecks": 120,
      "failedChecks": 2,
      "lastSuccessAt": "2026-01-20T12:00:00.000Z",
      "lastFailureAt": null
    }
  }
}
```

### 3. Force Health Check

**Admin only** - Manually trigger a health check

```bash
POST /health/force-check
Authorization: Bearer <admin-token>
```

---

## What Gets Monitored

### 1. Database Connectivity ✅
- **Check**: Can connect to PostgreSQL database
- **Metric**: Connection latency
- **Alert**: If connection fails

### 2. Memory Usage ✅
- **Check**: Heap memory usage
- **Metric**: Used MB / Total MB
- **Alert**: If using >80% of heap

### 3. Resource Pool ✅
- **Check**: Script execution queue
- **Metric**: Active executions, queued requests
- **Alert**: If >10 requests queued

### 4. Database Sync ✅
- **Check**: Last sync timestamp
- **Metric**: Time since last sync
- **Alert**: If no sync in >2 hours

---

## Alerting Behavior

### Smart Alerting

The system uses **smart alerting** to prevent alert fatigue:

```
Check 1: FAIL → Log warning (no alert)
Check 2: FAIL → Send alert 🚨
Check 3: FAIL → No alert (cooldown)
Check 4: FAIL → No alert (cooldown)
...
Check 10: FAIL → Send alert 🚨 (cooldown expired)
```

### Configuration

```bash
# Alert after N consecutive failures
HEALTH_FAILURE_THRESHOLD=2

# Wait N minutes before sending another alert
HEALTH_ALERT_COOLDOWN_MS=1800000  # 30 minutes
```

### Alert Channels

**1. Logs** (always enabled)
```
[WARN] Health check failed: Database: Connection timeout
```

**2. Slack** (if configured)
```
🚨 Application Health Alert

Status: ❌ Unhealthy
Uptime: 2h
Consecutive Failures: 2

Health Checks:
• Database: ❌
• Memory: ✅
• Resource Pool: ✅
• Database Sync: ✅

Errors:
• Database: Connection timeout
```

**3. Webhook** (optional)
```json
POST https://your-monitoring-service.com/webhook
{
  "status": "unhealthy",
  "timestamp": "2026-01-20T12:00:00.000Z",
  "checks": {...},
  "errors": [...]
}
```

---

## Integration with External Monitoring

### UptimeRobot

1. Create a new monitor
2. Monitor Type: **HTTP(s)**
3. URL: `https://your-app.com/health`
4. Monitoring Interval: **5 minutes**
5. Alert Contacts: Your email/Slack

### Pingdom

1. Add New Check
2. Check Type: **HTTP**
3. URL: `https://your-app.com/health`
4. Check Interval: **5 minutes**
5. Alert When: Response code is not 200

### Better Uptime

1. Create Monitor
2. URL: `https://your-app.com/health`
3. Check Frequency: **5 minutes**
4. Expected Status Code: **200**

### Custom Webhook

Set environment variable:
```bash
HEALTH_ALERT_WEBHOOK_URL=https://your-service.com/webhook
```

The webhook will receive:
```json
{
  "status": "unhealthy",
  "timestamp": "2026-01-20T12:00:00.000Z",
  "checks": {
    "database": { "healthy": false, "error": "..." },
    "memory": { "healthy": true, "usage": 256, "limit": 512 },
    "resourcePool": { "healthy": true, ... },
    "databaseSync": { "healthy": true, ... }
  },
  "errors": ["Database: Connection timeout"],
  "stats": {
    "consecutiveFailures": 2,
    "totalChecks": 120,
    "failedChecks": 2
  }
}
```

---

## Configuration Reference

### Environment Variables

```bash
# Enable/disable monitoring
HEALTH_MONITORING_ENABLED=true

# How often to check (milliseconds)
HEALTH_CHECK_INTERVAL_MS=300000        # 5 minutes

# Alert after N failures
HEALTH_FAILURE_THRESHOLD=2

# Cooldown between alerts (milliseconds)
HEALTH_ALERT_COOLDOWN_MS=1800000       # 30 minutes

# Slack channel for alerts
HEALTH_ALERT_SLACK_CHANNEL=#alerts

# Optional webhook URL
HEALTH_ALERT_WEBHOOK_URL=https://...
```

### Recommended Settings

**Development:**
```bash
HEALTH_CHECK_INTERVAL_MS=60000         # 1 minute
HEALTH_FAILURE_THRESHOLD=1             # Alert immediately
HEALTH_ALERT_COOLDOWN_MS=300000        # 5 minutes
```

**Production:**
```bash
HEALTH_CHECK_INTERVAL_MS=300000        # 5 minutes
HEALTH_FAILURE_THRESHOLD=2             # Alert after 2 failures
HEALTH_ALERT_COOLDOWN_MS=1800000       # 30 minutes
```

---

## Troubleshooting

### Health Checks Failing

**Database Check Failing:**
```
Error: Database: Connection timeout
```
**Solution**: Check database connection string, ensure database is running

**Memory Check Failing:**
```
Error: Memory: 450MB / 512MB (>80%)
```
**Solution**: Restart server, investigate memory leaks, increase memory limit

**Resource Pool Check Failing:**
```
Error: Resource Pool: 15 requests queued
```
**Solution**: System is overloaded, wait for queue to clear or increase resources

**Database Sync Check Failing:**
```
Error: Database Sync: Stale
```
**Solution**: Check sync service logs, restart sync service

### Not Receiving Alerts

**Check 1: Is monitoring enabled?**
```bash
# In logs:
[INFO] Health monitoring started
```

**Check 2: Is Slack configured?**
```bash
# Check .env:
SLACK_BOT_TOKEN=xoxb-...
SLACK_APPROVAL_CHANNEL=#approvals
```

**Check 3: Check failure threshold**
```bash
# Need at least 2 failures (default)
HEALTH_FAILURE_THRESHOLD=2
```

**Check 4: Check cooldown**
```bash
# May be in cooldown period
HEALTH_ALERT_COOLDOWN_MS=1800000  # 30 min
```

---

## Monitoring Dashboard (Optional)

Create a simple dashboard to visualize health:

```bash
# Get current health status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/health/detailed

# Parse with jq
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/health/detailed | \
  jq '.data.current.checks'
```

---

## Best Practices

### 1. Set Up External Monitoring

Don't rely only on internal monitoring. Use external services like:
- UptimeRobot (free)
- Pingdom
- Better Uptime
- StatusCake

### 2. Configure Slack Alerts

Get notified immediately when issues occur:
```bash
HEALTH_ALERT_SLACK_CHANNEL=#alerts
```

### 3. Monitor the Monitors

Set up alerts for:
- Health check endpoint down
- No health checks in >1 hour
- High failure rate

### 4. Regular Testing

Test your monitoring:
```bash
# Force a health check
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/health/force-check
```

### 5. Review Health History

Check health history regularly:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/health/detailed | \
  jq '.data.history'
```

---

## Files Created

1. `backend/src/services/healthMonitor.ts` - Health monitoring service
2. `backend/src/routes/healthRoutes.ts` - Health check endpoints
3. `backend/src/server.ts` - Integrated health monitoring startup

---

## Next Steps

1. ✅ Add health endpoint to your load balancer
2. ✅ Set up external monitoring (UptimeRobot, etc.)
3. ✅ Configure Slack alerts
4. ✅ Test the health endpoints
5. ✅ Monitor the logs for health check results

---

**Implemented**: January 20, 2026  
**Build Status**: ✅ Successful  
**Auto-starts**: Yes (when server starts)
