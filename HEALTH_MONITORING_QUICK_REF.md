# Health Monitoring Quick Reference

## 🚀 Quick Start

```bash
# 1. Add to .env
HEALTH_MONITORING_ENABLED=true

# 2. Start server
npm start

# 3. Test health endpoint
curl http://localhost:3000/health
```

## 📍 Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | No | Basic health check (for load balancers) |
| `GET /health/detailed` | Yes | Detailed health status |
| `POST /health/force-check` | Admin | Manual health check |

## 🔍 What's Monitored

- ✅ **Database** - Connection & latency
- ✅ **Memory** - Heap usage (alerts at >80%)
- ✅ **Resource Pool** - Script queue (alerts at >10 queued)
- ✅ **Database Sync** - Last sync time (alerts if >2h old)

## ⚙️ Configuration

```bash
# .env
HEALTH_CHECK_INTERVAL_MS=300000        # Check every 5 min
HEALTH_FAILURE_THRESHOLD=2             # Alert after 2 failures
HEALTH_ALERT_COOLDOWN_MS=1800000       # 30 min between alerts
HEALTH_ALERT_SLACK_CHANNEL=#alerts     # Slack channel
```

## 🔔 Alert Flow

```
Check 1: FAIL → Log warning
Check 2: FAIL → Send alert 🚨
Check 3: FAIL → Cooldown (no alert)
...
After 30 min: FAIL → Send alert 🚨
```

## 🔗 External Monitoring Setup

### UptimeRobot (Free)
1. URL: `https://your-app.com/health`
2. Interval: 5 minutes
3. Alert: Email/Slack

### Pingdom
1. URL: `https://your-app.com/health`
2. Check: HTTP 200
3. Interval: 5 minutes

## 📊 Check Health Status

```bash
# Basic check
curl http://localhost:3000/health

# Detailed check
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/health/detailed

# Force check (admin)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/health/force-check
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No alerts | Check `HEALTH_MONITORING_ENABLED=true` |
| False alarms | Increase `HEALTH_FAILURE_THRESHOLD` |
| Too many alerts | Increase `HEALTH_ALERT_COOLDOWN_MS` |
| Database fails | Check connection string |
| Memory fails | Restart server, check for leaks |

## 📝 Logs

```bash
# Success
[INFO] Health check passed

# Failure
[WARN] Health check failed: Database: Connection timeout

# Alert sent
[INFO] Health alert sent to Slack
```

---

**Auto-starts**: Yes (when server starts)  
**Default interval**: 5 minutes  
**Default threshold**: 2 failures  
**Default cooldown**: 30 minutes
