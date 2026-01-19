# API Quick Start Guide for Frontend Developers

## 📚 Documentation

- **OpenAPI Spec**: `openapi.yaml` (2,731 lines)
- **Swagger UI**: `https://your-backend.up.railway.app/api-docs`
- **JSON Spec**: `https://your-backend.up.railway.app/api-docs-json`

## 🚀 Quick Start

### 1. Generate TypeScript Client

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript Axios client
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-axios \
  -o src/api/generated

# Or use other generators
# -g typescript-fetch
# -g typescript-angular
# -g javascript
```

### 2. Authentication Flow

```typescript
// Login
const response = await api.post('/auth/login', {
  email: 'developer@company.com',
  password: 'SecurePass123!'
});

const { accessToken, refreshToken, user } = response.data.data;

// Store tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Use token in requests
axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

// Refresh when expired
const refreshResponse = await api.post('/auth/refresh', {
  refreshToken: localStorage.getItem('refreshToken')
});
```

### 3. Submit a Query

```typescript
// Submit query request
const queryResponse = await api.post('/queries/submit', {
  instanceId: 'postgres-prod-1',
  databaseName: 'analytics_db',
  submissionType: 'query',
  queryContent: 'SELECT * FROM users LIMIT 100',
  comments: 'Weekly user report',
  podId: 'pod-analytics'
}, {
  headers: {
    'Idempotency-Key': crypto.randomUUID() // Prevent duplicates
  }
});

const request = queryResponse.data.data;
console.log('Request UUID:', request.uuid);
console.log('Status:', request.status); // 'pending', 'approved', etc.
console.log('Risk Level:', request.riskLevel); // 'low', 'medium', 'high', etc.
```

### 4. Get User's Requests

```typescript
// Get paginated requests
const requests = await api.get('/queries/my-requests', {
  params: {
    page: 1,
    limit: 10,
    status: 'pending' // Optional filter
  }
});

const { data, pagination, links } = requests.data;

console.log('Total:', pagination.total);
console.log('Next page:', links.next);
```

## 🔑 Authentication

### Token Types

| Token | Lifetime | Purpose | Storage |
|-------|----------|---------|---------|
| Access Token | 15 minutes | API requests | Memory/localStorage |
| Refresh Token | 7 days | Get new access token | HttpOnly cookie (preferred) |

### Headers

```typescript
// Bearer token (recommended)
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Or rely on HttpOnly cookies (automatic)
// No header needed - cookies sent automatically
```

## 👥 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Developer** | Submit queries, view own requests |
| **Manager** | All Developer + Approve/reject queries for their POD |
| **Admin** | All Manager + User management, system config, all PODs |

## 📊 Query Workflow

```
1. Developer submits query
   ↓
2. System analyzes risk level
   ↓
3. If HIGH/CRITICAL → Requires Manager approval
   If LOW/MEDIUM → Auto-approved
   ↓
4. Query executed
   ↓
5. Results returned
```

## 🎯 Common Endpoints

### Authentication
```typescript
POST   /auth/login              // Login
POST   /auth/refresh            // Refresh token
POST   /auth/logout             // Logout
GET    /auth/profile            // Get profile
PUT    /auth/profile            // Update profile
PUT    /auth/password           // Change password
```

### Queries
```typescript
POST   /queries/submit          // Submit query
POST   /queries/submit-script   // Submit script file
POST   /queries/analyze         // Analyze query risk
GET    /queries/my-requests     // Get user's requests
GET    /queries/requests/{uuid} // Get request details
POST   /queries/requests/{uuid}/clone // Clone request
```

### Approval (Manager/Admin)
```typescript
GET    /queries/requests        // Search all requests
POST   /queries/requests/{uuid}/approve // Approve
POST   /queries/requests/{uuid}/reject  // Reject
```

### Metadata
```typescript
GET    /queries/instances       // Get database instances
GET    /queries/instances/{id}/databases // Get databases
GET    /queries/pods            // Get PODs
```

### User Management (Admin)
```typescript
GET    /users                   // List users
POST   /auth/register           // Create user
PUT    /users/{id}              // Update user
DELETE /users/{id}              // Delete user
POST   /users/{id}/activate     // Activate user
```

## 🔍 Query Risk Levels

| Level | Color | Description | Approval |
|-------|-------|-------------|----------|
| **safe** | 🟢 Green | Read-only, no risk | Auto-approved |
| **low** | 🟡 Yellow | Simple queries | Auto-approved |
| **medium** | 🟠 Orange | Complex queries | Auto-approved |
| **high** | 🔴 Red | Data modification | Requires approval |
| **critical** | ⚫ Black | DROP, TRUNCATE, etc. | Requires approval |

## 📄 Request Status Flow

```
pending → approved → executing → completed
                              ↘ failed
        ↘ rejected
```

## 🚨 Error Handling

### Standard Error Format

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "email": "Invalid email format",
      "password": "Password must be at least 8 characters"
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 201 | Created | Resource created successfully |
| 400 | Validation Error | Fix request parameters |
| 401 | Unauthorized | Refresh token or re-login |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Wait and retry |
| 500 | Server Error | Report to backend team |

### Error Handling Example

```typescript
try {
  const response = await api.post('/queries/submit', queryData);
  // Handle success
} catch (error) {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        // Show validation errors
        showErrors(data.error.details);
        break;
      case 401:
        // Refresh token or redirect to login
        await refreshToken();
        break;
      case 403:
        // Show permission error
        showError('You don\'t have permission');
        break;
      case 429:
        // Show rate limit error
        const retryAfter = error.response.headers['retry-after'];
        showError(`Rate limited. Retry after ${retryAfter}s`);
        break;
      default:
        showError('An error occurred');
    }
  }
}
```

## 🔄 Pagination

### Request

```typescript
GET /queries/my-requests?page=2&limit=20
```

### Response

```typescript
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 95,
    "page": 2,
    "limit": 20,
    "totalPages": 5
  },
  "links": {
    "self": "/api/v1/queries/my-requests?page=2&limit=20",
    "next": "/api/v1/queries/my-requests?page=3&limit=20",
    "prev": "/api/v1/queries/my-requests?page=1&limit=20",
    "first": "/api/v1/queries/my-requests?page=1&limit=20",
    "last": "/api/v1/queries/my-requests?page=5&limit=20"
  }
}
```

## 🎨 TypeScript Types

### User

```typescript
interface User {
  id: string;
  uuid: string;
  email: string;
  name: string;
  role: 'developer' | 'manager' | 'admin';
  podId?: string;
  slackUserId?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}
```

### QueryRequest

```typescript
interface QueryRequest {
  id: number;
  uuid: string;
  user: User;
  databaseType: 'postgresql' | 'mongodb';
  instanceId: string;
  instanceName: string;
  databaseName: string;
  submissionType: 'query' | 'script';
  queryContent?: string;
  scriptFilename?: string;
  scriptContent?: string;
  comments: string;
  podId: string;
  podName: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  riskLevel?: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  approver?: User;
  approverEmail?: string;
  approvedAt?: string;
  rejectionReason?: string;
  executionResult?: string;
  executionError?: string;
  executionStartedAt?: string;
  executionCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### DatabaseInstance

```typescript
interface DatabaseInstance {
  id: string;
  name: string;
  type: 'postgresql' | 'mongodb';
  host: string;
  port: number;
  description?: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  createdAt: string;
  updatedAt: string;
}
```

## 🛠️ Development Tips

### 1. Use Axios Interceptors

```typescript
// Request interceptor - Add auth token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Handle token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Try to refresh token
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/auth/refresh', { refreshToken });
        const { accessToken } = response.data.data;
        
        localStorage.setItem('accessToken', accessToken);
        
        // Retry original request
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return axios.request(error.config);
      } catch (refreshError) {
        // Refresh failed - redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### 2. Use React Query / TanStack Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch user's requests
const { data, isLoading, error } = useQuery({
  queryKey: ['my-requests', page, status],
  queryFn: () => api.get('/queries/my-requests', { params: { page, status } })
});

// Submit query mutation
const submitMutation = useMutation({
  mutationFn: (queryData) => api.post('/queries/submit', queryData),
  onSuccess: () => {
    queryClient.invalidateQueries(['my-requests']);
    toast.success('Query submitted successfully');
  },
  onError: (error) => {
    toast.error(error.response?.data?.error?.message);
  }
});
```

### 3. Idempotency Keys

```typescript
// Generate unique key for each request
import { v4 as uuidv4 } from 'uuid';

const submitQuery = async (queryData) => {
  return api.post('/queries/submit', queryData, {
    headers: {
      'Idempotency-Key': uuidv4()
    }
  });
};
```

## 📱 Rate Limiting

### Limits

- **General API**: 100 requests / 15 minutes
- **Auth endpoints**: 20 requests / 15 minutes

### Headers

```typescript
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642345678
```

### Handle Rate Limits

```typescript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'];
  const resetTime = error.response.headers['x-ratelimit-reset'];
  
  // Show user-friendly message
  toast.error(`Too many requests. Try again in ${retryAfter} seconds`);
  
  // Optionally auto-retry
  setTimeout(() => {
    retryRequest();
  }, retryAfter * 1000);
}
```

## 🔗 Useful Links

- **Swagger UI**: https://your-backend.up.railway.app/api-docs
- **OpenAPI Spec**: `openapi.yaml`
- **Architecture Docs**: `backend/docs/ARCHITECTURE_DEEP_DIVE.md`
- **Database Schema**: `backend/docs/schema-diagrams/DATABASE_SCHEMA.md`

## 💡 Best Practices

1. **Always use HTTPS** in production
2. **Store refresh tokens securely** (HttpOnly cookies preferred)
3. **Implement token refresh logic** before expiration
4. **Use idempotency keys** for critical operations
5. **Handle all error cases** gracefully
6. **Respect rate limits** - implement backoff
7. **Validate user input** before sending to API
8. **Show loading states** during API calls
9. **Cache responses** when appropriate (React Query)
10. **Log errors** for debugging

## 🐛 Troubleshooting

### Issue: 401 Unauthorized

**Solution**: Check if token is expired, refresh or re-login

### Issue: 403 Forbidden

**Solution**: User doesn't have required role (Manager/Admin)

### Issue: CORS Error

**Solution**: Ensure backend CORS_ORIGIN includes your frontend URL

### Issue: Rate Limited (429)

**Solution**: Wait for rate limit window to reset, implement backoff

### Issue: Validation Error (400)

**Solution**: Check error.details for field-specific errors

## 📞 Support

- **Backend Team**: backend@company.com
- **API Issues**: Create ticket in JIRA
- **Documentation**: Check `/api-docs` for latest spec
