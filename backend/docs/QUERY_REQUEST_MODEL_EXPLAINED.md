# QueryRequest Model - Detailed Explanation

This document explains every function in `src/models/QueryRequest.js` line by line.

---

## Table of Contents
1. [Enums (Constants)](#enums-constants)
2. [createTable()](#createtable)
3. [create()](#create)
4. [findById() & findByUuid()](#findbyid--findbyuuid)
5. [findByUserId()](#findbyuserid)
6. [findByPodIds()](#findbypodids)
7. [findAll()](#findall)
8. [count()](#count)
9. [updateStatus()](#updatestatus)
10. [Status Helper Functions](#status-helper-functions)
11. [Statistics Functions](#statistics-functions)
12. [mapRequestRow()](#maprequestrow)

---

## Enums (Constants)

```javascript
const RequestStatus = {
  PENDING: 'pending',      // Just submitted, waiting for approval
  APPROVED: 'approved',    // Manager approved, ready to execute
  REJECTED: 'rejected',    // Manager denied the request
  EXECUTING: 'executing',  // Currently running the query/script
  COMPLETED: 'completed',  // Finished successfully
  FAILED: 'failed',        // Execution error occurred
};
```

**Why enums?**
- Prevents typos (`'pendng'` vs `'pending'`)
- IDE autocomplete support
- Single source of truth for valid values
- Easy to add new statuses later

**State Machine:**
```
                    ┌──────────┐
                    │ PENDING  │
                    └────┬─────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             │             ▼
    ┌──────────┐         │      ┌──────────┐
    │ APPROVED │         │      │ REJECTED │
    └────┬─────┘         │      └──────────┘
         │               │
         ▼               │
    ┌──────────┐         │
    │EXECUTING │         │
    └────┬─────┘         │
         │               │
    ┌────┴────┐          │
    ▼         ▼          │
┌────────┐ ┌──────┐      │
│COMPLETED│ │FAILED│      │
└────────┘ └──────┘      │
```

---

## createTable()

**Purpose:** Creates the database table if it doesn't exist (used on app startup)

```javascript
const createTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS query_requests (

      -- Primary key: auto-incrementing integer
      id SERIAL PRIMARY KEY,
      
      -- UUID: for public-facing URLs (prevents enumeration attacks)
      uuid UUID UNIQUE DEFAULT gen_random_uuid(),
      
      -- Who submitted this request
      user_id UUID NOT NULL REFERENCES users(id),
      
      -- Target database info
      database_type VARCHAR(50) NOT NULL,    -- 'postgresql' or 'mongodb'
      instance_id VARCHAR(100) NOT NULL,     -- e.g., 'database-1'
      instance_name VARCHAR(255) NOT NULL,   -- e.g., 'Production DB'
      database_name VARCHAR(255) NOT NULL,   -- e.g., 'users_db'
      
      -- What type of submission
      submission_type VARCHAR(50) NOT NULL,  -- 'query' or 'script'
      query_content TEXT,                    -- SQL/MongoDB query (if type=query)
      script_filename VARCHAR(255),          -- Original filename (if type=script)
      script_content TEXT,                   -- Script code (if type=script)
      
      -- Request metadata
      comments TEXT NOT NULL,                -- Why user needs this
      pod_id VARCHAR(50) NOT NULL,           -- Which team/POD
      pod_name VARCHAR(100) NOT NULL,        -- POD display name
      
      -- Status tracking
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      
      -- Approval info
      approver_id UUID REFERENCES users(id), -- Who approved/rejected
      approver_email VARCHAR(255),
      approved_at TIMESTAMP WITH TIME ZONE,
      rejection_reason TEXT,
      
      -- Execution results
      execution_result TEXT,                 -- JSON result from execution
      execution_error TEXT,                  -- Error message if failed
      execution_started_at TIMESTAMP WITH TIME ZONE,
      execution_completed_at TIMESTAMP WITH TIME ZONE,
      
      -- Timestamps
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
```

**Indexes created:**
```javascript
    // Speed up queries by user
    CREATE INDEX idx_query_requests_user_id ON query_requests(user_id);
    
    // Speed up filtering by status (pending, completed, etc.)
    CREATE INDEX idx_query_requests_status ON query_requests(status);
    
    // Speed up manager queries (find requests for their PODs)
    CREATE INDEX idx_query_requests_pod_id ON query_requests(pod_id);
    
    // Speed up sorting by date (most recent first)
    CREATE INDEX idx_query_requests_created_at ON query_requests(created_at DESC);
    
    // Speed up UUID lookups (for API endpoints)
    CREATE INDEX idx_query_requests_uuid ON query_requests(uuid);
```

**Why these indexes?**
- Without indexes, PostgreSQL scans entire table (slow for large tables)
- Indexes are like a book's index - jump directly to relevant rows
- We index columns used in WHERE clauses and ORDER BY

---

## create()

**Purpose:** Insert a new query request into the database

```javascript
const create = async ({
  userId,           // Who is submitting
  databaseType,     // 'postgresql' or 'mongodb'
  instanceId,       // Which database instance
  instanceName,     // Display name
  databaseName,     // Target database
  submissionType,   // 'query' or 'script'
  queryContent = null,     // SQL/MongoDB query (optional)
  scriptFilename = null,   // Script filename (optional)
  scriptContent = null,    // Script code (optional)
  comments,         // Why they need this
  podId,            // Team/POD ID
  podName,          // Team/POD name
}) => {
```

**The SQL:**
```javascript
  const sql = `
    INSERT INTO query_requests (
      user_id, database_type, instance_id, instance_name, database_name,
      submission_type, query_content, script_filename, script_content,
      comments, pod_id, pod_name
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;
```

**Line by line:**
- `INSERT INTO query_requests (...)` - Which columns to fill
- `VALUES ($1, $2, ...)` - Parameterized values (prevents SQL injection)
- `RETURNING *` - Return the created row (including auto-generated id, uuid)

**Why parameterized queries ($1, $2)?**
```javascript
// BAD - SQL Injection vulnerable:
`INSERT INTO users (name) VALUES ('${userInput}')`
// If userInput = "'; DROP TABLE users; --" → disaster!

// GOOD - Parameterized (safe):
query(`INSERT INTO users (name) VALUES ($1)`, [userInput])
// userInput is escaped, treated as data not code
```

---

## findById() & findByUuid()

**Purpose:** Retrieve a single request by its identifier

```javascript
const findById = async (id) => {
  const sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE qr.id = $1
  `;
```

**Line by line:**
- `SELECT qr.*` - Get all columns from query_requests
- `u.email as user_email` - Also get user's email, rename to avoid conflict
- `FROM query_requests qr` - Main table with alias 'qr'
- `JOIN users u ON qr.user_id = u.id` - Connect to users table
- `WHERE qr.id = $1` - Filter by the provided ID

**Why JOIN instead of separate queries?**
```javascript
// BAD - Two database round trips:
const request = await query('SELECT * FROM query_requests WHERE id = $1', [id]);
const user = await query('SELECT * FROM users WHERE id = $1', [request.user_id]);

// GOOD - One round trip with JOIN:
const result = await query(`
  SELECT qr.*, u.email, u.name 
  FROM query_requests qr 
  JOIN users u ON qr.user_id = u.id 
  WHERE qr.id = $1
`, [id]);
```

**findByUuid vs findById:**
- `findById(123)` - Used internally (faster, integer comparison)
- `findByUuid('550e8400-...')` - Used in API endpoints (secure, can't guess)

---

## findByUserId()

**Purpose:** Get all requests submitted by a specific user (for "My Requests" page)

```javascript
const findByUserId = async (userId, { status = null, limit = 50, offset = 0 } = {}) => {
  let sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE qr.user_id = $1
  `;
  const params = [userId];
  let paramIndex = 2;  // Next parameter will be $2
```

**Dynamic query building:**
```javascript
  // If status filter provided, add it
  if (status) {
    sql += ` AND qr.status = $${paramIndex++}`;  // Adds "AND qr.status = $2"
    params.push(status);                          // params = [userId, status]
  }

  // Add pagination
  sql += ` ORDER BY qr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);
  // Final: params = [userId, status, limit, offset] or [userId, limit, offset]
```

**Why dynamic query building?**
- Avoids multiple similar functions (findByUserIdWithStatus, findByUserIdPaginated, etc.)
- Single function handles all combinations
- Still uses parameterized queries (safe)

**Pagination explained:**
```
Page 1: LIMIT 10 OFFSET 0   → rows 1-10
Page 2: LIMIT 10 OFFSET 10  → rows 11-20
Page 3: LIMIT 10 OFFSET 20  → rows 21-30

Formula: offset = (page - 1) * limit
```

---

## findByPodIds()

**Purpose:** Get requests for specific PODs (for manager's approval dashboard)

```javascript
const findByPodIds = async (podIds, { status = null, limit = 50, offset = 0 } = {}) => {
  let sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE qr.pod_id = ANY($1)
  `;
  const params = [podIds];  // podIds is an array like ['pod-1', 'pod-2']
```

**The ANY() operator:**
```sql
-- This:
WHERE pod_id = ANY(ARRAY['pod-1', 'pod-2', 'pod-3'])

-- Is equivalent to:
WHERE pod_id IN ('pod-1', 'pod-2', 'pod-3')

-- But ANY() works better with parameterized arrays in PostgreSQL
```

**Why this function exists:**
- Managers can only see requests from PODs they manage
- Admin can see all PODs
- Pass array of allowed POD IDs, get matching requests

---


## findAll()

**Purpose:** Advanced search with multiple filters (for admin dashboard)

```javascript
const findAll = async ({
  status = null,         // Filter by status
  podId = null,          // Filter by specific POD
  userId = null,         // Filter by user
  databaseType = null,   // Filter by 'postgresql' or 'mongodb'
  submissionType = null, // Filter by 'query' or 'script'
  search = null,         // Text search in comments/query/email
  startDate = null,      // Created after this date
  endDate = null,        // Created before this date
  limit = 50,
  offset = 0,
} = {}) => {
```

**Building the query dynamically:**
```javascript
  let sql = `
    SELECT qr.*, u.email as user_email, u.name as user_name
    FROM query_requests qr
    JOIN users u ON qr.user_id = u.id
    WHERE 1=1
  `;
  // "WHERE 1=1" is a trick - always true, makes adding ANDs easier
```

**Why `WHERE 1=1`?**
```javascript
// Without it, first condition needs special handling:
if (status) sql += ` WHERE status = $1`;      // First uses WHERE
if (podId) sql += ` AND pod_id = $2`;         // Others use AND

// With WHERE 1=1, all conditions use AND:
sql = `... WHERE 1=1`;
if (status) sql += ` AND status = $1`;        // All use AND
if (podId) sql += ` AND pod_id = $2`;         // Consistent!
```

**Text search with ILIKE:**
```javascript
  if (search) {
    sql += ` AND (
      qr.comments ILIKE $${paramIndex} OR 
      qr.query_content ILIKE $${paramIndex} OR 
      u.email ILIKE $${paramIndex}
    )`;
    params.push(`%${search}%`);  // % = wildcard (matches anything)
    paramIndex++;
  }
```

**ILIKE explained:**
- `LIKE` = case-sensitive pattern matching
- `ILIKE` = case-insensitive (PostgreSQL specific)
- `%search%` = contains "search" anywhere
- `search%` = starts with "search"
- `%search` = ends with "search"

---

## count()

**Purpose:** Count total matching records (for pagination info)

```javascript
const count = async ({ status, podId, userId, podIds } = {}) => {
  let sql = 'SELECT COUNT(*) as count FROM query_requests WHERE 1=1';
  // ... add filters same as findAll ...
  
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);  // Convert string to integer
};
```

**Why separate count function?**
```javascript
// For pagination, frontend needs:
{
  data: [...50 items...],
  pagination: {
    page: 1,
    limit: 50,
    total: 1234,        // ← Need count() for this
    totalPages: 25      // = Math.ceil(total / limit)
  }
}
```

**Why not just use findAll().length?**
- `findAll()` returns only 50 rows (limited)
- `count()` returns total matching rows (could be 1000s)
- Much faster than fetching all rows just to count

---

## updateStatus()

**Purpose:** Central function for all status changes (approve, reject, complete, fail)

```javascript
const updateStatus = async (id, status, additionalData = {}) => {
  // Start with basic update
  const updateFields = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [id, status];
  let paramIndex = 3;
```

**Dynamic field updates:**
```javascript
  // If approver info provided, add those fields
  if (additionalData.approverId) {
    updateFields.push(`approver_id = $${paramIndex++}`);
    params.push(additionalData.approverId);
  }

  if (additionalData.approverEmail) {
    updateFields.push(`approver_email = $${paramIndex++}`);
    params.push(additionalData.approverEmail);
  }

  // Auto-set timestamp when approved
  if (status === RequestStatus.APPROVED) {
    updateFields.push('approved_at = CURRENT_TIMESTAMP');
  }

  // Auto-set timestamps for execution
  if (status === RequestStatus.EXECUTING) {
    updateFields.push('execution_started_at = CURRENT_TIMESTAMP');
  }

  if (status === RequestStatus.COMPLETED || status === RequestStatus.FAILED) {
    updateFields.push('execution_completed_at = CURRENT_TIMESTAMP');
  }
```

**Building final SQL:**
```javascript
  const sql = `
    UPDATE query_requests 
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `;
  // Example result:
  // UPDATE query_requests 
  // SET status = $2, updated_at = CURRENT_TIMESTAMP, approver_id = $3, approved_at = CURRENT_TIMESTAMP
  // WHERE id = $1
  // RETURNING *
```

**Why one function instead of many?**
```javascript
// BAD - Lots of similar functions:
const approve = async (id, approverId) => { /* similar SQL */ };
const reject = async (id, approverId, reason) => { /* similar SQL */ };
const markCompleted = async (id, result) => { /* similar SQL */ };
const markFailed = async (id, error) => { /* similar SQL */ };

// GOOD - One flexible function:
const updateStatus = async (id, status, additionalData) => { /* handles all */ };

// Helper functions just call updateStatus:
const approve = (id, approverId, email) => 
  updateStatus(id, 'approved', { approverId, approverEmail: email });
```

---

## Status Helper Functions

These are convenience wrappers around `updateStatus()`:

```javascript
// Approve a request
const approve = async (id, approverId, approverEmail) => {
  return updateStatus(id, RequestStatus.APPROVED, { approverId, approverEmail });
};

// Reject a request
const reject = async (id, approverId, approverEmail, reason = null) => {
  return updateStatus(id, RequestStatus.REJECTED, {
    approverId,
    approverEmail,
    rejectionReason: reason,
  });
};

// Mark as currently executing
const markExecuting = async (id) => {
  return updateStatus(id, RequestStatus.EXECUTING);
};

// Mark as successfully completed
const markCompleted = async (id, result) => {
  return updateStatus(id, RequestStatus.COMPLETED, { executionResult: result });
};

// Mark as failed
const markFailed = async (id, error) => {
  return updateStatus(id, RequestStatus.FAILED, { executionError: error });
};
```

**Why helper functions?**
- Cleaner API: `approve(id, userId, email)` vs `updateStatus(id, 'approved', {...})`
- Self-documenting code
- Type safety (can't accidentally pass wrong status)
- Single place to add status-specific logic

---

## Statistics Functions

### getStatusCounts()

**Purpose:** Get count of requests by status (for dashboard summary)

```javascript
const getStatusCounts = async () => {
  const sql = `
    SELECT status, COUNT(*) as count
    FROM query_requests
    GROUP BY status
  `;
```

**GROUP BY explained:**
```
Raw data:                    After GROUP BY status:
| id | status    |           | status    | count |
|----|-----------|           |-----------|-------|
| 1  | pending   |           | pending   | 2     |
| 2  | completed |    →      | completed | 2     |
| 3  | pending   |           | failed    | 1     |
| 4  | completed |
| 5  | failed    |
```

**Building the result object:**
```javascript
  const counts = {
    pending: 0, approved: 0, rejected: 0,
    executing: 0, completed: 0, failed: 0,
    total: 0,
  };

  result.rows.forEach((row) => {
    counts[row.status] = parseInt(row.count, 10);
    counts.total += parseInt(row.count, 10);
  });

  return counts;
  // { pending: 5, approved: 2, completed: 10, failed: 1, total: 18 }
```

### getStatsByPod()

**Purpose:** Get request counts grouped by POD and status

```javascript
const sql = `
  SELECT pod_id, pod_name, status, COUNT(*) as count
  FROM query_requests
  GROUP BY pod_id, pod_name, status
  ORDER BY pod_name, status
`;
```

**Result structure:**
```javascript
{
  'pod-1': {
    name: 'Engineering',
    total: 50,
    pending: 5,
    completed: 40,
    failed: 5,
  },
  'pod-2': {
    name: 'Data Science',
    total: 30,
    pending: 10,
    completed: 20,
  }
}
```

### getRecentActivity()

**Purpose:** Get daily request counts for charts

```javascript
const sql = `
  SELECT DATE(created_at) as date, COUNT(*) as count
  FROM query_requests
  WHERE created_at > NOW() - INTERVAL '${days} days'
  GROUP BY DATE(created_at)
  ORDER BY date DESC
`;
```

**DATE() function:**
- Extracts just the date part from timestamp
- `2024-01-15 14:30:00` → `2024-01-15`
- Groups all requests from same day together

---

## mapRequestRow()

**Purpose:** Convert database column names (snake_case) to JavaScript (camelCase)

```javascript
const mapRequestRow = (row) => ({
  id: row.id,
  uuid: row.uuid,
  userId: row.user_id,           // snake_case → camelCase
  userEmail: row.user_email,
  userName: row.user_name,
  databaseType: row.database_type,
  instanceId: row.instance_id,
  instanceName: row.instance_name,
  databaseName: row.database_name,
  submissionType: row.submission_type,
  queryContent: row.query_content,
  scriptFilename: row.script_filename,
  scriptContent: row.script_content,
  comments: row.comments,
  podId: row.pod_id,
  podName: row.pod_name,
  status: row.status,
  approverId: row.approver_id,
  approverEmail: row.approver_email,
  approvedAt: row.approved_at,
  rejectionReason: row.rejection_reason,
  executionResult: row.execution_result,
  executionError: row.execution_error,
  executionStartedAt: row.execution_started_at,
  executionCompletedAt: row.execution_completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
```

**Why this mapping?**
- PostgreSQL convention: `snake_case` (user_id, created_at)
- JavaScript convention: `camelCase` (userId, createdAt)
- Keeps both worlds happy
- Frontend receives consistent camelCase JSON

---

## Summary: Why This Design?

| Design Choice | Reason |
|---------------|--------|
| UUID for public IDs | Prevents enumeration attacks |
| Parameterized queries | Prevents SQL injection |
| Dynamic query building | Flexible filtering without code duplication |
| Single updateStatus() | DRY principle, consistent behavior |
| Helper functions | Clean API, self-documenting |
| mapRequestRow() | Convention consistency (snake_case ↔ camelCase) |
| Indexes | Fast queries on large tables |
| GROUP BY for stats | Efficient aggregation in database |
