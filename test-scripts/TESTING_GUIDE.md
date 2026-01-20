# Testing Guide: Timeouts and Limits

**Purpose**: Verify that all timeouts and character limits are working correctly

---

## 📋 TEST CHECKLIST

### Script Timeouts
- [ ] Test 1: Script exceeds 30s timeout (should fail)
- [ ] Test 2: Script under 30s timeout (should succeed)
- [ ] Test 3: Python script exceeds 30s timeout (should fail)

### Query Timeouts
- [ ] Test 4: PostgreSQL query exceeds 30s timeout (should fail)
- [ ] Test 5: MongoDB query exceeds 30s timeout (should fail)

### Character Limits
- [ ] Test 6: Query under 10,000 characters (should succeed)
- [ ] Test 7: Query over 10,000 characters (should fail)
- [ ] Test 8: Comments under 1,000 characters (should succeed)
- [ ] Test 9: Comments over 1,000 characters (should fail)
- [ ] Test 10: Script file over 100KB (should fail)

### Frontend Visual Tests
- [ ] Test 11: Character counter updates in real-time
- [ ] Test 12: Character counter turns orange at 90%
- [ ] Test 13: Character counter turns red at 95%
- [ ] Test 14: Browser prevents typing beyond limit
- [ ] Test 15: Script timeout warning is visible

---

## 🧪 TEST CASES

### Test 1: Script Timeout (JavaScript) ❌ Should Fail

**File**: `test-timeout-30s.js`

**Steps**:
1. Login to the portal
2. Go to Query Submission page
3. Select "Script File" type
4. Upload `test-timeout-30s.js`
5. Fill in required fields (instance, database, POD, comments)
6. Submit request
7. Approve request (as manager/admin)
8. Wait for execution

**Expected Result**:
- ❌ Script should timeout after 30 seconds
- Error message: "Script execution timed out after 30 seconds"
- Status: Failed
- Logs should show: "Still running... 5 seconds elapsed", "Still running... 10 seconds elapsed", etc.
- Should NOT see: "Script completed at..." or "If you see this message..."

**Actual Result**: _____________

---

### Test 2: Script Success (JavaScript) ✅ Should Succeed

**File**: `test-timeout-success.js`

**Steps**:
1. Upload `test-timeout-success.js`
2. Submit and approve
3. Wait for execution

**Expected Result**:
- ✅ Script should complete successfully
- Status: Completed
- Logs should show: "Script completed successfully in 25.XX seconds"
- Should see: "✓ This script should complete without timeout"

**Actual Result**: _____________

---

### Test 3: Script Timeout (Python) ❌ Should Fail

**File**: `test-timeout-30s.py`

**Steps**:
1. Upload `test-timeout-30s.py`
2. Submit and approve
3. Wait for execution

**Expected Result**:
- ❌ Script should timeout after 30 seconds
- Error message: "Script execution timed out"
- Status: Failed

**Actual Result**: _____________

---

### Test 4: PostgreSQL Query Timeout ❌ Should Fail

**File**: `test-query-timeout.sql`

**Steps**:
1. Select "Query" type
2. Select a PostgreSQL instance
3. Copy and paste content from `test-query-timeout.sql`
4. Submit and approve
5. Wait for execution

**Expected Result**:
- ❌ Query should timeout after 30 seconds
- Error message: "Query execution timed out" or "canceling statement due to statement timeout"
- Status: Failed
- Should NOT see: "Query completed!"

**Actual Result**: _____________

---

### Test 5: MongoDB Query Timeout ❌ Should Fail

**File**: `test-mongodb-timeout.js`

**Steps**:
1. Select "Query" type
2. Select a MongoDB instance
3. Copy and paste content from `test-mongodb-timeout.js`
4. Submit and approve
5. Wait for execution

**Expected Result**:
- ❌ Query should timeout after 30 seconds
- Error message: "operation exceeded time limit"
- Status: Failed

**Actual Result**: _____________

---

### Test 6: Query Character Limit (Under) ✅ Should Succeed

**File**: `test-query-limit.sql`

**Steps**:
1. Select "Query" type
2. Copy and paste content from `test-query-limit.sql`
3. Check character counter (should show ~9,500 / 10,000)
4. Submit request

**Expected Result**:
- ✅ Query should be accepted
- Character counter shows: ~9,500 / 10,000
- Counter color: Orange (approaching limit)
- Request submitted successfully

**Actual Result**: _____________

---

### Test 7: Query Character Limit (Over) ❌ Should Fail

**Steps**:
1. Select "Query" type
2. Copy content from `test-query-limit.sql`
3. Try to add more text (paste again)
4. Browser should prevent typing beyond 10,000 characters

**Expected Result**:
- ❌ Browser prevents typing beyond 10,000 characters
- Character counter shows: 10,000 / 10,000
- Counter color: Red Bold
- Cannot submit query over limit

**Actual Result**: _____________

---

### Test 8: Comments Character Limit (Under) ✅ Should Succeed

**File**: `test-comments-limit.txt`

**Steps**:
1. Copy text from `test-comments-limit.txt` (between START/END markers)
2. Paste into Comments field
3. Check character counter (should show ~950 / 1,000)
4. Submit request

**Expected Result**:
- ✅ Comments should be accepted
- Character counter shows: ~950 / 1,000
- Counter color: Red (approaching limit)
- Request submitted successfully

**Actual Result**: _____________

---

### Test 9: Comments Character Limit (Over) ❌ Should Fail

**Steps**:
1. Copy text from `test-comments-limit.txt`
2. Try to add 100+ more characters
3. Browser should prevent typing beyond 1,000 characters

**Expected Result**:
- ❌ Browser prevents typing beyond 1,000 characters
- Character counter shows: 1,000 / 1,000
- Counter color: Red Bold
- Cannot submit comments over limit

**Actual Result**: _____________

---

### Test 10: Script File Size Limit ❌ Should Fail

**File**: Generate using `generate-large-script.js`

**Steps**:
1. Run locally: `node generate-large-script.js`
2. This creates `large-script-test.js` (~110KB)
3. Try to upload the generated file
4. Should be rejected

**Expected Result**:
- ❌ File should be rejected
- Error message: "Script content must be at most 100,000 characters (100KB)"
- File not uploaded

**Actual Result**: _____________

---

### Test 11: Character Counter Real-time Updates ✅

**Steps**:
1. Go to Query Submission page
2. Start typing in Comments field
3. Watch character counter

**Expected Result**:
- ✅ Counter updates with every keystroke
- Shows: "X / 1,000" where X increases as you type
- No lag or delay

**Actual Result**: _____________

---

### Test 12: Character Counter Orange Warning ⚠️

**Steps**:
1. Type 901+ characters in Comments field
2. Or type 9,001+ characters in Query field

**Expected Result**:
- ⚠️ Counter turns ORANGE
- Font weight: Medium
- Still allows typing

**Actual Result**: _____________

---

### Test 13: Character Counter Red Critical 🚨

**Steps**:
1. Type 951+ characters in Comments field
2. Or type 9,501+ characters in Query field

**Expected Result**:
- 🚨 Counter turns RED
- Font weight: Bold
- Still allows typing (up to limit)

**Actual Result**: _____________

---

### Test 14: Browser Prevents Over-typing ✅

**Steps**:
1. Type exactly 1,000 characters in Comments
2. Try to type more
3. Or paste text that would exceed limit

**Expected Result**:
- ✅ Browser prevents typing beyond limit
- `maxLength` attribute enforced
- Counter stays at: 1,000 / 1,000

**Actual Result**: _____________

---

### Test 15: Script Timeout Warning Visible ⚠️

**Steps**:
1. Select "Script File" type
2. Look for yellow warning box

**Expected Result**:
- ⚠️ Yellow warning box visible
- Shows:
  - "Scripts will timeout after 30 seconds"
  - "Maximum file size: 16MB"
  - "Allowed formats: .js, .py"
- Warning icon present

**Actual Result**: _____________

---

## 📊 TEST RESULTS SUMMARY

| Test # | Test Name | Expected | Actual | Pass/Fail |
|--------|-----------|----------|--------|-----------|
| 1 | Script Timeout (JS) | Fail after 30s | | |
| 2 | Script Success (JS) | Complete in 25s | | |
| 3 | Script Timeout (Python) | Fail after 30s | | |
| 4 | PostgreSQL Timeout | Fail after 30s | | |
| 5 | MongoDB Timeout | Fail after 30s | | |
| 6 | Query Under Limit | Accept | | |
| 7 | Query Over Limit | Reject | | |
| 8 | Comments Under Limit | Accept | | |
| 9 | Comments Over Limit | Reject | | |
| 10 | Large Script File | Reject | | |
| 11 | Counter Real-time | Updates | | |
| 12 | Counter Orange | At 90% | | |
| 13 | Counter Red | At 95% | | |
| 14 | Browser Prevents | At 100% | | |
| 15 | Timeout Warning | Visible | | |

---

## 🐛 ISSUES FOUND

### Issue 1: _____________
**Description**: 
**Severity**: 
**Steps to Reproduce**: 
**Expected**: 
**Actual**: 

### Issue 2: _____________
**Description**: 
**Severity**: 
**Steps to Reproduce**: 
**Expected**: 
**Actual**: 

---

## ✅ SIGN-OFF

**Tested By**: _____________  
**Date**: _____________  
**Environment**: _____________  
**Overall Status**: ⬜ Pass / ⬜ Fail  

**Notes**:
