# Database Query Portal - Backend Architecture Deep Dive

## Table of Contents
1. [Project Structure](#project-structure)
2. [Server Entry Point (server.js)](#server-entry-point)
3. [Layered Security Implementation](#layered-security-implementation)
4. [Authentication System (auth.js)](#authentication-system)
5. [Script Execution with Child Process](#script-execution-with-child-process)
6. [Database Models](#database-models)
7. [Services Layer](#services-layer)
8. [Why These Design Choices?](#why-these-design-choices)

---

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # PostgreSQL connection pool
│   │   ├── index.js      # Environment config loader
│   │   └── staticData.js # PODs, instances cache
│   ├── controllers/      # Request handlers
│   │   ├── authController.js
│   │   ├── queryController.js
│   │   └── databaseController.js
│   ├── middleware/       # Express middleware
│   │   ├── auth.js       # JWT authentication
│   │   ├── validation.js # Input validation
│   │   ├── upload.js     # File upload handling
│   │   └── errorHandler.js
│   ├── models/           # Database models
│   │   ├── User.js
│   │   └── QueryRequest.js
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic
│   │   ├── scriptExecutionService.js
│   │   ├── scriptWorker.js
│   │   ├── queryExecutionService.js
│   │   ├── slackService.js
│   │   └── databaseSyncService.js
│   ├── utils/            # Utility functions
│   │   ├── logger.js
│   │   ├── errors.js
│   │   └── response.js
│   └── server.js         # Main entry point
└── tests/                # Unit tests (100% coverage)
```

---

## Server Entry Point (server.js)

### Line-by-Line Explanation


```javascript
// server.js - Lines 1-20: Dependencies
require('dotenv').config({ path: '.env' });  // Load environment variables

const express = require('express');     // Web framework
const helmet = require('helmet');       // Security headers
const cors = require('cors');           // Cross-origin requests
const morgan = require('morgan');       // HTTP logging
const compression = require('compression'); // Response compression
const rateLimit = require('express-rate-limit'); // DDoS protection
const hpp = require('hpp');             // HTTP Parameter Pollution protection
const xss = require('xss-clean');       // XSS attack prevention
```

**Why Express?**
- Most popular Node.js framework
- Minimal, flexible, well-documented
- Huge middleware ecosystem
- Easy to test and maintain

---

## Layered Security Implementation

### Layer 1: Helmet.js (Lines 38-47)
**Location:** `server.js`

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],           // Only load resources from same origin
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],            // Prevent XSS via script injection
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

**What it does:**
- Sets `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- Sets `X-Frame-Options: DENY` - Prevents clickjacking
- Sets `X-XSS-Protection: 1; mode=block` - Browser XSS filter
- Sets `Strict-Transport-Security` - Forces HTTPS
- Sets `Content-Security-Policy` - Controls resource loading

**Why Helmet over manual headers?**
- Configures 11+ security headers automatically
- Follows OWASP best practices
- Regularly updated for new vulnerabilities
- One line vs 50+ lines of manual configuration

---

### Layer 2: CORS (Lines 50-67)
**Location:** `server.js`

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);  // Allow server-to-server
    
    const allowedOrigins = config.cors.origin;
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,                    // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,                        // Cache preflight for 24 hours
};
```

**What it does:**
- Controls which domains can call your API
- Prevents malicious websites from making requests on behalf of users
- Allows credentials (cookies, auth headers) only from trusted origins

**Why custom origin function?**
- Supports multiple origins (dev, staging, prod)
- Can dynamically check against database
- Better error messages than simple array

---

### Layer 3: Rate Limiting (Lines 69-97)
**Location:** `server.js`

```javascript
// General API limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: { error: 'Too many requests' },
  standardHeaders: true,      // Return rate limit info in headers
});

// Stricter auth limiter - prevents brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // Only 10 login attempts
  message: { error: 'Too many auth attempts' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
```

**What it does:**
- Prevents DDoS attacks by limiting requests per IP
- Prevents brute force password attacks (10 attempts/15min)
- Returns `429 Too Many Requests` when exceeded

**Why different limits for auth?**
- Login endpoints are prime targets for attacks
- 10 attempts is enough for legitimate users
- Slows down automated password guessing

---

### Layer 4: XSS & HPP Protection (Lines 99-103)
**Location:** `server.js`

```javascript
// Prevent HTTP Parameter Pollution
app.use(hpp({
  whitelist: ['status', 'podId'],  // Allow these to be arrays
}));

// Sanitize user input against XSS
app.use(xss());
```

**What HPP prevents:**
```
// Attack: ?status=pending&status=approved (parameter pollution)
// Without HPP: req.query.status = ['pending', 'approved']
// With HPP: req.query.status = 'approved' (last value)
```

**What XSS-clean does:**
- Removes `<script>` tags from input
- Escapes HTML entities
- Prevents stored XSS attacks

---


## Authentication System (auth.js)

### Layer 5: JWT Authentication
**Location:** `src/middleware/auth.js`

### Token Generation (Lines 36-95)

```javascript
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    podId: user.podId,
    managedPods: user.managedPods,
  };

  return jwt.sign(payload, JWT_CONFIG.accessTokenSecret, {
    expiresIn: '15m',        // Short-lived for security
    issuer: 'db-query-portal',
    audience: 'db-query-portal-users',
  });
};

const generateRefreshToken = (user) => {
  const tokenId = crypto.randomUUID();  // Unique ID for revocation
  
  return jwt.sign(
    { userId: user.id, tokenId, type: 'refresh' },
    JWT_CONFIG.refreshTokenSecret,
    { expiresIn: '7d' }      // Long-lived for convenience
  );
};
```

**Why Two Tokens?**

| Access Token | Refresh Token |
|--------------|---------------|
| 15 minutes expiry | 7 days expiry |
| Stored in memory | Stored in httpOnly cookie |
| Used for API calls | Used only to get new access token |
| If stolen, limited damage | Can be revoked from database |

**Why not just one long-lived token?**
- If stolen, attacker has access for entire duration
- Can't revoke without invalidating all users
- No way to force re-authentication

---

### Token Blacklisting (Lines 110-175)
**Location:** `src/middleware/auth.js`

```javascript
// Check if token is blacklisted (user logged out)
const isTokenBlacklisted = async (tokenHash) => {
  const result = await query(
    `SELECT 1 FROM access_token_blacklist 
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows.length > 0;
};

// Blacklist token on logout
const blacklistAccessToken = async (token, userId) => {
  const tokenHash = hashToken(token);
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);
  
  await query(
    `INSERT INTO access_token_blacklist (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, userId, expiresAt]
  );
};
```

**Why blacklist instead of just letting tokens expire?**
- Immediate logout (don't wait 15 minutes)
- Security: stolen tokens can be invalidated
- Compliance: GDPR requires ability to revoke access

---

### Layer 6: Role-Based Access Control (Lines 300-410)
**Location:** `src/middleware/auth.js`

```javascript
const ROLES = {
  ADMIN: 'admin',      // Can do everything
  MANAGER: 'manager',  // Can approve requests for their PODs
  DEVELOPER: 'developer', // Can only submit requests
};

const ROLE_HIERARCHY = {
  admin: 3,
  manager: 2,
  developer: 1,
};

// Middleware: Check if user has required role
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// Middleware: Check if user can access specific POD
const authorizePodAccess = () => {
  return (req, res, next) => {
    if (req.user.role === 'admin') return next();  // Admins bypass
    
    const requestedPodId = req.params.podId || req.body.podId;
    const hasAccess = req.user.managedPods.includes(requestedPodId);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'No access to this POD' });
    }
    next();
  };
};
```

**Usage in Routes:**
```javascript
// Only admins can delete users
router.delete('/users/:id', authenticate, authorize('admin'), deleteUser);

// Managers and admins can approve
router.post('/approve/:uuid', authenticate, authorize('manager', 'admin'), approve);

// Anyone authenticated can submit
router.post('/submit', authenticate, submitRequest);
```

---


## Script Execution with Child Process

### Why Child Process over Other Options?

| Option | Pros | Cons | Security |
|--------|------|------|----------|
| **eval()** | Simple | Blocks event loop, full access to Node | ❌ Dangerous |
| **VM2** | Sandboxed | Deprecated, known CVEs, can be escaped | ⚠️ Vulnerable |
| **Worker Threads** | Fast, shared memory | Same process, can access parent memory | ⚠️ Limited isolation |
| **Child Process (fork)** ✅ | True OS isolation, separate memory | Slightly slower startup | ✅ Most secure |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  scriptExecutionService.js                          │    │
│  │  - Validates script syntax                          │    │
│  │  - Spawns child process                             │    │
│  │  - Sets timeout (30 seconds)                        │    │
│  │  - Collects results via IPC                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                    fork() │ IPC Messages                     │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  scriptWorker.js (Child Process)                    │    │
│  │  - Separate memory space                            │    │
│  │  - Limited globals (no require, no process)         │    │
│  │  - Database connection wrapper                      │    │
│  │  - Captured console output                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### scriptExecutionService.js - Main Process
**Location:** `src/services/scriptExecutionService.js`

```javascript
// Lines 30-50: Syntax Validation (runs BEFORE spawning child)
function validateScriptSyntax(scriptContent) {
  try {
    // Wrap in async function to allow top-level await
    const wrappedScript = `(async () => { ${scriptContent} })()`;
    new Function(wrappedScript);  // Parse without executing
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: {
        type: 'SyntaxError',
        message: error.message,
        line: extractLineNumber(error),
      },
    };
  }
}
```

**Why validate before spawning?**
- Faster feedback (no process spawn overhead)
- Better error messages with line numbers
- Saves resources on obviously invalid scripts

---

### Lines 150-220: Child Process Execution

```javascript
function executeInChildProcess(config) {
  return new Promise((resolve) => {
    const workerPath = path.join(__dirname, 'scriptWorker.js');
    
    // fork() creates a new Node.js process
    const child = fork(workerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],  // IPC for messaging
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });

    let resolved = false;
    
    // Timeout protection - kill if takes too long
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        child.kill('SIGTERM');  // Graceful kill
        resolve({
          success: false,
          error: { type: 'TimeoutError', message: 'Script timed out' },
        });
      }
    }, config.timeout + 5000);

    // Receive results via IPC
    child.on('message', (message) => {
      if (message.type === 'ready') {
        // Worker is ready, send the script
        child.send({ type: 'execute', config });
      } else if (message.type === 'result') {
        resolved = true;
        clearTimeout(timeoutId);
        child.kill();
        resolve(message.data);
      }
    });

    // Handle crashes
    child.on('error', (error) => {
      resolve({ success: false, error: { message: error.message } });
    });
  });
}
```

**Why fork() instead of spawn()?**
- `fork()` creates IPC channel automatically
- Optimized for Node.js scripts
- Can send/receive JavaScript objects directly

---

### scriptWorker.js - Child Process
**Location:** `src/services/scriptWorker.js`

```javascript
// Lines 20-50: Sandboxed Console
const sandboxConsole = {
  log: (...args) => {
    const message = args.map(a => 
      typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
    ).join(' ');
    output.push({ type: 'log', message, timestamp: new Date() });
  },
  error: (...args) => { /* similar */ },
  warn: (...args) => { /* similar */ },
};
```

**Why custom console?**
- Captures all output for display in UI
- Prevents direct stdout access
- Adds timestamps for debugging

---

### Lines 60-150: Database Wrappers

```javascript
function createPostgresWrapper(client) {
  return {
    query: async (sql, params = []) => {
      const startTime = Date.now();
      const result = await client.query(sql, params);
      const duration = Date.now() - startTime;
      
      // Log query execution
      output.push({
        type: 'query',
        sql: sql.substring(0, 200),
        duration: `${duration}ms`,
        rowCount: result.rowCount,
      });
      
      return {
        rows: result.rows,
        rowCount: result.rowCount,
      };
    },
  };
}
```

**Why wrapper instead of raw client?**
- Logs all queries automatically
- Limits result size (prevents memory issues)
- Adds timing information
- Sanitizes output for display

---

### Lines 300-380: Script Execution Context

```javascript
async function executeInWorker(config) {
  // Create limited execution context
  const context = {
    db: dbWrapper,              // Database access
    console: sandboxConsole,    // Captured console
    JSON,                       // Safe built-ins
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Promise,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5000)), // Max 5s
    // NO: require, process, fs, child_process, eval, Function
  };

  // Create async function with limited scope
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const scriptFn = new AsyncFunction(
    ...Object.keys(context),
    `try { ${scriptContent} } catch(e) { console.error(e.message); throw e; }`
  );
  
  // Execute with context values
  const result = await scriptFn(...Object.values(context));
  
  return { success: true, result, output };
}
```

**What's blocked and why:**

| Blocked | Why |
|---------|-----|
| `require()` | Could load malicious modules |
| `process` | Could access env vars, exit process |
| `fs` | Could read/write files |
| `child_process` | Could spawn processes |
| `eval()` | Could escape sandbox |
| `Function()` | Could create uncontrolled code |

---


## Input Validation (validation.js)

**Location:** `src/middleware/validation.js`

### Why express-validator?

```javascript
const queryRequestValidations = {
  create: [
    body('instanceId')
      .trim()                    // Remove whitespace
      .notEmpty()
      .withMessage('Instance ID is required'),
    
    body('queryContent')
      .if(body('submissionType').equals('query'))  // Conditional
      .notEmpty()
      .isLength({ max: 100000 })  // Prevent huge payloads
      .withMessage('Query too large'),
    
    body('comments')
      .trim()
      .notEmpty()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Comments must be 10-5000 characters'),
  ],

  // UUID validation prevents enumeration attacks
  approve: [
    param('uuid')
      .isUUID()
      .withMessage('Valid UUID required'),
  ],
};
```

**Why UUID instead of integer IDs?**

```
// With integer IDs (BAD):
GET /api/requests/1  ✓
GET /api/requests/2  ✓
GET /api/requests/3  ✓
// Attacker can enumerate all requests!

// With UUIDs (GOOD):
GET /api/requests/550e8400-e29b-41d4-a716-446655440000  ✓
GET /api/requests/???  // Can't guess next one
```

---

### Custom Sanitization (Lines 180-220)

```javascript
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');  // onclick=, onerror=, etc.
    }
    // ... recursive for objects/arrays
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  next();
};
```

**What it prevents:**
```javascript
// XSS Attack attempt:
{ "name": "<script>alert('hacked')</script>" }
// After sanitization:
{ "name": "" }

// Event handler injection:
{ "name": "<img src=x onerror=alert('hacked')>" }
// After sanitization:
{ "name": "<img src=x >" }
```

---

## Database Models

### QueryRequest Model
**Location:** `src/models/QueryRequest.js`

```javascript
// Status state machine
const RequestStatus = {
  PENDING: 'pending',      // Waiting for approval
  APPROVED: 'approved',    // Approved, not yet executed
  REJECTED: 'rejected',    // Denied by manager
  EXECUTING: 'executing',  // Currently running
  COMPLETED: 'completed',  // Finished successfully
  FAILED: 'failed',        // Execution error
};

// State transitions
// pending → approved → executing → completed
//        ↘ rejected            ↘ failed
```

### Key Methods

```javascript
// Create with UUID generation
static async create(data) {
  const uuid = crypto.randomUUID();  // Secure random UUID
  const result = await query(
    `INSERT INTO query_requests (uuid, user_id, ...) 
     VALUES ($1, $2, ...) RETURNING *`,
    [uuid, data.userId, ...]
  );
  return result.rows[0];
}

// Find by UUID only (security)
static async findByUuid(uuid) {
  const result = await query(
    `SELECT qr.*, u.email as user_email, u.name as user_name
     FROM query_requests qr
     JOIN users u ON qr.user_id = u.id
     WHERE qr.uuid = $1`,
    [uuid]
  );
  return result.rows[0] || null;
}

// Status transitions with timestamps
static async markCompleted(id, result) {
  return await query(
    `UPDATE query_requests 
     SET status = 'completed', 
         execution_result = $2,
         execution_completed_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, result]
  );
}
```

---

## Services Layer

### Slack Service
**Location:** `src/services/slackService.js`

```javascript
// Concise message formatting
const formatExecutionResult = (resultStr) => {
  const result = JSON.parse(resultStr);
  
  // Check for failure
  if (result.success === false) {
    return {
      success: false,
      error: result.error,
    };
  }
  
  // Build summary
  const parts = [];
  if (result.summary?.rowsReturned > 0) {
    parts.push(`📊 ${result.summary.rowsReturned} row(s) fetched`);
  }
  if (result.summary?.rowsAffected > 0) {
    parts.push(`✏️ ${result.summary.rowsAffected} row(s) affected`);
  }
  
  // Preview first 3 rows only
  const preview = result.output
    ?.filter(i => i.type === 'data')
    ?.[0]?.preview?.slice(0, 3);
  
  return { success: true, summary: parts.join(' | '), preview };
};
```

**Why concise messages?**
- Slack has message size limits
- Users want quick summary, not raw JSON
- Detailed results available in portal

---

### Query Execution Service
**Location:** `src/services/queryExecutionService.js`

```javascript
async function executeQuery(request) {
  const { databaseType, instanceId, databaseName, queryContent } = request;
  
  // Get instance config (from cache or AWS Secrets Manager)
  const instance = getInstanceById(instanceId);
  
  if (databaseType === 'postgresql') {
    const client = new Client({
      host: instance.host,
      port: instance.port,
      database: databaseName,
      user: instance.user,
      password: instance.password,
      query_timeout: 30000,  // 30 second timeout
    });
    
    await client.connect();
    const result = await client.query(queryContent);
    await client.end();
    
    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }
  
  // Similar for MongoDB...
}
```

---


## Error Handling

### Custom Error Classes
**Location:** `src/utils/errors.js`

```javascript
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;  // Expected error, not a bug
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}
```

**Why custom errors?**
- Consistent error format across API
- Automatic status code mapping
- Distinguishes operational vs programming errors
- Better logging and monitoring

---

### Global Error Handler
**Location:** `src/middleware/errorHandler.js`

```javascript
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Operational error (expected)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.errors && { errors: err.errors }),
      },
    });
  }

  // Programming error (unexpected) - don't leak details
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    },
  });
};
```

---

## Why These Design Choices?

### 1. Child Process vs VM2 vs Worker Threads

**VM2 (NOT USED - Deprecated)**
```javascript
// VM2 has known security vulnerabilities (CVE-2023-37466)
const { VM } = require('vm2');
const vm = new VM({ timeout: 1000 });
vm.run(userCode);  // CAN BE ESCAPED!
```

**Worker Threads (NOT USED - Shared Memory)**
```javascript
// Worker threads share memory with main process
const { Worker } = require('worker_threads');
// User code could potentially access shared buffers
```

**Child Process (USED - True Isolation)**
```javascript
// Completely separate process, separate memory
const { fork } = require('child_process');
const child = fork('./worker.js');
// Even if user code is malicious, it can't affect main process
// Can be killed if it hangs
// OS-level resource limits
```

### 2. JWT with Refresh Tokens vs Sessions

**Sessions (NOT USED)**
```javascript
// Requires server-side storage
// Doesn't scale horizontally without shared session store
// Every request needs database lookup
```

**JWT with Refresh (USED)**
```javascript
// Stateless - no server storage needed
// Scales horizontally
// Access token validated without database
// Refresh token allows revocation
```

### 3. PostgreSQL vs MongoDB for Portal Data

**Why PostgreSQL for the portal itself:**
- ACID transactions for request status changes
- Complex queries for reporting
- Relational data (users → requests → approvals)
- Strong consistency required

**Why support both for user queries:**
- Users have both PostgreSQL and MongoDB databases
- Different use cases require different databases

### 4. Express-validator vs Joi vs Zod

**Express-validator (USED)**
```javascript
// Integrates directly with Express middleware
// Chain validation rules
// Built-in sanitization
body('email').isEmail().normalizeEmail()
```

**Joi**
```javascript
// Separate schema definition
// More verbose
// Better for complex nested objects
```

**Zod**
```javascript
// TypeScript-first
// Runtime type checking
// Better for TypeScript projects
```

We chose express-validator for:
- Native Express integration
- Simpler syntax for our use case
- Built-in sanitization
- Smaller bundle size

---

## Security Summary

| Layer | Technology | Location | Purpose |
|-------|------------|----------|---------|
| 1 | Helmet.js | server.js:38-47 | HTTP security headers |
| 2 | CORS | server.js:50-67 | Cross-origin protection |
| 3 | Rate Limiting | server.js:69-97 | DDoS/brute force protection |
| 4 | XSS-clean | server.js:103 | Input sanitization |
| 5 | HPP | server.js:99-101 | Parameter pollution |
| 6 | JWT Auth | auth.js:36-95 | Token-based authentication |
| 7 | Token Blacklist | auth.js:110-175 | Immediate logout |
| 8 | RBAC | auth.js:300-410 | Role-based access |
| 9 | Input Validation | validation.js | Request validation |
| 10 | UUID IDs | models/*.js | Enumeration prevention |
| 11 | Child Process | scriptWorker.js | Script isolation |
| 12 | Query Timeout | queryExecutionService.js | Resource protection |

---

## Testing

All code has **100% test coverage**:

```
----------------------------|---------|----------|---------|---------|
File                        | % Stmts | % Branch | % Funcs | % Lines |
----------------------------|---------|----------|---------|---------|
All files                   |     100 |      100 |     100 |     100 |
----------------------------|---------|----------|---------|---------|
```

Run tests: `npm test`
View coverage report: `open coverage/lcov-report/index.html`
