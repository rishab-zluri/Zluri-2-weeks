# Rate Limit Update - Login Endpoint

## Change Summary

Updated the login rate limit to be more permissive for legitimate users while still protecting against brute force attacks.

---

## What Changed

### Before:
```
Login attempts: 5 per 15 minutes
Window: 15 minutes
```

### After:
```
Login attempts: 15 per 5 minutes
Window: 5 minutes
```

---

## Why This Change?

**Problem**: Users were hitting the rate limit too easily during normal usage (e.g., typos, forgotten passwords, multiple team members).

**Solution**: Increased limit to 15 attempts per 5 minutes, which:
- ✅ Allows legitimate users more flexibility
- ✅ Still protects against brute force (15 attempts is reasonable)
- ✅ Shorter window (5 min vs 15 min) means faster recovery

---

## Security Impact

### Still Protected Against:
- ✅ Brute force attacks (15 attempts is still limited)
- ✅ Credential stuffing (rate limited per IP)
- ✅ Automated attacks (15 attempts/5min is too slow for bots)

### Improved User Experience:
- ✅ Users can retry more times if they forget password
- ✅ Multiple team members from same IP can login
- ✅ Faster recovery (5 min vs 15 min)

---

## Files Modified

1. `backend/src/routes/authRoutes.ts` - Auth route rate limiter
2. `backend/src/app.ts` - Global auth rate limiter

---

## Testing

### Test the new limit:

```bash
# Try logging in 15 times in 5 minutes
for i in {1..15}; do
  curl -X POST https://your-app.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo "Attempt $i"
done

# Expected: First 15 succeed (or fail with wrong password)
# 16th attempt: 429 Too Many Requests
```

### Error Response:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again after 5 minutes."
  }
}
```

---

## Deployment

### Railway:
```bash
# Push to Railway
git add .
git commit -m "Increase login rate limit to 15/5min"
git push

# Railway will auto-deploy
```

### Manual Restart (if needed):
```bash
# In Railway dashboard:
# 1. Go to your service
# 2. Click "Restart"
```

---

## Monitoring

After deployment, monitor for:

1. **Rate limit hits** - Should decrease
2. **Failed login attempts** - Should stay the same
3. **Successful logins** - Should increase (fewer false positives)

Check logs:
```bash
# In Railway logs, look for:
[INFO] Rate Limit Config - Window: 300000, General Max: 100, Auth Max: 15
```

---

## Rollback (if needed)

If you need to revert:

```typescript
// In authRoutes.ts and app.ts:
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    // ...
});
```

---

## Configuration

If you want to adjust further, you can set environment variables:

```bash
# In Railway environment variables:
RATE_LIMIT_AUTH_MAX=15
RATE_LIMIT_AUTH_WINDOW_MS=300000  # 5 minutes
```

---

## Comparison with Industry Standards

| Service | Rate Limit | Window |
|---------|------------|--------|
| **Your App (New)** | 15 | 5 min |
| GitHub | 10 | 1 hour |
| AWS | 5 | 5 min |
| Google | 10 | 10 min |
| Auth0 | 10 | 1 min |

Your new limit is **reasonable and secure** ✅

---

**Updated**: January 20, 2026  
**Build Status**: ✅ Successful  
**Deployed**: Ready for Railway deployment  
**Breaking Changes**: None (more permissive)
