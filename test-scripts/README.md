# Test Scripts for Timeouts and Limits

This folder contains test scripts to verify that all timeouts and character limits are working correctly in the Database Query Portal.

---

## 📁 FILES

### Timeout Tests
- **`test-timeout-30s.js`** - JavaScript script that runs for 35 seconds (should timeout)
- **`test-timeout-30s.py`** - Python script that runs for 35 seconds (should timeout)
- **`test-timeout-success.js`** - JavaScript script that runs for 25 seconds (should succeed)
- **`test-query-timeout.sql`** - PostgreSQL query that sleeps for 35 seconds (should timeout)
- **`test-mongodb-timeout.js`** - MongoDB query that sleeps for 35 seconds (should timeout)

### Character Limit Tests
- **`test-query-limit.sql`** - SQL query with ~9,500 characters (should be accepted)
- **`test-comments-limit.txt`** - Comments with ~950 characters (should be accepted)
- **`generate-large-script.js`** - Generates a 110KB script file (should be rejected)

### Documentation
- **`TESTING_GUIDE.md`** - Complete testing guide with 15 test cases and checklist

---

## 🎯 QUICK START

### 1. Test Script Timeout (30 seconds)

```bash
# Upload test-timeout-30s.js via the portal
# Expected: Script fails after 30 seconds with timeout error
```

### 2. Test Query Character Limit (10,000 characters)

```bash
# Copy test-query-limit.sql and paste into Query field
# Expected: Character counter shows ~9,500 / 10,000 (orange)
```

### 3. Test Comments Character Limit (1,000 characters)

```bash
# Copy text from test-comments-limit.txt
# Expected: Character counter shows ~950 / 1,000 (red)
```

### 4. Generate Large Script File

```bash
# Run locally to generate a file that exceeds the limit
node generate-large-script.js

# This creates large-script-test.js (~110KB)
# Try to upload it - should be rejected
```

---

## 📊 LIMITS REFERENCE

| Item | Limit | Warning | Critical | Enforced By |
|------|-------|---------|----------|-------------|
| **Script Timeout** | 30 seconds | N/A | N/A | Backend |
| **Query Timeout** | 30 seconds | N/A | N/A | Backend |
| **Query Content** | 10,000 chars | 9,000 | 9,500 | Browser + Backend |
| **Script Content** | 100,000 chars | N/A | N/A | Backend |
| **Comments** | 1,000 chars | 900 | 950 | Browser + Backend |
| **Script File Size** | 16 MB | N/A | N/A | Backend |

---

## 🧪 TEST SCENARIOS

### Scenario 1: Timeout Enforcement ⏱️

**Purpose**: Verify scripts and queries timeout after 30 seconds

**Tests**:
1. Upload `test-timeout-30s.js` → Should fail after 30s
2. Upload `test-timeout-30s.py` → Should fail after 30s
3. Submit `test-query-timeout.sql` → Should fail after 30s
4. Submit `test-mongodb-timeout.js` → Should fail after 30s

**Expected**: All should timeout with error message

---

### Scenario 2: Character Limit Enforcement 📝

**Purpose**: Verify character limits prevent oversized content

**Tests**:
1. Paste `test-query-limit.sql` → Should be accepted (~9,500 chars)
2. Try to add more text → Browser should prevent it
3. Paste `test-comments-limit.txt` → Should be accepted (~950 chars)
4. Try to add 100+ more chars → Browser should prevent it

**Expected**: Browser enforces limits, backend validates

---

### Scenario 3: Visual Feedback 🎨

**Purpose**: Verify character counters and warnings work

**Tests**:
1. Type in Comments field → Counter updates in real-time
2. Type 901+ chars → Counter turns orange
3. Type 951+ chars → Counter turns red and bold
4. Select "Script File" → Yellow timeout warning appears

**Expected**: Visual feedback helps users stay within limits

---

### Scenario 4: File Size Limit 📁

**Purpose**: Verify large files are rejected

**Tests**:
1. Run `node generate-large-script.js`
2. Try to upload `large-script-test.js` (110KB)
3. Should be rejected with error

**Expected**: Files over 100KB are rejected

---

## 🔍 WHAT TO LOOK FOR

### Success Indicators ✅
- Scripts under 30s complete successfully
- Queries under 30s return results
- Content under limits is accepted
- Character counters update in real-time
- Color coding works (gray → orange → red)
- Browser prevents over-typing

### Failure Indicators ❌
- Scripts over 30s timeout with error
- Queries over 30s timeout with error
- Content over limits is rejected
- Character counters don't update
- No color coding
- Can type beyond limits

---

## 📝 TESTING CHECKLIST

Use `TESTING_GUIDE.md` for a complete checklist with 15 test cases.

**Quick Checklist**:
- [ ] Script timeout works (30s)
- [ ] Query timeout works (30s)
- [ ] Query limit works (10,000 chars)
- [ ] Comments limit works (1,000 chars)
- [ ] Script file limit works (100KB)
- [ ] Character counters update
- [ ] Color coding works
- [ ] Browser prevents over-typing
- [ ] Timeout warning visible

---

## 🐛 TROUBLESHOOTING

### Issue: Script doesn't timeout

**Possible Causes**:
- `SCRIPT_TIMEOUT_MS` env var not set
- Timeout not enforced in script worker
- Child process not being killed

**Solution**: Check `backend/src/config/index.ts` and script worker implementation

---

### Issue: Character counter doesn't update

**Possible Causes**:
- React state not updating
- `onChange` handler not called
- Component not re-rendering

**Solution**: Check `frontend/src/pages/QuerySubmissionPage.tsx`

---

### Issue: Can type beyond limit

**Possible Causes**:
- `maxLength` attribute not set
- Browser doesn't support `maxLength`
- JavaScript overriding native behavior

**Solution**: Check textarea `maxLength` attribute

---

### Issue: Backend accepts oversized content

**Possible Causes**:
- Validation schema not applied
- Zod schema has wrong limits
- Validation middleware not used

**Solution**: Check `backend/src/validation/querySchemas.ts`

---

## 📚 RELATED DOCUMENTATION

- `CHARACTER_LIMITS_FIX.md` - Backend character limit implementation
- `FRONTEND_CHARACTER_COUNTERS.md` - Frontend UI implementation
- `LIMITS_AND_TIMEOUTS_ANALYSIS.md` - Detailed analysis of all limits

---

## 🎉 EXPECTED RESULTS

After running all tests, you should see:

**Timeouts**:
- ✅ Scripts over 30s fail with timeout error
- ✅ Queries over 30s fail with timeout error
- ✅ Scripts under 30s complete successfully

**Character Limits**:
- ✅ Content under limits is accepted
- ✅ Content over limits is rejected
- ✅ Browser prevents typing beyond limits

**Visual Feedback**:
- ✅ Character counters update in real-time
- ✅ Colors change at 90% (orange) and 95% (red)
- ✅ Timeout warning is visible for scripts

---

**Created By**: AI Assistant  
**Date**: January 20, 2026  
**Purpose**: Comprehensive testing of timeouts and limits
