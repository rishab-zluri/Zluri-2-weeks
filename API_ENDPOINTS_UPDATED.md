# API Endpoints Documentation Update

**Date**: January 20, 2026  
**Status**: ✅ COMPLETED

---

## 🎯 WHAT WAS UPDATED

Updated `README.md` to include **ALL working endpoints** from the actual codebase.

---

## 📊 ENDPOINT COUNT

### Before
- Authentication: 4 endpoints
- Query Requests: 6 endpoints
- Databases: 3 endpoints
- **Total**: 13 endpoints

### After
- Authentication: 10 endpoints
- Query Requests: 16 endpoints
- Database Management: 9 endpoints
- User Management: 6 endpoints
- Secrets Management: 3 endpoints
- Health Check: 2 endpoints
- **Total**: 46 endpoints

---

## ✅ NEW ENDPOINTS DOCUMENTED

### Authentication (6 new)
- `POST /auth/register` - Register new user (Admin only)
- `POST /auth/logout-all` - Logout from all devices
- `GET /auth/profile` - Get current user profile
- `PUT /auth/profile` - Update user profile
- `PUT /auth/password` - Change password
- `GET /auth/sessions` - Get active sessions
- `DELETE /auth/sessions/:sessionId` - Revoke a session

### Query Requests (10 new)
- `POST /queries/submit` - Submit new query
- `POST /queries/submit-script` - Submit new script
- `GET /queries/my-requests` - Get user's requests
- `GET /queries/my-status-counts` - Get status counts
- `GET /queries/pending` - Get pending requests
- `GET /queries/requests` - Get all requests (filtered)
- `GET /queries/all` - Get all requests (Admin)
- `GET /queries/stats` - Get query statistics
- `POST /queries/analyze` - Analyze query content
- `GET /queries/pods` - List PODs

### Database Management (6 new)
- `GET /databases/instances/:instanceId` - Get instance details
- `GET /databases/instances/:instanceId/sync-history` - Get sync history
- `POST /databases/sync-all` - Sync all instances
- `GET /databases/blacklist` - Get blacklist entries
- `POST /databases/blacklist` - Add to blacklist
- `DELETE /databases/blacklist/:id` - Remove from blacklist

### User Management (6 new - entire section)
- `GET /users` - List all users
- `GET /users/:id` - Get user details
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `POST /users/:id/activate` - Activate/deactivate user
- `POST /users/:id/reset-password` - Reset user password

### Secrets Management (3 new - entire section)
- `GET /secrets` - List all secrets
- `GET /secrets/search` - Search secrets
- `GET /secrets/:secretName` - Get secret value

### Health Check (2 new - entire section)
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check

---

## 📝 DOCUMENTATION FORMAT

Each endpoint now includes:
- **Method**: HTTP method (GET, POST, PUT, DELETE)
- **Endpoint**: Full path
- **Description**: What the endpoint does
- **Auth Required**: Whether authentication is needed and role requirements

### Example
```markdown
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | User login | No |
| GET | `/users` | List all users | Yes (Admin) |
```

---

## 🔒 AUTHENTICATION REQUIREMENTS

### Public Endpoints (No Auth)
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /health`
- `GET /health/detailed`

### Authenticated Endpoints (Any Role)
- Most query and database endpoints
- Profile management
- Session management

### Manager/Admin Only
- `POST /queries/requests/:uuid/approve`
- `POST /queries/requests/:uuid/reject`
- `GET /queries/pending`

### Admin Only
- All `/users` endpoints
- All `/databases/blacklist` endpoints
- `POST /databases/instances/:instanceId/sync`
- `POST /databases/sync-all`
- `POST /auth/register`
- `GET /queries/all`
- `GET /queries/stats`

---

## 🎯 ENDPOINT ORGANIZATION

### By Feature

**Authentication & Authorization**:
- Login, logout, register
- Profile management
- Session management
- Password management

**Query Workflow**:
- Submit queries/scripts
- View requests
- Approve/reject
- Clone requests
- Query analysis

**Database Management**:
- List instances
- Sync databases
- Manage blacklist
- View sync history

**User Administration**:
- CRUD operations
- Activate/deactivate
- Password reset

**Secrets Management**:
- List secrets
- Search secrets
- Get secret values

**System Health**:
- Basic health check
- Detailed diagnostics

---

## 📚 RELATED DOCUMENTATION

- **OpenAPI Spec**: `openapi.yaml` - Full API specification
- **Swagger UI**: Available at `/api-docs` when server is running
- **Architecture**: `backend/docs/ARCHITECTURE_DEEP_DIVE.md`
- **Workflow**: `backend/docs/WORKFLOW_DIAGRAMS.md`

---

## 🧪 TESTING ENDPOINTS

### Using cURL

```bash
# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zluri.com","password":"Test@123"}'

# Get profile (with token)
curl -X GET http://localhost:5001/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Submit query
curl -X POST http://localhost:5001/api/queries/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId":"database-1",
    "databaseName":"test_db",
    "podId":"pod-1",
    "databaseType":"postgresql",
    "queryContent":"SELECT * FROM users LIMIT 10",
    "comments":"Test query"
  }'
```

### Using Postman

1. Import `openapi.yaml` into Postman
2. Set environment variable `baseUrl` to `http://localhost:5001/api`
3. Login to get token
4. Set `Authorization` header: `Bearer YOUR_TOKEN`
5. Test endpoints

---

## 🎉 SUMMARY

Updated README.md with:
- ✅ 46 total endpoints documented (was 13)
- ✅ Organized by feature area
- ✅ Authentication requirements specified
- ✅ All working endpoints from codebase
- ✅ Clear descriptions for each endpoint
- ✅ Proper HTTP methods
- ✅ Role-based access control noted

The documentation now accurately reflects the actual API implementation!

---

**Updated By**: AI Assistant  
**Date**: January 20, 2026
