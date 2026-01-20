# Quick Reference: Test Scripts

**Use this as a quick lookup for testing timeouts and limits**

---

## ⏱️ TIMEOUT TESTS

### Script Timeout (Should FAIL ❌)
```bash
File: test-timeout-30s.js
Upload → Submit → Approve → Wait
Expected: Timeout after 30 seconds
```

### Script Success (Should PASS ✅)
```bash
File: test-timeout-success.js
Upload → Submit → Approve → Wait
Expected: Complete in 25 seconds
```

### Query Timeout (Should FAIL ❌)
```bash
File: test-query-timeout.sql
Copy → Paste → Submit → Approve
Expected: Timeout after 30 seconds
```

---

## 📝 CHARACTER LIMIT TESTS

### Query Limit (Should PASS ✅)
```bash
File: test-query-limit.sql
Copy → Paste into Query field
Expected: ~9,500 / 10,000 (orange counter)
```

### Comments Limit (Should PASS ✅)
```bash
File: test-comments-limit.txt
Copy text between markers → Paste into Comments
Expected: ~950 / 1,000 (red counter)
```

### Large Script (Should FAIL ❌)
```bash
Run: node generate-large-script.js
Upload: large-script-test.js
Expected: Rejected (110KB > 100KB limit)
```

---

## 🎨 VISUAL TESTS

### Character Counter Colors
```
0-90%:   Gray (normal)
90-95%:  Orange (warning)
95-100%: Red Bold (critical)
```

### Test Steps
1. Type in Comments field
2. Watch counter at bottom right
3. At 901 chars → Orange
4. At 951 chars → Red Bold
5. At 1,000 chars → Cannot type more

---

## 📊 LIMITS CHEAT SHEET

| Item | Limit | Test File |
|------|-------|-----------|
| Script Timeout | 30s | test-timeout-30s.js |
| Query Timeout | 30s | test-query-timeout.sql |
| Query Content | 10,000 | test-query-limit.sql |
| Comments | 1,000 | test-comments-limit.txt |
| Script File | 100KB | generate-large-script.js |

---

## ✅ QUICK CHECKLIST

**Timeouts**:
- [ ] Script timeout works
- [ ] Query timeout works

**Limits**:
- [ ] Query limit enforced
- [ ] Comments limit enforced
- [ ] Script file limit enforced

**UI**:
- [ ] Counter updates real-time
- [ ] Colors change correctly
- [ ] Browser prevents over-typing
- [ ] Timeout warning visible

---

## 🚀 ONE-LINER TESTS

```bash
# Test script timeout
Upload test-timeout-30s.js → Should fail after 30s

# Test query limit
Paste test-query-limit.sql → Should show ~9,500/10,000

# Test comments limit
Paste test-comments-limit.txt → Should show ~950/1,000

# Test large file
node generate-large-script.js && upload large-script-test.js → Should reject
```

---

## 🎯 EXPECTED OUTCOMES

| Test | Expected | Error Message |
|------|----------|---------------|
| Script > 30s | ❌ Fail | "Script execution timed out" |
| Query > 30s | ❌ Fail | "Query execution timed out" |
| Query > 10KB | ❌ Fail | "Query content must be at most 10,000 characters" |
| Comments > 1KB | ❌ Fail | Browser prevents typing |
| Script > 100KB | ❌ Fail | "Script content must be at most 100,000 characters" |

---

**For detailed testing**: See `TESTING_GUIDE.md`
