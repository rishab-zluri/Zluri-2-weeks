# Implementation Deep Dive - Complete Technical Explanation

This document provides an in-depth explanation of every major implementation decision, including:
- **What** each feature does
- **Why** we chose this approach
- **How** it works (with actual code)
- **Where** it's implemented in our codebase

---

# Table of Contents

1. [Layered Security Pipeline](#1-layered-security-pipeline)
   - [Helmet.js](#11-helmetjs---security-http-headers)
   - [CORS](#12-cors---cross-origin-resource-sharing)
   - [Rate Limiting](#13-rate-limiting)
   - [HPP & XSS Protection](#14-hpp--xss-protection)
2. [JWT Authentication System](#2-jwt-authentication-system)
3. [Role-Based Access Control](#3-role-based-access-control)
4. [Script Execution Sandbox](#4-script-execution-sandbox)
5. [Request Approval Workflow](#5-request-approval-workflow)
6. [Slack Integration](#6-slack-integration)
7. [Database Schema Design](#7-database-schema-design)
8. [Error Handling](#8-error-handling)
9. [Testing Strategy](#9-testing-strategy)

---

# 1. Layered Security Pipeline

## Overview

Every HTTP request passes through 6 security layers before reaching our business logic:

```
Request → Helmet → CORS → Rate Limit → HPP/XSS → JWT Auth → RBAC → Handler
```

**Why Layered Security (Defense in Depth)?**
- If one layer fails, others still protect the system
- Each layer handles a specific attack vector
- Industry best practice for production APIs

**Where Implemented:** `backend/src/server.js` (lines 38-110)

---

## 1.1 Helmet.js - Security HTTP Headers

### What It Does
Helmet.js sets various HTTP headers that protect against common web vulnerabilities.

### Why We Need It
Browsers use HTTP headers to determine security policies. Without proper headers, our app is vulnerable to:
- **XSS (Cross-Site Scripting)**: Attackers inject malicious scripts
- **Clickjacking**: Attackers embed our site in an iframe to trick users
- **MIME Sniffing**: Browsers misinterpret file types, executing malicious content

### Our Implementation

**Location:** `backend/src/server.js` (lines 38-47)

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],           // Only load resources from our domain
      styleSrc: ["'self'", "'unsafe-inline'"],  // Allow inline styles (for UI)
      scriptSrc: ["'self'"],            // Only run scripts from our domain
      imgSrc: ["'self'", 'data:', 'https:'],    // Allow images from our domain + data URIs
    },
  },
  crossOriginEmbedderPolicy: false,     // Disabled for API compatibility
}));
```

### Headers Set by Helmet

| Header | Value | Protection Against |
|--------|-------|-------------------|
| `Content-Security-Policy` | `default-src 'self'` | XSS - prevents loading external scripts |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing attacks |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking - prevents iframe embedding |
| `X-XSS-Protection` | `1; mode=block` | Browser XSS filter |
| `Strict-Transport-Security` | `max-age=...` | Forces HTTPS |
| `X-DNS-Prefetch-Control` | `off` | DNS prefetch privacy leak |

### Why Each Directive Matters for Our Use Case

| Directive | Why We Set It This Way |
|-----------|----------------------|
| `defaultSrc: ["'self'"]` | Our API only serves JSON, no external resources needed |
| `scriptSrc: ["'self'"]` | Prevents XSS - attackers can't inject external scripts |
| `imgSrc: ["'self'", 'data:', 'https:']` | Allows Slack avatars and data URIs for icons |

---

## 1.2 CORS - Cross-Origin Resource Sharing

### What It Does
CORS controls which domains can make requests to our API.

### Why We Need It
Without CORS:
- Any website could make requests to our API using a user's cookies
- Attackers could create fake sites that steal data from our API
- Cross-site request forgery (CSRF) attacks become trivial

### Our Implementation

**Location:** `backend/src/server.js` (lines 50-67)

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in our allowed list
    const allowedOrigins = Array.isArray(config.cors.origin) 
      ? config.cors.origin 
      : [config.cors.origin];
      
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);   // Allow the request
    } else {
      callback(new Error('Not allowed by CORS'));  // Block the request
    }
  },
  credentials: true,          // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],  // Pagination headers
  maxAge: 86400,              // Cache preflight for 24 hours
};
app.use(cors(corsOptions));
```

### How CORS Works

```
1. Browser sends OPTIONS request (preflight)
   Origin: https://frontend.example.com

2. Our server checks if origin is allowed
   ✅ Allowed: Returns Access-Control-Allow-Origin header
   ❌ Not allowed: Returns error, browser blocks request

3. If allowed, browser sends actual request
```

### Configuration Options Explained

| Option | Our Value | Why |
|--------|-----------|-----|
| `origin` | Function | Dynamic check against allowed list |
| `credentials: true` | Allow | We use JWT in Authorization header |
| `methods` | All CRUD | Our API uses all HTTP methods |
| `allowedHeaders` | Specific list | Only headers we actually use |
| `exposedHeaders` | Pagination | Frontend needs these for pagination UI |
| `maxAge: 86400` | 24 hours | Reduce preflight requests |

### Why Function-Based Origin Check?

```javascript
// ❌ Simple string - only one origin
origin: 'https://frontend.com'

// ❌ Array - doesn't handle dynamic origins
origin: ['https://frontend.com', 'https://staging.com']

// ✅ Function - flexible, can check against config
origin: function(origin, callback) {
  // Can check database, config file, environment variables
  // Can log blocked origins for security monitoring
  // Can allow no-origin requests (mobile apps)
}
```

---

## 1.3 Rate Limiting

### What It Does
Limits how many requests a client can make in a time window.

### Why We Need It
Without rate limiting:
- **Brute force attacks**: Attackers try thousands of passwords
- **DDoS attacks**: Overwhelm server with requests
- **API abuse**: Scraping, automated attacks
- **Resource exhaustion**: One client uses all server resources

### Our Implementation

**Location:** `backend/src/server.js` (lines 69-97)

```javascript
// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,  // 15 minutes (from config)
  max: config.rateLimit.maxRequests,    // 100 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,    // Return rate limit info in headers
  legacyHeaders: false,     // Disable deprecated X-RateLimit headers
  skip: (req) => config.isDevelopment,  // Skip in development
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // Only 10 login attempts!
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
});

// Apply limiters
app.use('/api/', generalLimiter);           // All API routes
app.use('/api/auth/login', authLimiter);    // Extra strict for login
app.use('/api/auth/register', authLimiter); // Extra strict for register
```

### Why Two Different Limiters?

| Endpoint | Limit | Why |
|----------|-------|-----|
| General API | 100/15min | Normal usage, allows bulk operations |
| Login/Register | 10/15min | Prevents brute force password attacks |

### Rate Limit Headers Returned

```http
HTTP/1.1 200 OK
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1640000000
```

Frontend can use these to show users when they can retry.

---

## 1.4 HPP & XSS Protection

### HPP (HTTP Parameter Pollution)

**What It Does:** Prevents attackers from injecting duplicate parameters.

**Attack Example:**
```
GET /api/queries?status=pending&status=approved
// Without HPP: Could bypass filters
// With HPP: Only uses last value or whitelisted params
```

**Our Implementation:**

```javascript
app.use(hpp({
  whitelist: ['status', 'podId', 'databaseType', 'sort', 'order'],
}));
```

**Why Whitelist These?**
- `status`: We legitimately filter by multiple statuses
- `podId`: Filter by multiple PODs
- `sort`, `order`: Sorting parameters

### XSS Clean

**What It Does:** Sanitizes user input to remove malicious scripts.

**Attack Example:**
```javascript
// User submits:
{ "comments": "<script>stealCookies()</script>" }

// Without XSS clean: Stored and executed
// With XSS clean: Sanitized to safe text
```

**Our Implementation:**

```javascript
app.use(xss());
```

---


# 2. JWT Authentication System

## Overview

We use a dual-token system:
- **Access Token**: Short-lived (15 min), used for API requests
- **Refresh Token**: Long-lived (7 days), used to get new access tokens

**Where Implemented:** `backend/src/middleware/auth.js`

---

## 2.1 Why Dual Tokens?

| Single Token Approach | Our Dual Token Approach |
|----------------------|------------------------|
| Long expiry = security risk if stolen | Access token expires in 15 min |
| Short expiry = poor UX (frequent logins) | Refresh token renews silently |
| No way to revoke without DB check | Can blacklist specific tokens |
| All-or-nothing logout | Granular session control |

---

## 2.2 Token Generation

**Location:** `backend/src/middleware/auth.js` (lines 45-95)

### Access Token Generation

```javascript
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,           // Who this token belongs to
    email: user.email,         // For display/logging
    role: user.role,           // For RBAC checks
    podId: user.pod_id,        // For POD-based access
    managedPods: user.managed_pods || [],  // For managers
  };

  return jwt.sign(payload, JWT_CONFIG.accessTokenSecret, {
    expiresIn: JWT_CONFIG.accessTokenExpiry,  // '15m'
    issuer: JWT_CONFIG.issuer,                // 'db-query-portal'
    audience: JWT_CONFIG.audience,            // 'db-query-portal-users'
    subject: user.id,                         // Standard JWT claim
  });
};
```

**Why These Payload Fields?**

| Field | Why Included |
|-------|--------------|
| `userId` | Identify the user for all operations |
| `email` | Logging, display without DB lookup |
| `role` | RBAC checks without DB lookup |
| `podId` | POD access checks without DB lookup |
| `managedPods` | Manager POD access without DB lookup |

**Why These JWT Options?**

| Option | Value | Purpose |
|--------|-------|---------|
| `expiresIn` | '15m' | Short-lived for security |
| `issuer` | 'db-query-portal' | Verify token came from us |
| `audience` | 'db-query-portal-users' | Verify token is for our users |
| `subject` | user.id | Standard claim for user ID |

### Refresh Token Generation

```javascript
const generateRefreshToken = (user) => {
  const tokenId = crypto.randomUUID();  // Unique ID for this token
  
  const payload = {
    userId: user.id,
    tokenId,           // Links to database record
    type: 'refresh',   // Distinguish from access tokens
  };

  const token = jwt.sign(payload, JWT_CONFIG.refreshTokenSecret, {
    expiresIn: JWT_CONFIG.refreshTokenExpiry,  // '7d'
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
    subject: user.id,
  });

  return { token, tokenId };
};
```

**Why `tokenId`?**
- Links JWT to database record
- Allows individual token revocation
- Enables "logout from this device" feature

---

## 2.3 Token Storage & Hashing

**Location:** `backend/src/middleware/auth.js` (lines 97-115)

```javascript
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateTokenPair = async (user) => {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, tokenId } = generateRefreshToken(user);

  // Calculate expiry date
  const expiresAt = new Date();
  const days = parseInt(JWT_CONFIG.refreshTokenExpiry) || 7;
  expiresAt.setDate(expiresAt.getDate() + days);

  // Store HASH of refresh token (not the token itself!)
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenId, user.id, hashToken(refreshToken), expiresAt]
  );

  return { accessToken, refreshToken, expiresIn: JWT_CONFIG.accessTokenExpiry };
};
```

**Why Hash the Token?**
- If database is compromised, attacker can't use tokens
- Same principle as password hashing
- SHA-256 is one-way - can verify but not reverse

---

## 2.4 Token Validation

**Location:** `backend/src/middleware/auth.js` (lines 200-260)

```javascript
const authenticate = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    // 2. Verify JWT signature and expiry
    const decoded = verifyAccessToken(token);

    // 3. Check if token is blacklisted (user logged out)
    const tokenHash = hashToken(token);
    if (await isTokenBlacklisted(tokenHash)) {
      throw new AuthenticationError('Token has been revoked');
    }

    // 4. Check if ALL user tokens were invalidated (logout-all)
    if (decoded.iat && await areUserTokensInvalidated(decoded.userId, decoded.iat)) {
      throw new AuthenticationError('Session has been invalidated');
    }

    // 5. Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      podId: decoded.podId,
      managedPods: decoded.managedPods || [],
    };
    
    req.accessToken = token;  // Store for potential logout
    next();
    
  } catch (error) {
    return res.status(401).json({
      status: 'fail',
      code: 'AUTHENTICATION_ERROR',
      message: error.message,
    });
  }
};
```

**Validation Steps Explained:**

| Step | What It Checks | Why |
|------|---------------|-----|
| 1. Extract | `Bearer <token>` format | Standard JWT format |
| 2. Verify | Signature + expiry | Token is valid and not expired |
| 3. Blacklist | Token not in blacklist | User hasn't logged out |
| 4. Invalidation | Token issued after invalidation | User hasn't done "logout all" |
| 5. Attach | Add user to request | Available for route handlers |

---

## 2.5 Token Blacklisting (Logout)

**Location:** `backend/src/middleware/auth.js` (lines 120-160)

```javascript
// Check if token is blacklisted
const isTokenBlacklisted = async (tokenHash) => {
  const result = await query(
    `SELECT 1 FROM access_token_blacklist 
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );
  return result?.rows?.length > 0;
};

// Blacklist a token on logout
const blacklistAccessToken = async (token, userId) => {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return;
  
  const tokenHash = hashToken(token);
  const expiresAt = new Date(decoded.exp * 1000);
  
  await query(
    `INSERT INTO access_token_blacklist (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO NOTHING`,
    [tokenHash, userId, expiresAt]
  );
};
```

**Why Blacklist Instead of Just Revoking Refresh Token?**
- Access token is still valid until expiry (15 min)
- Blacklist ensures immediate logout
- Token can't be used even if attacker has it

---

## 2.6 Logout All Devices

**Location:** `backend/src/middleware/auth.js` (lines 165-185)

```javascript
const blacklistAllUserTokens = async (userId) => {
  // Insert timestamp - all tokens issued BEFORE this are invalid
  await query(
    `INSERT INTO user_token_invalidation (user_id, invalidated_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET invalidated_at = NOW()`,
    [userId]
  );
};

const areUserTokensInvalidated = async (userId, tokenIssuedAt) => {
  const result = await query(
    `SELECT invalidated_at FROM user_token_invalidation 
     WHERE user_id = $1 AND invalidated_at > $2`,
    [userId, new Date(tokenIssuedAt * 1000)]
  );
  return result?.rows?.length > 0;
};
```

**How It Works:**
1. User clicks "Logout All Devices"
2. We store current timestamp in `user_token_invalidation`
3. On every request, we check if token was issued BEFORE that timestamp
4. If yes, token is invalid (even if not expired)

---


# 3. Role-Based Access Control (RBAC)

## Overview

Three user roles with hierarchical permissions:

```
Admin (level 3) > Manager (level 2) > Developer (level 1)
```

**Where Implemented:** `backend/src/middleware/auth.js` (lines 270-350)

---

## 3.1 Role Definitions

```javascript
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  DEVELOPER: 'developer',
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 3,      // Highest - can do everything
  [ROLES.MANAGER]: 2,    // Middle - can approve POD requests
  [ROLES.DEVELOPER]: 1,  // Lowest - can only submit
};
```

---

## 3.2 Authorization Middleware

### Exact Role Check

```javascript
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Must be authenticated first
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      });
    }

    // Check if user's role is in allowed list
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization denied', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      return res.status(403).json({
        status: 'fail',
        code: 'AUTHORIZATION_ERROR',
        message: 'You do not have permission to perform this action',
      });
    }

    next();
  };
};
```

**Usage in Routes:**

```javascript
// Only managers and admins can approve
router.post('/:uuid/approve', 
  authenticate, 
  authorize('manager', 'admin'),  // Exact roles
  approveRequest
);
```

### Minimum Role Check

```javascript
const authorizeMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ... });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ ... });
    }

    next();
  };
};
```

**Usage:**

```javascript
// Anyone with manager level or higher
router.get('/stats', 
  authenticate, 
  authorizeMinRole('manager'),  // Manager OR Admin
  getStats
);
```

---

## 3.3 POD-Based Access Control

Managers can only approve requests from their PODs.

```javascript
const authorizePodAccess = (podIdParam = 'podId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ... });
    }

    // Admins have access to all PODs
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const requestedPodId = req.params[podIdParam] || req.body.podId || req.query.podId;

    if (!requestedPodId) {
      return next();  // No POD specified, allow
    }

    // Check if user manages this POD or belongs to it
    const hasAccess = 
      req.user.podId === requestedPodId ||
      (req.user.managedPods && req.user.managedPods.includes(requestedPodId));

    if (!hasAccess) {
      logger.warn('POD access denied', {
        userId: req.user.id,
        userPodId: req.user.podId,
        managedPods: req.user.managedPods,
        requestedPodId,
      });

      return res.status(403).json({
        status: 'fail',
        code: 'AUTHORIZATION_ERROR',
        message: 'You do not have access to this POD',
      });
    }

    next();
  };
};
```

**How POD Access Works:**

| User Role | User's POD | Managed PODs | Can Access |
|-----------|------------|--------------|------------|
| Developer | pod-1 | [] | Only pod-1 requests |
| Manager | pod-1 | [pod-1, pod-2] | pod-1 and pod-2 requests |
| Admin | any | all | All PODs |

---

# 4. Script Execution Sandbox

## Overview

User scripts run in isolated child processes with:
- Separate memory space from main API
- Auto-injected `db` object for database operations
- 30-second timeout protection
- Captured stdout/stderr as output

**Where Implemented:** `backend/src/services/scriptExecutionService.js`

---

## 4.1 Why Child Process (Not VM2 or eval)?

| Approach | Security | Performance | Why We Didn't Use |
|----------|----------|-------------|-------------------|
| `eval()` | ❌ Dangerous | ✅ Fast | Full access to Node.js process |
| VM2 | ⚠️ CVEs found | ✅ Fast | Deprecated, security vulnerabilities |
| Docker | ✅ Excellent | ❌ Slow startup | Overkill, complex setup |
| **Child Process** | ✅ OS-level isolation | ✅ Good | **Our choice** |

**Benefits of Child Process:**
- True OS-level process isolation (separate memory space)
- Can be killed if it hangs (doesn't block event loop)
- Built into Node.js (no external dependencies with CVEs)
- Better resource control via OS process limits

---

## 4.2 Script Validation

**Location:** `backend/src/services/scriptExecutionService.js` (lines 25-50)

```javascript
function validateScriptSyntax(scriptContent) {
  try {
    // Wrap in async function to allow top-level await
    const wrappedScript = `(async () => { ${scriptContent} })()`;
    new Function(wrappedScript);  // Parse without executing
    return { valid: true };
  } catch (error) {
    return parseSyntaxError(error);
  }
}
```

**Why Validate Before Execution?**
- Catch syntax errors early (better error messages)
- Don't waste resources spawning process for invalid script
- Can show line number of error

### Dangerous Pattern Detection

```javascript
const dangerousPatterns = [
  // BLOCKED - Security risks
  { pattern: /require\s*\(/gi, message: 'require() is not available', isError: true },
  { pattern: /process\./gi, message: 'process object is not accessible', isError: true },
  { pattern: /eval\s*\(/gi, message: 'eval() is blocked', isError: true },
  { pattern: /child_process/gi, message: 'child_process is blocked', isError: true },
  { pattern: /fs\./gi, message: 'fs module is blocked', isError: true },
  
  // WARNINGS - Allowed but risky
  { pattern: /\.dropDatabase\s*\(/gi, message: '🔴 CRITICAL: dropDatabase() detected', isError: false },
  { pattern: /\.deleteMany\s*\(\s*\{\s*\}\s*\)/gi, message: '🔴 CRITICAL: deleteMany({}) detected', isError: false },
];
```

**Why Block These?**

| Pattern | Why Blocked |
|---------|-------------|
| `require()` | Could load any Node.js module |
| `process.` | Access to env vars, exit process |
| `eval()` | Execute arbitrary code |
| `child_process` | Spawn system commands |
| `fs.` | Read/write filesystem |

---

## 4.3 Child Process Execution

**Location:** `backend/src/services/scriptExecutionService.js` (lines 150-230)

```javascript
function executeInChildProcess(config) {
  return new Promise((resolve) => {
    const workerPath = path.join(__dirname, 'scriptWorker.js');
    
    // Fork a new Node.js process
    const child = fork(workerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],  // IPC for messaging
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    });

    let resolved = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!child.killed) child.kill('SIGTERM');
    };

    // Set timeout - kill process if it takes too long
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({
          success: false,
          error: {
            type: 'TimeoutError',
            message: `Script execution timed out after 30 seconds`,
          },
        });
      }
    }, config.timeout + 5000);

    // Handle messages from child process
    child.on('message', (message) => {
      if (message.type === 'ready') {
        // Worker is ready, send the script
        child.send({ type: 'execute', config });
      } else if (message.type === 'result') {
        resolved = true;
        cleanup();
        resolve(message.data);
      }
    });

    // Handle errors
    child.on('error', (error) => {
      resolved = true;
      cleanup();
      resolve({
        success: false,
        error: { type: 'ProcessError', message: error.message },
      });
    });

    // Handle unexpected exit
    child.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({
          success: false,
          error: { type: 'ProcessError', message: `Process exited with code ${code}` },
        });
      }
    });
  });
}
```

**Process Flow:**

```
1. Main Process                    2. Child Process (scriptWorker.js)
   │                                  │
   ├─ fork() ──────────────────────► │ Start
   │                                  │
   │ ◄─────────────── 'ready' ───────┤ Ready to receive script
   │                                  │
   ├─ send(script) ────────────────► │ Receive script
   │                                  │
   │                                  ├─ Connect to DB
   │                                  ├─ Execute script
   │                                  ├─ Capture output
   │                                  │
   │ ◄─────────────── 'result' ──────┤ Send results
   │                                  │
   ├─ kill() ──────────────────────► │ Terminate
```

---

## 4.4 The Script Worker

**Location:** `backend/src/services/scriptWorker.js`

```javascript
// This runs in a separate process!

process.on('message', async (message) => {
  if (message.type === 'execute') {
    const { scriptContent, databaseType, instance, databaseName } = message.config;
    
    try {
      // 1. Create database connection
      const db = await createDbConnection(databaseType, instance, databaseName);
      
      // 2. Create sandbox with only allowed objects
      const sandbox = {
        db,                    // Injected database connection
        console: capturedConsole,  // Captured for output
        setTimeout,            // Limited async
        Promise, JSON, Math, Date,  // Safe built-ins
      };
      
      // 3. Execute script in sandbox
      const vm = require('vm');
      const context = vm.createContext(sandbox);
      
      // Wrap in async function to allow await
      const wrappedScript = `(async () => { ${scriptContent} })()`;
      await vm.runInContext(wrappedScript, context, { timeout: 30000 });
      
      // 4. Send results back to main process
      process.send({
        type: 'result',
        data: { success: true, output: capturedOutput },
      });
      
    } catch (error) {
      process.send({
        type: 'result',
        data: { success: false, error: { message: error.message } },
      });
    }
  }
});

// Signal ready
process.send({ type: 'ready' });
```

**What Users Can Access in Their Scripts:**

| Object | Available | Example |
|--------|-----------|---------|
| `db` | ✅ Yes | `await db.query('SELECT * FROM users')` |
| `console.log` | ✅ Yes | `console.log(result)` |
| `Promise` | ✅ Yes | `await Promise.all([...])` |
| `JSON` | ✅ Yes | `JSON.stringify(data)` |
| `require` | ❌ No | Blocked |
| `process` | ❌ No | Blocked |
| `fs` | ❌ No | Blocked |

---


# 5. Request Approval Workflow

## Overview

A state machine workflow for query requests:

```
PENDING → APPROVED → EXECUTING → COMPLETED
                              ↘ FAILED
       ↘ REJECTED
```

**Where Implemented:** 
- `backend/src/models/QueryRequest.js` - State transitions
- `backend/src/controllers/queryController.js` - Workflow logic

---

## 5.1 Status Constants

**Location:** `backend/src/models/QueryRequest.js`

```javascript
const RequestStatus = {
  PENDING: 'pending',       // Awaiting manager approval
  APPROVED: 'approved',     // Manager approved, ready to execute
  REJECTED: 'rejected',     // Manager rejected
  EXECUTING: 'executing',   // Currently running
  COMPLETED: 'completed',   // Successfully executed
  FAILED: 'failed',         // Execution error
};
```

---

## 5.2 State Transitions

### Submit Request (→ PENDING)

```javascript
const create = async (data) => {
  const result = await query(`
    INSERT INTO query_requests (
      user_id, database_type, instance_id, instance_name, database_name,
      submission_type, query_content, script_filename, script_content,
      comments, pod_id, pod_name, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
    RETURNING *
  `, [data.userId, data.databaseType, ...]);
  
  return result.rows[0];
};
```

### Approve Request (PENDING → APPROVED)

```javascript
const approve = async (id, approverId, approverEmail) => {
  const result = await query(`
    UPDATE query_requests 
    SET status = 'approved',
        approver_id = $1,
        approver_email = $2,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = $3 AND status = 'pending'  -- Can only approve PENDING
    RETURNING *
  `, [approverId, approverEmail, id]);
  
  return result.rows[0];
};
```

### Mark Executing (APPROVED → EXECUTING)

```javascript
const markExecuting = async (id) => {
  await query(`
    UPDATE query_requests 
    SET status = 'executing',
        execution_started_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [id]);
};
```

### Mark Completed (EXECUTING → COMPLETED)

```javascript
const markCompleted = async (id, result) => {
  await query(`
    UPDATE query_requests 
    SET status = 'completed',
        execution_result = $1,
        execution_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $2
  `, [result, id]);
};
```

### Mark Failed (EXECUTING → FAILED)

```javascript
const markFailed = async (id, error) => {
  await query(`
    UPDATE query_requests 
    SET status = 'failed',
        execution_error = $1,
        execution_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $2
  `, [error, id]);
};
```

---

## 5.3 Approval Controller Logic

**Location:** `backend/src/controllers/queryController.js` (approveRequest function)

```javascript
const approveRequest = async (req, res) => {
  const { uuid } = req.params;
  const user = req.user;

  // 1. Find request by UUID (secure - no enumeration)
  const queryRequest = await QueryRequest.findByUuid(uuid);
  
  if (!queryRequest) {
    return response.error(res, 'Request not found', 404);
  }

  // 2. Verify request is PENDING
  if (queryRequest.status !== RequestStatus.PENDING) {
    return response.error(res, 'Request is not pending approval', 400);
  }

  // 3. Verify manager has access to this POD
  if (user.role === 'manager') {
    const managedPods = getPodsByManager(user.email);
    const podIds = managedPods.map(p => p.id);
    
    if (!podIds.includes(queryRequest.podId)) {
      return response.error(res, 'Not authorized to approve this request', 403);
    }
  }

  // 4. Approve the request
  let approvedRequest = await QueryRequest.approve(queryRequest.id, user.id, user.email);

  // 5. Execute the query/script
  try {
    await QueryRequest.markExecuting(queryRequest.id);

    let result;
    if (queryRequest.submissionType === 'query') {
      result = await queryExecutionService.executeQuery(queryRequest);
    } else {
      result = await scriptExecutionService.executeScript(queryRequest);
    }

    // 6. Check if execution succeeded
    if (result.success === false) {
      // Mark as FAILED
      approvedRequest = await QueryRequest.markFailed(queryRequest.id, result.error?.message);
      await slackService.notifyApprovalSuccess(approvedRequest, JSON.stringify(result));
      return response.success(res, approvedRequest, 'Request approved but execution failed');
    }

    // 7. Mark as COMPLETED
    approvedRequest = await QueryRequest.markCompleted(queryRequest.id, JSON.stringify(result));
    await slackService.notifyApprovalSuccess(approvedRequest, JSON.stringify(result));
    
    return response.success(res, approvedRequest, 'Request approved and executed successfully');

  } catch (error) {
    // 8. Handle execution errors
    approvedRequest = await QueryRequest.markFailed(queryRequest.id, error.message);
    await slackService.notifyApprovalFailure(approvedRequest, error.message);
    
    return response.success(res, approvedRequest, 'Request approved but execution failed');
  }
};
```

**Why This Flow?**

| Step | Why |
|------|-----|
| UUID lookup | Prevents enumeration attacks |
| Status check | Can't approve already-approved requests |
| POD check | Managers only approve their PODs |
| Mark executing | Shows real-time status |
| Check result.success | Script can return success:false |
| Slack notification | Requester knows immediately |

---

# 6. Slack Integration

## Overview

Real-time notifications via Slack:
- **Channel**: New submissions to approval channel
- **DM**: Results/rejections to requester

**Where Implemented:** `backend/src/services/slackService.js`

---

## 6.1 Notification Types

| Event | Recipient | Content |
|-------|-----------|---------|
| New submission | POD channel | Request ID, requester, query preview |
| Approved + Success | Requester DM | Row counts, data preview |
| Approved + Failed | Requester DM | Error type, line number, reason |
| Rejected | Requester DM | Rejection reason |

---

## 6.2 Message Formatting

### Success Message Format

```javascript
const formatExecutionResult = (resultStr) => {
  const result = JSON.parse(resultStr);
  
  // Check if execution failed
  if (result.success === false) {
    return {
      success: false,
      error: {
        type: result.error?.type || 'Error',
        message: result.error?.message || 'Execution failed',
        line: result.error?.line || null,
      },
    };
  }
  
  // Build summary from output
  let totalRowsFetched = 0;
  let totalRowsAffected = 0;
  
  for (const item of result.output || []) {
    if (item.type === 'query') {
      if (item.queryType === 'SELECT') {
        totalRowsFetched += item.rowCount || 0;
      } else {
        totalRowsAffected += item.rowCount || 0;
      }
    }
  }
  
  // Format: "📊 15 rows fetched | ✏️ 3 rows affected"
  const parts = [];
  if (totalRowsFetched > 0) parts.push(`📊 ${totalRowsFetched} row(s) fetched`);
  if (totalRowsAffected > 0) parts.push(`✏️ ${totalRowsAffected} row(s) affected`);
  
  return {
    success: true,
    summary: parts.join(' | ') || 'Execution completed',
    preview: formatPreview(result),  // First 3 rows
    duration: result.duration,
  };
};
```

### Error Message Format

```javascript
const formatErrorMessage = (errorMessage) => {
  let errorType = 'Error';
  let line = null;
  let cleanMessage = errorMessage;
  
  // Extract error type
  const typeMatch = errorMessage.match(/^(SyntaxError|TypeError|DatabaseError):/i);
  if (typeMatch) {
    errorType = typeMatch[1];
    cleanMessage = errorMessage.substring(typeMatch[0].length).trim();
  }
  
  // Extract line number
  const lineMatch = errorMessage.match(/line\s*(\d+)/i);
  if (lineMatch) {
    line = parseInt(lineMatch[1]);
  }
  
  return { type: errorType, message: cleanMessage, line };
};
```

---

## 6.3 Sending Notifications

### New Submission Notification

```javascript
const notifyNewSubmission = async (request) => {
  await slackClient.chat.postMessage({
    channel: config.slack.approvalChannel,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🗄️ New Query Request' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Request ID:*\n#${request.id}` },
          { type: 'mrkdwn', text: `*Requester:*\n${request.userEmail}` },
          { type: 'mrkdwn', text: `*Database:*\n${request.instanceName}` },
          { type: 'mrkdwn', text: `*POD:*\n${request.podName}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Query Preview:*\n\`${truncate(request.queryContent, 100)}\`` },
      },
    ],
  });
};
```

### DM to Requester

```javascript
const sendDirectMessage = async (userId, blocks, text) => {
  // Open DM channel
  const result = await slackClient.conversations.open({ users: userId });
  
  if (result.ok && result.channel) {
    await slackClient.chat.postMessage({
      channel: result.channel.id,
      blocks,
      text,  // Fallback for notifications
    });
  }
};
```

---

# 7. Database Schema Design

## Overview

10 tables organized by purpose:
- **Core**: users, query_requests, pods
- **Auth**: refresh_tokens, access_token_blacklist, user_token_invalidation
- **Config**: database_instances, databases
- **Tracking**: slack_notifications, audit_logs

**Where Implemented:** `backend/portal_db_schema.sql`

---

## 7.1 Key Design Decisions

### UUID for External References

```sql
CREATE TABLE query_requests (
    id SERIAL PRIMARY KEY,                    -- Internal: fast, sequential
    uuid UUID UNIQUE DEFAULT gen_random_uuid(), -- External: secure, random
    ...
);
```

**Why Two IDs?**
- `id`: Fast for JOINs, indexes, internal operations
- `uuid`: Secure for API URLs (can't guess `/requests/2`, `/requests/3`)

### Status as CHECK Constraint

```sql
status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed'))
```

**Why CHECK Constraint?**
- Database enforces valid values
- Can't accidentally set invalid status
- Self-documenting schema

### Timestamps for Audit Trail

```sql
approved_at TIMESTAMP WITH TIME ZONE,
execution_started_at TIMESTAMP WITH TIME ZONE,
execution_completed_at TIMESTAMP WITH TIME ZONE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

**Why All These Timestamps?**
- `approved_at`: When manager approved
- `execution_started_at`: When execution began
- `execution_completed_at`: When execution finished
- Duration = `execution_completed_at - execution_started_at`

---

# 8. Error Handling

## Overview

Consistent error handling across the application:
- Custom error classes
- Global error handler
- Structured error responses

**Where Implemented:** 
- `backend/src/utils/errors.js` - Error classes
- `backend/src/middleware/errorHandler.js` - Global handler
- `backend/src/utils/response.js` - Response formatters

---

## 8.1 Custom Error Classes

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.code = 'AUTHENTICATION_ERROR';
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.code = 'AUTHORIZATION_ERROR';
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}
```

**Why Custom Errors?**
- Consistent status codes
- Machine-readable error codes
- Easy to catch specific error types

---

## 8.2 Global Error Handler

```javascript
const errorHandler = (err, req, res, next) => {
  // Log error with context
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  // Don't leak internal errors in production
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
};
```

---

# 9. Testing Strategy

## Overview

100% branch coverage achieved with:
- Unit tests for all functions
- Mock implementations for external services
- Integration tests for API endpoints

**Where Implemented:** `backend/tests/`

---

## 9.1 Mocking Strategy

```javascript
// Mock database
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
}));

// Mock Slack
jest.mock('../src/services/slackService', () => ({
  notifyNewSubmission: jest.fn().mockResolvedValue(true),
  notifyApprovalSuccess: jest.fn().mockResolvedValue(true),
  notifyApprovalFailure: jest.fn().mockResolvedValue(true),
  notifyRejection: jest.fn().mockResolvedValue(true),
}));
```

**Why Mock?**
- Tests run without real database
- No Slack messages sent during tests
- Deterministic results
- Fast execution

---

## 9.2 Test Example

```javascript
describe('POST /api/requests/:uuid/approve', () => {
  it('should approve a pending request', async () => {
    // Arrange
    const mockRequest = {
      id: 1,
      uuid: 'abc-123',
      status: 'pending',
      podId: 'pod-1',
      submissionType: 'query',
    };
    
    db.query
      .mockResolvedValueOnce({ rows: [mockRequest] })  // findByUuid
      .mockResolvedValueOnce({ rows: [{ ...mockRequest, status: 'approved' }] })  // approve
      .mockResolvedValueOnce({ rows: [] })  // markExecuting
      .mockResolvedValueOnce({ rows: [{ ...mockRequest, status: 'completed' }] });  // markCompleted
    
    queryExecutionService.executeQuery.mockResolvedValue({
      success: true,
      rows: [{ id: 1 }],
    });
    
    // Act
    const response = await request(app)
      .post('/api/requests/abc-123/approve')
      .set('Authorization', `Bearer ${managerToken}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(slackService.notifyApprovalSuccess).toHaveBeenCalled();
  });
  
  it('should return 400 for non-pending request', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, uuid: 'abc-123', status: 'approved' }],  // Already approved
    });
    
    const response = await request(app)
      .post('/api/requests/abc-123/approve')
      .set('Authorization', `Bearer ${managerToken}`);
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('not pending');
  });
});
```

---

# Summary: Quick Reference

| Feature | Why | Where |
|---------|-----|-------|
| Helmet.js | Security headers (XSS, clickjacking) | `server.js:38-47` |
| CORS | Control allowed origins | `server.js:50-67` |
| Rate Limiting | Prevent brute force/DDoS | `server.js:69-97` |
| HPP | Prevent parameter pollution | `server.js:100` |
| XSS Clean | Sanitize input | `server.js:103` |
| JWT Access Token | Short-lived auth (15 min) | `middleware/auth.js:45-70` |
| JWT Refresh Token | Long-lived session (7 days) | `middleware/auth.js:72-95` |
| Token Blacklist | Immediate logout | `middleware/auth.js:120-160` |
| RBAC | Role-based permissions | `middleware/auth.js:270-350` |
| Child Process | Isolated script execution | `services/scriptExecutionService.js` |
| State Machine | Request workflow | `models/QueryRequest.js` |
| Slack Integration | Real-time notifications | `services/slackService.js` |
| UUID External IDs | Prevent enumeration | `models/QueryRequest.js` |
| 100% Test Coverage | Quality assurance | `tests/*.test.js` |


---

# 10. Database Schema Deep Dive

## Overview: Two Database Types

Our system uses **two types of databases**:

| Database Type | Purpose | Who Manages It |
|---------------|---------|----------------|
| **Portal DB** | Stores users, requests, auth tokens | Our application |
| **Target DBs** | Customer/application databases users query | External systems |

```
┌─────────────────────────────────────────────────────────────────┐
│                        Our Application                          │
│  ┌─────────────────┐                    ┌──────────────────┐   │
│  │   Portal DB     │                    │   Target DBs     │   │
│  │  (PostgreSQL)   │                    │ (PG / MongoDB)   │   │
│  │                 │                    │                  │   │
│  │  • users        │    Executes        │  • customer_db   │   │
│  │  • requests     │ ──────────────────►│  • analytics_db  │   │
│  │  • tokens       │    queries on      │  • orders_db     │   │
│  │  • audit_logs   │                    │  • etc...        │   │
│  └─────────────────┘                    └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Why Separate?**
- Portal DB stores our application data (users, requests)
- Target DBs are the databases users want to query
- We NEVER store target DB credentials in Portal DB (security)
- Target DBs can be PostgreSQL OR MongoDB

---

# 10.1 Portal Database Schema

## Table Overview

```
Portal DB (10 tables)
├── Core Tables
│   ├── users              → User accounts
│   ├── query_requests     → All submissions
│   └── pods               → Team configurations
├── Authentication Tables
│   ├── refresh_tokens     → Session management
│   ├── access_token_blacklist → Revoked tokens
│   └── user_token_invalidation → Logout-all support
├── Database Configuration
│   ├── database_instances → Target DB configs
│   └── databases          → Available databases
└── Tracking Tables
    ├── slack_notifications → Notification history
    └── audit_logs         → Action history
```

---

## 10.1.1 `users` Table

### Purpose
Stores all user accounts with authentication and authorization data.

### Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'developer' 
        CHECK (role IN ('developer', 'manager', 'admin')),
    pod_id VARCHAR(50),
    slack_user_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Column Explanations

| Column | Type | Why This Type | Why We Need It |
|--------|------|---------------|----------------|
| `id` | UUID | Prevents enumeration attacks | Unique identifier for each user |
| `email` | VARCHAR(255) UNIQUE | Standard email length, must be unique | Login identifier, notifications |
| `password_hash` | VARCHAR(255) | bcrypt hashes are ~60 chars | Never store plain passwords |
| `name` | VARCHAR(255) | Display name | Show in UI, Slack messages |
| `role` | VARCHAR(20) + CHECK | Enforces valid values | RBAC - determines permissions |
| `pod_id` | VARCHAR(50) | References POD | Which team user belongs to |
| `slack_user_id` | VARCHAR(50) | Slack user ID format | Send DM notifications |
| `is_active` | BOOLEAN | Soft delete flag | Disable without deleting |
| `last_login` | TIMESTAMP | Track activity | Security auditing |
| `created_at` | TIMESTAMP | Auto-set on insert | Audit trail |
| `updated_at` | TIMESTAMP | Auto-updated via trigger | Track changes |

### Why UUID for `id`?

```
❌ Sequential ID: /api/users/1, /api/users/2, /api/users/3
   → Attacker can enumerate all users

✅ UUID: /api/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890
   → Impossible to guess other user IDs
```

### Why `role` CHECK Constraint?

```sql
CHECK (role IN ('developer', 'manager', 'admin'))
```

- Database enforces valid values
- Can't accidentally set `role = 'superuser'`
- Self-documenting schema
- No need for separate `roles` table (only 3 roles)

### Indexes

```sql
CREATE INDEX idx_users_email ON users(email);      -- Fast login lookup
CREATE INDEX idx_users_role ON users(role);        -- Filter by role
CREATE INDEX idx_users_pod_id ON users(pod_id);    -- Filter by POD
CREATE INDEX idx_users_is_active ON users(is_active); -- Filter active users
```

---

## 10.1.2 `query_requests` Table

### Purpose
The **core table** - stores all query/script submissions with complete lifecycle tracking.

### Schema

```sql
CREATE TABLE query_requests (
    -- Identity
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    
    -- Submitter
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Target Database
    database_type VARCHAR(20) NOT NULL CHECK (database_type IN ('postgresql', 'mongodb')),
    instance_id VARCHAR(100) NOT NULL,
    instance_name VARCHAR(255) NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    
    -- Submission Content
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('query', 'script')),
    query_content TEXT,
    script_filename VARCHAR(255),
    script_content TEXT,
    
    -- Metadata
    comments TEXT NOT NULL,
    pod_id VARCHAR(50) NOT NULL,
    pod_name VARCHAR(100) NOT NULL,
    
    -- Status Tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed')),
    
    -- Approval Info
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approver_email VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Execution Results
    execution_result TEXT,
    execution_error TEXT,
    execution_started_at TIMESTAMP WITH TIME ZONE,
    execution_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Column Explanations

#### Identity Columns

| Column | Why We Need It |
|--------|----------------|
| `id` (SERIAL) | Internal operations, JOINs, fast indexing |
| `uuid` (UUID) | External API references, prevents enumeration |

**Why Both?**
```javascript
// Internal: Fast integer operations
SELECT * FROM query_requests WHERE id = 123;

// External API: Secure, no enumeration
GET /api/requests/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### Target Database Columns

| Column | Why We Need It |
|--------|----------------|
| `database_type` | Know if PostgreSQL or MongoDB (different execution) |
| `instance_id` | Which server to connect to |
| `instance_name` | Display name (human readable) |
| `database_name` | Which database on that server |

**Why Store Both `instance_id` AND `instance_name`?**
- `instance_id`: For code logic (lookup config)
- `instance_name`: For display (UI, Slack messages)
- If instance is renamed, historical records still show original name

#### Submission Content Columns

| Column | When Used |
|--------|-----------|
| `submission_type` | Always - 'query' or 'script' |
| `query_content` | When `submission_type = 'query'` |
| `script_filename` | When `submission_type = 'script'` |
| `script_content` | When `submission_type = 'script'` |

**Why Nullable `query_content` and `script_content`?**
```sql
-- Query submission: only query_content is set
INSERT INTO query_requests (submission_type, query_content, script_filename, script_content)
VALUES ('query', 'SELECT * FROM users', NULL, NULL);

-- Script submission: only script fields are set
INSERT INTO query_requests (submission_type, query_content, script_filename, script_content)
VALUES ('script', NULL, 'update_users.js', 'const result = await db.query(...)');
```

#### Status Tracking

| Status | Meaning | Next States |
|--------|---------|-------------|
| `pending` | Awaiting approval | approved, rejected |
| `approved` | Manager approved | executing |
| `rejected` | Manager rejected | (terminal) |
| `executing` | Currently running | completed, failed |
| `completed` | Success | (terminal) |
| `failed` | Error occurred | (terminal) |

**Why CHECK Constraint?**
```sql
CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed'))
```
- Database enforces valid transitions
- Can't set `status = 'unknown'`
- Self-documenting

#### Approval Columns

| Column | Why We Need It |
|--------|----------------|
| `approver_id` | FK to user who approved/rejected |
| `approver_email` | Denormalized for display (avoid JOIN) |
| `approved_at` | When approval happened |
| `rejection_reason` | Why manager rejected |

**Why Store `approver_email` (Denormalized)?**
- Avoid JOIN when displaying approval info
- If approver account is deleted, we still have email
- Historical accuracy

#### Execution Columns

| Column | Why We Need It |
|--------|----------------|
| `execution_result` | JSON string of query results |
| `execution_error` | Error message if failed |
| `execution_started_at` | When execution began |
| `execution_completed_at` | When execution finished |

**Why TEXT for Results?**
- Results can be large (thousands of rows)
- JSON format (flexible structure)
- TEXT has no length limit in PostgreSQL

### Foreign Key Relationships

```sql
user_id UUID REFERENCES users(id) ON DELETE SET NULL
approver_id UUID REFERENCES users(id) ON DELETE SET NULL
```

**Why `ON DELETE SET NULL`?**
- If user is deleted, we keep the request history
- `user_id = NULL` means "deleted user"
- Alternative `ON DELETE CASCADE` would delete all user's requests

### Indexes

```sql
CREATE INDEX idx_query_requests_uuid ON query_requests(uuid);        -- API lookups
CREATE INDEX idx_query_requests_user_id ON query_requests(user_id);  -- "My requests"
CREATE INDEX idx_query_requests_status ON query_requests(status);    -- Filter by status
CREATE INDEX idx_query_requests_pod_id ON query_requests(pod_id);    -- POD filtering
CREATE INDEX idx_query_requests_created_at ON query_requests(created_at DESC); -- Recent first
```

---

## 10.1.3 `pods` Table

### Purpose
Stores team/POD configurations for approval routing.

### Schema

```sql
CREATE TABLE pods (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    manager_email VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Column Explanations

| Column | Why We Need It |
|--------|----------------|
| `id` | Short identifier (e.g., 'pod-1', 'de', 'sre') |
| `name` | Display name (e.g., 'Pod 1', 'Data Engineering') |
| `manager_email` | Who approves requests for this POD |
| `description` | What this POD does |
| `is_active` | Soft delete |

**Why `manager_email` Instead of `manager_id`?**
- Manager might not have account yet
- Easier to configure (just email)
- Can have multiple managers (comma-separated or separate table)

---

## 10.1.4 Authentication Tables

### `refresh_tokens` Table

```sql
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Why We Need It |
|--------|----------------|
| `user_id` | Which user owns this token |
| `token_hash` | SHA-256 hash (never store plain token!) |
| `device_info` | "Chrome on Windows" - for session management UI |
| `ip_address` | Security auditing |
| `expires_at` | When token expires (7 days) |
| `is_revoked` | Soft revoke (logout) |
| `revoked_at` | When revoked |

**Why `ON DELETE CASCADE`?**
- If user is deleted, delete all their tokens
- No orphan tokens

### `access_token_blacklist` Table

```sql
CREATE TABLE access_token_blacklist (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(50) DEFAULT 'logout'
);
```

**Why This Table?**
- Access tokens are stateless (JWT)
- Can't "revoke" a JWT - it's valid until expiry
- Blacklist = check if token was logged out
- Auto-cleanup: delete entries after `expires_at`

### `user_token_invalidation` Table

```sql
CREATE TABLE user_token_invalidation (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    invalidated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Why This Table?**
- "Logout from all devices" feature
- Stores timestamp when user clicked "logout all"
- Any token issued BEFORE this timestamp is invalid
- One row per user (PRIMARY KEY on user_id)

---

## 10.1.5 Database Configuration Tables

### `database_instances` Table

```sql
CREATE TABLE database_instances (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('postgresql', 'mongodb')),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    description TEXT,
    credentials_env_prefix VARCHAR(100),
    connection_string_env VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20),
    last_sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Why We Need It |
|--------|----------------|
| `id` | Unique identifier (e.g., 'database-1') |
| `name` | Display name |
| `type` | 'postgresql' or 'mongodb' |
| `host` | Server hostname |
| `port` | Server port |
| `credentials_env_prefix` | Points to env vars (NOT actual credentials!) |
| `connection_string_env` | For MongoDB Atlas (connection string in env var) |
| `last_sync_*` | Track database discovery sync |

**Why `credentials_env_prefix` Instead of Actual Credentials?**
```
❌ WRONG: Store password in database
   password = 'secret123'

✅ RIGHT: Store env var prefix
   credentials_env_prefix = 'PG_INSTANCE_1'
   
   Then in .env:
   PG_INSTANCE_1_USER=admin
   PG_INSTANCE_1_PASSWORD=secret123
```

- Credentials never in database
- If database is compromised, no passwords leaked
- Easy to rotate credentials (just change env var)

### `databases` Table

```sql
CREATE TABLE databases (
    id SERIAL PRIMARY KEY,
    instance_id VARCHAR(100) NOT NULL REFERENCES database_instances(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(20) DEFAULT 'synced' CHECK (source IN ('synced', 'manual')),
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(instance_id, name)
);
```

| Column | Why We Need It |
|--------|----------------|
| `instance_id` | Which server this database is on |
| `name` | Database name (e.g., 'customer_db') |
| `source` | 'synced' (auto-discovered) or 'manual' (added by admin) |
| `last_seen_at` | When last seen during sync (detect deleted DBs) |

**Why Separate from `database_instances`?**
- One instance can have MANY databases
- Normalized design (no repeating instance info)
- Can track each database independently

**Relationship:**
```
database_instances (1) ──────< (many) databases
     │                              │
     │ id = 'database-1'            │ instance_id = 'database-1'
     │ name = 'Production PG'       │ name = 'customer_db'
     │ host = 'prod.db.com'         │ name = 'analytics_db'
     │                              │ name = 'orders_db'
```

---

## 10.1.6 Tracking Tables

### `slack_notifications` Table

```sql
CREATE TABLE slack_notifications (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES query_requests(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL 
        CHECK (notification_type IN ('new_submission', 'approval', 'rejection', 'execution_success', 'execution_failure')),
    channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('channel', 'dm')),
    recipient VARCHAR(255) NOT NULL,
    message_ts VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);
```

**Why This Table?**
- Track all notifications sent
- Retry failed notifications
- Audit trail (who was notified when)
- Debug notification issues

### `audit_logs` Table

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Why We Need It |
|--------|----------------|
| `action` | What happened ('create', 'update', 'delete', 'approve') |
| `entity_type` | What was affected ('query_request', 'user') |
| `entity_id` | Which record |
| `old_values` | Previous state (JSONB for flexibility) |
| `new_values` | New state |
| `ip_address` | Where request came from |
| `user_agent` | Browser/client info |

**Why JSONB for Values?**
- Different entities have different fields
- No need for separate audit tables per entity
- Can query JSON in PostgreSQL

---

# 10.2 Target Database Schema (Example)

Target databases are NOT part of our application - they're the databases users want to query. Here's an example structure:

### `customer_db` Example

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0
);

-- Order items (junction table)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL
);
```

**Relationships:**
```
users (1) ──────< (many) orders
                      │
                      │ (1)
                      │
                      ▼
              order_items (many)
                      │
                      │ (many)
                      │
                      ▼
               products (1)
```

---

# 10.3 Why Separate Portal DB and Target DBs?

| Aspect | Portal DB | Target DBs |
|--------|-----------|------------|
| **Purpose** | Our application data | Customer data to query |
| **Who manages** | Us | External teams |
| **Credentials** | In our env vars | In AWS Secrets Manager |
| **Schema changes** | We control | We don't control |
| **Data sensitivity** | User accounts, tokens | Customer PII, business data |

**Security Reasons:**
1. **Isolation**: If Portal DB is compromised, target DBs are safe
2. **Credentials**: Target DB creds never stored in Portal DB
3. **Access control**: Different permissions for each
4. **Audit**: Clear separation of what we access vs what users access

---

# 10.4 Foreign Key Relationships Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Portal DB Relationships                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  users ─────────────────┬──────────────────┬─────────────────────────   │
│    │                    │                  │                             │
│    │ (1:many)           │ (1:many)         │ (1:many)                    │
│    ▼                    ▼                  ▼                             │
│  query_requests    refresh_tokens    access_token_blacklist              │
│    │                                                                     │
│    │ (1:many)                                                            │
│    ▼                                                                     │
│  slack_notifications                                                     │
│                                                                          │
│  database_instances ────────────────────────────────────────────────    │
│    │                                                                     │
│    │ (1:many)                                                            │
│    ▼                                                                     │
│  databases                                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Relationship Details

| Parent | Child | Relationship | ON DELETE |
|--------|-------|--------------|-----------|
| users | query_requests (user_id) | 1:many | SET NULL |
| users | query_requests (approver_id) | 1:many | SET NULL |
| users | refresh_tokens | 1:many | CASCADE |
| users | access_token_blacklist | 1:many | CASCADE |
| users | user_token_invalidation | 1:1 | CASCADE |
| users | audit_logs | 1:many | SET NULL |
| query_requests | slack_notifications | 1:many | CASCADE |
| database_instances | databases | 1:many | CASCADE |

### Why Different ON DELETE Actions?

| Action | When to Use | Example |
|--------|-------------|---------|
| `CASCADE` | Child has no meaning without parent | Delete user → delete their tokens |
| `SET NULL` | Keep child for history | Delete user → keep their requests (user_id = NULL) |
| `RESTRICT` | Prevent deletion if children exist | Can't delete instance with databases |

---

# 10.5 Indexes Strategy

### Why We Index These Columns

| Table | Index | Why |
|-------|-------|-----|
| users | email | Login lookup (every request) |
| users | role | Filter by role |
| users | pod_id | Filter by POD |
| query_requests | uuid | API lookups (every request) |
| query_requests | user_id | "My requests" query |
| query_requests | status | Filter pending/completed |
| query_requests | pod_id | Manager's POD requests |
| query_requests | created_at DESC | Recent first |
| refresh_tokens | token_hash | Token validation |
| refresh_tokens | user_id | User's sessions |
| access_token_blacklist | token_hash | Blacklist check |

### Index Types Used

```sql
-- B-tree (default): Equality and range queries
CREATE INDEX idx_users_email ON users(email);

-- Descending: For "ORDER BY created_at DESC"
CREATE INDEX idx_requests_created_at ON query_requests(created_at DESC);

-- Composite: Multiple columns together
CREATE INDEX idx_tokens_active ON refresh_tokens(user_id, is_revoked, expires_at);
```

---

This completes the database schema deep dive, explaining every table, column, relationship, and design decision in our Portal DB and how it relates to Target DBs.


---

# 11. Why Raw `pg` Instead of Prisma/ORM

## Overview

We use the raw `pg` (node-postgres) library instead of an ORM like Prisma, Sequelize, or TypeORM.

**Where Implemented:** 
- `backend/src/config/database.js` - Connection pool
- `backend/src/models/*.js` - Raw SQL queries

---

## 11.1 Comparison: Raw pg vs ORMs

| Aspect | Raw `pg` | Prisma/Sequelize/TypeORM |
|--------|----------|--------------------------|
| **Learning curve** | Know SQL = ready to go | Learn ORM syntax + SQL |
| **Query control** | Full control | ORM decides query structure |
| **Performance** | Optimal (you write the query) | Can generate inefficient queries |
| **Debugging** | See exact SQL | Must decode ORM → SQL |
| **Bundle size** | ~50KB (pg only) | 5-15MB (Prisma client) |
| **Migrations** | Manual SQL files | Auto-generated |
| **Type safety** | Manual | Auto-generated types (Prisma) |
| **Complex queries** | Easy (just SQL) | Often need raw SQL anyway |

---

## 11.2 Why Raw `pg` is Better for Our Use Case

### Reason 1: We Execute User Queries

Our core feature is **executing user-submitted SQL queries**. We MUST understand SQL deeply.

```javascript
// Our use case: Execute whatever the user submits
const result = await db.query(userSubmittedQuery);

// If we used Prisma, we'd still need raw SQL for this!
const result = await prisma.$queryRawUnsafe(userSubmittedQuery);
```

**Using an ORM for our own queries while executing raw SQL for users would be inconsistent.**

### Reason 2: Full Query Control

We need precise control over queries for performance and security.

```javascript
// Raw pg: Exact query we want
const result = await query(`
  SELECT qr.*, u.email as user_email, u.name as user_name
  FROM query_requests qr
  LEFT JOIN users u ON qr.user_id = u.id
  WHERE qr.pod_id = ANY($1)
    AND qr.status = $2
  ORDER BY qr.created_at DESC
  LIMIT $3 OFFSET $4
`, [podIds, status, limit, offset]);

// Prisma: ORM decides the query
const result = await prisma.queryRequest.findMany({
  where: { podId: { in: podIds }, status },
  include: { user: { select: { email: true, name: true } } },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: offset,
});
// What SQL does this generate? You have to check.
```

### Reason 3: No ORM Overhead

ORMs add abstraction layers that can hurt performance.

```
Raw pg:
  Your Code → pg driver → PostgreSQL
  
Prisma:
  Your Code → Prisma Client → Query Engine (Rust binary) → pg driver → PostgreSQL
```

**For a query portal handling many requests, every millisecond matters.**

### Reason 4: Simpler Debugging

When something goes wrong, we see the exact SQL.

```javascript
// Raw pg: Error shows exact query
logger.error('Query failed', { 
  sql: 'SELECT * FROM users WHERE id = $1',
  params: [userId],
  error: error.message 
});

// Prisma: Error shows Prisma operation, must decode to SQL
// PrismaClientKnownRequestError: Invalid `prisma.user.findUnique()` invocation
```

### Reason 5: No Migration Complexity

ORMs require migration tools that can conflict with manual schema changes.

```bash
# Prisma workflow
npx prisma migrate dev --name add_column
npx prisma generate
# If schema.prisma doesn't match DB, things break

# Our workflow
# 1. Write SQL migration
# 2. Run it
# 3. Done
```

### Reason 6: Smaller Bundle Size

```
pg package:           ~50 KB
Prisma client:        ~5-15 MB (includes Rust query engine)
Sequelize:            ~2 MB
TypeORM:              ~3 MB
```

**For serverless/containerized deployments, smaller = faster cold starts.**

### Reason 7: No Schema Sync Issues

ORMs require schema definitions that must match the database.

```javascript
// Prisma: Must keep schema.prisma in sync
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  // Forgot to add new column? Runtime error!
}

// Raw pg: Query what exists
const result = await query('SELECT * FROM users WHERE id = $1', [id]);
// New column? It's in the result automatically.
```

---

## 11.3 Our Implementation Pattern

### Database Connection Pool

**Location:** `backend/src/config/database.js`

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                    // Max connections in pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't connect
});

// Wrapper function for queries
const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  logger.debug('Executed query', { 
    text, 
    duration, 
    rows: result.rowCount 
  });
  
  return result;
};

module.exports = { pool, query };
```

### Model Pattern

**Location:** `backend/src/models/QueryRequest.js`

```javascript
const { query } = require('../config/database');

const QueryRequest = {
  // Create
  create: async (data) => {
    const result = await query(`
      INSERT INTO query_requests (
        user_id, database_type, instance_id, instance_name,
        database_name, submission_type, query_content, comments,
        pod_id, pod_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      RETURNING *
    `, [
      data.userId, data.databaseType, data.instanceId, data.instanceName,
      data.databaseName, data.submissionType, data.queryContent, data.comments,
      data.podId, data.podName
    ]);
    return result.rows[0];
  },

  // Read by UUID (secure)
  findByUuid: async (uuid) => {
    const result = await query(`
      SELECT qr.*, 
             u.email as user_email, 
             u.name as user_name,
             u.slack_user_id
      FROM query_requests qr
      LEFT JOIN users u ON qr.user_id = u.id
      WHERE qr.uuid = $1
    `, [uuid]);
    return result.rows[0];
  },

  // Update status
  approve: async (id, approverId, approverEmail) => {
    const result = await query(`
      UPDATE query_requests 
      SET status = 'approved',
          approver_id = $1,
          approver_email = $2,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [approverId, approverEmail, id]);
    return result.rows[0];
  },

  // Complex query with filtering
  findByPodIds: async (podIds, { status, limit, offset }) => {
    const result = await query(`
      SELECT qr.*, u.email as user_email, u.name as user_name
      FROM query_requests qr
      LEFT JOIN users u ON qr.user_id = u.id
      WHERE qr.pod_id = ANY($1)
        AND qr.status = $2
      ORDER BY qr.created_at DESC
      LIMIT $3 OFFSET $4
    `, [podIds, status, limit, offset]);
    return result.rows;
  },
};

module.exports = QueryRequest;
```

---

## 11.4 Parameterized Queries (SQL Injection Prevention)

We use parameterized queries to prevent SQL injection:

```javascript
// ❌ WRONG: String concatenation (SQL injection vulnerable)
const result = await query(`SELECT * FROM users WHERE email = '${email}'`);
// Attacker input: ' OR '1'='1
// Becomes: SELECT * FROM users WHERE email = '' OR '1'='1'

// ✅ RIGHT: Parameterized query (safe)
const result = await query('SELECT * FROM users WHERE email = $1', [email]);
// Attacker input: ' OR '1'='1
// Becomes: SELECT * FROM users WHERE email = $1 (with param "' OR '1'='1")
// The input is treated as DATA, not SQL
```

**PostgreSQL `$1, $2, $3` syntax:**
- `$1` = first parameter
- `$2` = second parameter
- Parameters are escaped automatically by the driver

---

## 11.5 When Would We Use an ORM?

ORMs make sense when:

| Scenario | Why ORM Helps |
|----------|---------------|
| Rapid prototyping | Auto-generated CRUD |
| Team unfamiliar with SQL | Abstraction helps |
| Complex relationships | ORM handles JOINs |
| Type safety critical | Prisma generates types |
| Frequent schema changes | Migration tools |

**Our scenario is different:**
- We're a query execution portal (SQL is our core competency)
- Performance matters (many queries)
- We need full control over queries
- Team knows SQL well

---

## 11.6 Summary: Why Raw `pg` for Our Use Case

| Reason | Explanation |
|--------|-------------|
| **Core feature is SQL** | We execute user SQL, must understand it |
| **Full control** | Write exact queries we need |
| **Performance** | No ORM overhead |
| **Debugging** | See exact SQL in logs |
| **Simplicity** | No schema sync, no migrations tool |
| **Bundle size** | 50KB vs 5-15MB |
| **Consistency** | Same approach for our queries and user queries |

```javascript
// Our philosophy: SQL is not something to abstract away.
// It's a powerful tool we use directly.

const result = await query(`
  SELECT * FROM query_requests 
  WHERE status = $1 
  ORDER BY created_at DESC
`, ['pending']);

// Clear, fast, debuggable, secure.
```
