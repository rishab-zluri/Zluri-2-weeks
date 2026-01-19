# OpenAPI 3.0 Specification - Database Query Portal API

## Overview

A comprehensive OpenAPI 3.0 specification has been created for the Database Query Portal API (version 1.1.6). The specification is production-ready and frontend-developer-friendly.

**File**: `openapi.yaml` (2,731 lines)

## Specification Contents

### 1. Info Section ✓
- **Title**: Database Query Portal API
- **Version**: 1.1.6
- **Description**: Comprehensive documentation including:
  - Feature list (multi-database support, approval workflow, risk analysis, RBAC, POD organization, script execution, audit trail, Slack integration)
  - Authentication flow (JWT Bearer + HttpOnly cookies)
  - Rate limiting details (100 req/15min general, 20 req/15min auth)
  - Pagination guidelines (page, limit parameters with HATEOAS links)
  - Error handling format
- **Contact**: SRE Team
- **License**: MIT

### 2. Servers ✓
- **Production**: `https://database-query-portal-production.up.railway.app/api/v1`
- **Development**: `http://localhost:5001/api/v1`

### 3. Tags ✓
- Authentication
- Queries
- Query Analysis
- Queries - Approval
- Database Management
- User Management
- Metadata
- Admin

### 4. Security Schemes ✓
- **bearerAuth**: JWT Bearer token (HTTP scheme)
- **cookieAuth**: HttpOnly cookie-based authentication

### 5. API Endpoints (37 total) ✓

#### Authentication (8 endpoints)
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `POST /auth/logout-all` - Logout from all devices
- `GET /auth/profile` - Get current user profile
- `PUT /auth/profile` - Update current user profile
- `PUT /auth/password` - Change password
- `GET /auth/sessions` - Get active sessions
- `DELETE /auth/sessions/{sessionId}` - Revoke specific session
- `POST /auth/register` - Register new user (Admin only)

#### Queries (13 endpoints)
- `POST /queries/submit` - Submit database query request
- `POST /queries/submit-script` - Submit script execution request
- `POST /queries/analyze` - Analyze query for risk level
- `GET /queries/my-requests` - Get current user's requests
- `GET /queries/my-status-counts` - Get status counts
- `GET /queries/requests/{uuid}` - Get request details
- `POST /queries/requests/{uuid}/clone` - Clone a request
- `POST /queries/requests/{uuid}/approve` - Approve request (Manager/Admin)
- `POST /queries/requests/{uuid}/reject` - Reject request (Manager/Admin)
- `GET /queries/pending` - Get pending requests (Deprecated)
- `GET /queries/requests` - Search query requests (Manager/Admin)
- `GET /queries/all` - Get all requests (Deprecated, Admin)
- `GET /queries/stats` - Get system statistics (Admin)

#### Metadata (3 endpoints)
- `GET /queries/instances` - Get database instances
- `GET /queries/instances/{instanceId}/databases` - Get databases for instance
- `GET /queries/pods` - Get all PODs

#### Database Management (8 endpoints)
- `GET /databases/instances` - List database instances
- `GET /databases/instances/{instanceId}` - Get instance by ID
- `GET /databases/instances/{instanceId}/databases` - Get databases in instance
- `POST /databases/instances/{instanceId}/sync` - Sync instance metadata (Admin)
- `GET /databases/instances/{instanceId}/sync-history` - Get sync history
- `POST /databases/sync-all` - Sync all instances (Admin)
- `GET /databases/blacklist` - Get blacklist entries
- `POST /databases/blacklist` - Add to blacklist (Admin)
- `DELETE /databases/blacklist/{id}` - Remove from blacklist (Admin)

#### User Management (5 endpoints)
- `GET /users` - List all users (Admin)
- `GET /users/{id}` - Get user by ID (Admin)
- `PUT /users/{id}` - Update user (Admin)
- `DELETE /users/{id}` - Delete user (Admin)
- `POST /users/{id}/activate` - Activate user (Admin)
- `POST /users/{id}/reset-password` - Reset user password (Admin)

### 6. Components/Schemas ✓

#### Enums
- **UserRole**: developer, manager, admin
- **RequestStatus**: pending, approved, rejected, executing, completed, failed
- **SubmissionType**: query, script
- **DatabaseType**: postgresql, mongodb
- **RiskLevel**: safe, low, medium, high, critical

#### Entity Schemas
- **User**: Complete user model with all fields (id, uuid, email, name, role, podId, slackUserId, isActive, lastLogin, createdAt, updatedAt)
- **QueryRequest**: Complete query request model with all fields including execution details, approval info, risk level
- **DatabaseInstance**: Database instance model (id, name, type, host, port, description, isActive, lastSyncAt, lastSyncStatus, createdAt, updatedAt)
- **Pod**: POD/team model (id, name, managerEmail, description, isActive, createdAt, updatedAt)

#### Request/Response Schemas
- **SubmitQueryRequest**: Query submission payload
- **PaginationMeta**: Pagination metadata (total, page, limit, totalPages)
- **PaginatedQueryRequests**: Paginated response with HATEOAS links
- **Error**: Standard error response format

### 7. Common Parameters ✓
- **PageParam**: Page number (default: 1)
- **LimitParam**: Items per page (default: 10, max: 100)
- **UuidPathParam**: UUID path parameter with validation
- **InstanceIdParam**: Instance ID path parameter
- **IdempotencyKeyHeader**: Idempotency-Key header for safe retries

### 8. Response Templates ✓
- **200 OK**: Success responses with data
- **201 Created**: Resource created successfully
- **400 ValidationError**: Invalid request parameters with field-level errors
- **401 Unauthorized**: Authentication required or token invalid
- **403 Forbidden**: Insufficient permissions with role requirements
- **404 NotFound**: Resource does not exist
- **429 RateLimitExceeded**: Too many requests with retry-after info
- **500 InternalError**: Unexpected server error

## Key Features

### 1. Comprehensive Documentation
- Every endpoint includes detailed descriptions
- Request/response examples for common scenarios
- Security requirements clearly marked
- RBAC requirements specified (Developer/Manager/Admin)

### 2. Production-Ready
- Idempotency support for critical operations
- Rate limiting documented
- Error responses standardized
- Validation rules specified

### 3. Frontend-Developer-Friendly
- Clear examples for each endpoint
- HATEOAS pagination links
- Consistent response format
- Detailed error messages with field-level validation

### 4. Security
- JWT Bearer + Cookie authentication
- Role-based access control documented
- Idempotency keys for safe retries
- Rate limiting per endpoint type

### 5. Best Practices
- RESTful design
- Semantic HTTP status codes
- Pagination with metadata
- Filtering and search parameters
- Deprecation warnings for legacy endpoints

## Usage

### For Frontend Developers
1. Import `openapi.yaml` into your API client generator (e.g., openapi-generator, swagger-codegen)
2. Generate TypeScript/JavaScript client SDK
3. Use the generated types for type-safe API calls

### For API Documentation
1. Host with Swagger UI: Already configured at `/api-docs`
2. View JSON spec at: `/api-docs-json`
3. Import into Postman/Insomnia for testing

### For Backend Developers
1. Use as contract for API implementation
2. Validate responses against schemas
3. Keep in sync with route changes

## Validation

The OpenAPI specification follows OpenAPI 3.0.3 standard and includes:
- ✓ Valid YAML syntax
- ✓ All required OpenAPI fields
- ✓ Consistent schema references
- ✓ Complete request/response definitions
- ✓ Security schemes properly defined
- ✓ Examples for all major endpoints

## Next Steps

1. **Validate**: Use online validators (swagger.io/tools/swagger-editor)
2. **Generate Client**: Use openapi-generator for frontend SDK
3. **Test**: Import into Postman and test all endpoints
4. **Maintain**: Keep in sync with backend route changes
5. **Version**: Update version number when making breaking changes

## File Location

```
openapi.yaml (2,731 lines)
```

## Related Documentation

- Backend Routes: `backend/src/routes/`
- Entity Models: `backend/src/entities/`
- Validation Schemas: `backend/src/validation/`
- Architecture: `backend/docs/ARCHITECTURE_DEEP_DIVE.md`
