# Limits and Timeouts Analysis

**Date**: January 20, 2026  
**Status**: ⚠️ NEEDS IMPROVEMENT

---

## 🔍 CURRENT STATE

### Script Timeouts ✅
**Status**: WORKING

- **Timeout**: 30 seconds (30,000ms)
- **Configurable**: Yes, via `SCRIPT_TIMEOUT_MS` env var
- **Location**: `backend/src/config/index.ts`
- **Applied**: Yes, enforced in script execution

```typescript
scriptExecution: {
    timeoutMs: parseInt(process.env.SCRIPT_TIMEOUT_MS || '', 10) || 30000,
    memoryLimitMb: parseInt(process.env.SCRIPT_MEMORY_LIMIT_MB || '', 10) || 128,
    maxConcurrent: parseInt(process.env.SCRIPT_MAX_CONCURRENT || '', 10) || 5,
}
```

---

### Query Content Limits ⚠️
**Status**: VALIDATION EXISTS BUT COULD BE STRICTER

**Current Limits** (from `backend/src/validation/querySchemas.ts`):
- **Query Content**: 50KB (50,000 characters)
- **Script Content**: 500KB (500,000 characters)
- **Comments**: 1,000 characters
- **Rejection Reason**: 500 characters

**Database Schema** (from `backend/portal_db_schema.sql`):
- **query_content**: TEXT (unlimited in PostgreSQL)
- **script_content**: TEXT (unlimited in PostgreSQL)
- **comments**: TEXT (unlimited in PostgreSQL)

**Issue**: Database allows unlimited size, but validation limits it. This is GOOD, but limits could be more reasonable.

---

## 📊 DETAILED ANALYSIS

### 1. Query Content (50KB)

**Current**: 50,000 characters

**Analysis**:
- ✅ Prevents DoS attacks
- ✅ Reasonable for most SQL queries
- ⚠️ Might be too large for typical queries

**Typical Query Sizes**:
- Simple SELECT: 100-500 characters
- Complex JOIN: 1,000-2,000 characters
- Large INSERT: 5,000-10,000 characters
- **50KB is excessive** for most use cases

**Recommendation**: Reduce to **10KB (10,000 characters)**
- Still allows complex queries
- Prevents abuse
- More reasonable limit

---

### 2. Script Content (500KB)

**Current**: 500,000 characters

**Analysis**:
- ✅ Allows reasonable script sizes
- ⚠️ Very large for typical scripts
- ⚠️ Could allow malicious large uploads

**Typical Script Sizes**:
- Simple script: 500-2,000 characters
- Medium script: 5,000-10,000 characters
- Large script: 20,000-50,000 characters
- **500KB is excessive**

**Recommendation**: Reduce to **100KB (100,000 characters)**
- Still allows large scripts
- Prevents abuse
- More reasonable limit

---

### 3. Comments (1,000 characters)

**Current**: 1,000 characters

**Analysis**:
- ✅ Reasonable for most comments
- ✅ Prevents abuse
- ✅ Good limit

**Typical Comment Sizes**:
- Short comment: 50-100 characters
- Medium comment: 200-500 characters
- Long comment: 500-1,000 characters

**Recommendation**: **Keep at 1,000 characters** ✅

---

### 4. Rejection Reason (500 characters)

**Current**: 500 characters

**Analysis**:
- ✅ Reasonable for rejection reasons
- ✅ Prevents abuse
- ✅ Good limit

**Recommendation**: **Keep at 500 characters** ✅

---

## 🚨 POTENTIAL ISSUES

### Issue 1: Database Can Accept Unlimited Size
**Problem**: Database schema uses TEXT type (unlimited)
**Risk**: If validation is bypassed, database could accept huge content
**Mitigation**: Validation layer prevents this, but database should have constraints too

### Issue 2: No Frontend Character Counter
**Problem**: Users don't see how many characters they've used
**Risk**: Users might hit limit unexpectedly
**Mitigation**: Add character counter in frontend

### Issue 3: Script Timeout Not Visible to Users
**Problem**: Users don't know scripts will timeout after 30 seconds
**Risk**: Users might submit long-running scripts
**Mitigation**: Show timeout warning in frontend

---

## ✅ WHAT'S WORKING WELL

### Script Execution Timeouts ✅
```typescript
// From backend/src/config/index.ts
scriptExecution: {
    timeoutMs: 30000, // 30 seconds
    memoryLimitMb: 128, // 128MB
    maxConcurrent: 5, // Max 5 concurrent scripts
}
```

**Enforced in**:
- Script worker processes
- Child process timeout
- Database connection timeout

### Query Execution Timeouts ✅
```typescript
// PostgreSQL
targetDb: {
    postgres: {
        connectionTimeoutMs: 10000, // 10 seconds
        queryTimeoutMs: 30000, // 30 seconds
    },
    mongodb: {
        connectionTimeoutMs: 10000, // 10 seconds
        serverSelectionTimeoutMs: 5000, // 5 seconds
    },
}
```

**Enforced in**:
- PostgreSQL: `statement_timeout` parameter
- MongoDB: `maxTimeMS` parameter (recently added)

---

## 📝 RECOMMENDED CHANGES

### 1. Reduce Query Content Limit
**From**: 50KB (50,000 characters)  
**To**: 10KB (10,000 characters)

**Reason**: More reasonable for typical queries, still allows complex queries

### 2. Reduce Script Content Limit
**From**: 500KB (500,000 characters)  
**To**: 100KB (100,000 characters)

**Reason**: More reasonable for typical scripts, prevents abuse

### 3. Add Character Counters in Frontend
**Location**: Query submission form, script upload form, comments field

**Example**:
```
Comments (245 / 1000 characters)
```

### 4. Show Timeout Warnings in Frontend
**Location**: Script submission form

**Example**:
```
⚠️ Scripts will timeout after 30 seconds
```

### 5. Add Database Constraints (Optional)
**Location**: `backend/portal_db_schema.sql`

**Example**:
```sql
-- Add check constraint for query content length
ALTER TABLE query_requests 
ADD CONSTRAINT query_content_length_check 
CHECK (length(query_content) <= 10000);

-- Add check constraint for script content length
ALTER TABLE query_requests 
ADD CONSTRAINT script_content_length_check 
CHECK (length(script_content) <= 100000);

-- Add check constraint for comments length
ALTER TABLE query_requests 
ADD CONSTRAINT comments_length_check 
CHECK (length(comments) <= 1000);
```

---

## 🎯 IMPLEMENTATION PLAN

### Phase 1: Backend Validation (Immediate)
1. ✅ Update `querySchemas.ts` with new limits
2. ✅ Rebuild backend
3. ✅ Test with large queries/scripts

### Phase 2: Frontend UI (Next)
1. Add character counters to all text fields
2. Add timeout warnings
3. Add visual feedback when approaching limits

### Phase 3: Database Constraints (Optional)
1. Add check constraints to database
2. Test constraint enforcement
3. Update migration scripts

---

## 🧪 TESTING RECOMMENDATIONS

### Test Case 1: Query Content Limit
```sql
-- Generate 10,001 character query (should fail)
SELECT * FROM users WHERE id IN (
    -- 10,001 characters of IDs
);
```

### Test Case 2: Script Content Limit
```javascript
// Generate 100,001 character script (should fail)
const data = "x".repeat(100001);
```

### Test Case 3: Comments Limit
```
Submit request with 1,001 character comment (should fail)
```

### Test Case 4: Script Timeout
```javascript
// Script that runs for 31 seconds (should timeout)
const start = Date.now();
while (Date.now() - start < 31000) {
    // Busy wait
}
```

---

## 📊 COMPARISON WITH INDUSTRY STANDARDS

### GitHub
- **File size limit**: 100MB
- **Gist size limit**: 10MB per file
- **Comment limit**: 65,536 characters

### GitLab
- **File size limit**: 100MB
- **Comment limit**: 1,000,000 characters

### Our Limits (Proposed)
- **Query content**: 10KB (10,000 characters)
- **Script content**: 100KB (100,000 characters)
- **Comments**: 1KB (1,000 characters)
- **Script timeout**: 30 seconds

**Conclusion**: Our limits are more conservative, which is appropriate for a database query portal.

---

## 🎉 SUMMARY

### Current State
- ✅ Script timeouts: WORKING (30 seconds)
- ✅ Query timeouts: WORKING (30 seconds)
- ⚠️ Content limits: TOO GENEROUS (50KB query, 500KB script)
- ⚠️ No frontend feedback: Users don't see limits

### Recommended Changes
1. Reduce query content limit: 50KB → 10KB
2. Reduce script content limit: 500KB → 100KB
3. Add character counters in frontend
4. Add timeout warnings in frontend
5. (Optional) Add database constraints

### Priority
- **High**: Reduce content limits (prevents abuse)
- **Medium**: Add frontend feedback (improves UX)
- **Low**: Add database constraints (defense in depth)

---

**Prepared By**: AI Assistant  
**Date**: January 20, 2026
