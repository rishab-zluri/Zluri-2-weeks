# Database Query Execution Portal

A secure, role-based portal for executing database queries and scripts against PostgreSQL and MongoDB instances with an approval workflow.

## Overview

This portal allows developers to submit database queries/scripts for execution, which are then reviewed and approved by managers before being executed against target databases. All operations are logged for audit compliance.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUERY EXECUTION WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Developer              Manager                System                       │
│   ─────────              ───────                ──────                       │
│       │                     │                     │                          │
│       │  Submit Query       │                     │                          │
│       │────────────────────►│                     │                          │
│       │                     │                     │                          │
│       │              Review & Approve             │                          │
│       │                     │────────────────────►│                          │
│       │                     │                     │                          │
│       │                     │              Execute on Target DB              │
│       │                     │                     │──────────┐               │
│       │                     │                     │          │               │
│       │                     │                     │◄─────────┘               │
│       │                     │                     │                          │
│       │◄────────────────────│◄────────────────────│                          │
│       │         Slack Notification with Results                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-Database Support**: PostgreSQL and MongoDB
- **Runtime Database Discovery**: Queries target instances at runtime to fetch available databases
- **Role-Based Access Control**: Developer, Manager, and Admin roles
- **Approval Workflow**: All queries require manager approval before execution
- **Script Execution**: Support for JavaScript scripts with database access
- **Slack Integration**: Notifications for submissions, approvals, and results
- **Audit Trail**: Complete logging of all operations
- **Secure Authentication**: JWT with refresh tokens for session management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Portal Database**: PostgreSQL
- **Target Databases**: PostgreSQL, MongoDB
- **Authentication**: JWT (Access + Refresh Tokens)
- **Notifications**: Slack API
- **Testing**: Jest (100% coverage)

## Project Structure

```
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # Database connection management
│   │   ├── index.js      # Environment configuration
│   │   └── staticData.js # POD and instance configurations
│   ├── controllers/      # Request handlers
│   │   ├── authController.js
│   │   ├── databaseController.js
│   │   └── queryController.js
│   ├── middleware/       # Express middleware
│   │   ├── auth.js       # JWT authentication & authorization
│   │   ├── errorHandler.js
│   │   ├── upload.js     # Script file uploads
│   │   └── validation.js
│   ├── models/           # Database models
│   │   ├── QueryRequest.js
│   │   └── User.js
│   ├── routes/           # API routes
│   │   ├── authRoutes.js
│   │   ├── databaseRoutes.js
│   │   └── queryRoutes.js
│   ├── services/         # Business logic
│   │   ├── authService.js
│   │   ├── databaseSyncService.js
│   │   ├── queryExecutionService.js
│   │   ├── scriptExecutionService.js
│   │   └── slackService.js
│   ├── utils/            # Utility functions
│   │   ├── errors.js
│   │   ├── logger.js
│   │   ├── response.js
│   │   └── validators.js
│   └── server.js         # Application entry point
├── tests/                # Test files (100% coverage)
├── scripts/              # Database scripts
├── docs/                 # Documentation
├── portal_db_schema.sql  # Portal database schema
├── target_db_schema.sql  # Sample target database schema
└── MIGRATION_GUIDE.md    # Database migration documentation
```

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- MongoDB 4.4+ (optional, for MongoDB targets)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd database-query-portal-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Create the portal database**
   ```bash
   createdb portal_db
   psql -d portal_db -f portal_db_schema.sql
   ```

5. **Start the server**
   ```bash
   npm start
   ```

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Portal Database
PORTAL_DB_HOST=localhost
PORTAL_DB_PORT=5432
PORTAL_DB_NAME=portal_db
PORTAL_DB_USER=postgres
PORTAL_DB_PASSWORD=your_password

# Target Database Instances
PG_INSTANCE_1_HOST=localhost
PG_INSTANCE_1_PORT=5432
PG_INSTANCE_1_USER=postgres
PG_INSTANCE_1_PASSWORD=your_password

MONGO_INSTANCE_1_URI=mongodb://localhost:27017

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES=30m
JWT_REFRESH_EXPIRES_DAYS=7

# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL_ID=C0123456789
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### Query Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests` | Submit new query/script |
| GET | `/api/requests/my` | Get user's requests |
| GET | `/api/requests/:uuid` | Get request details |
| POST | `/api/requests/:uuid/approve` | Approve request |
| POST | `/api/requests/:uuid/reject` | Reject request |
| POST | `/api/requests/:uuid/clone` | Clone a request |

### Databases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/databases/instances` | List database instances |
| GET | `/api/databases/instances/:id/databases` | List databases (runtime query) |
| POST | `/api/databases/instances/:id/sync` | Trigger database sync |

## Database Architecture

The portal uses a two-database architecture:

### Portal Database
Stores application data: users, requests, audit logs, etc.

### Target Databases
The databases that users query through the portal. **Databases are discovered at runtime** by querying the actual instances, ensuring the dropdown always shows current databases.

```
Portal                          Target Instances
┌──────────────┐               ┌──────────────────┐
│  portal_db   │               │  PostgreSQL      │
│              │   ──────►     │  - customer_db   │
│  • users     │   Runtime     │  - analytics_db  │
│  • requests  │   Query       │  - ...           │
│  • audit     │               ├──────────────────┤
│              │               │  MongoDB         │
│              │   ──────►     │  - app_db        │
│              │               │  - logs_db       │
└──────────────┘               └──────────────────┘
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Developer** | Submit queries, view own requests, clone requests |
| **Manager** | All developer permissions + approve/reject POD requests |
| **Admin** | All permissions + user management, system configuration |

## Testing

The project maintains **100% test coverage** across all metrics.

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/authService.test.js
```

### Coverage Report
```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |     100 |      100 |     100 |     100 |
--------------------|---------|----------|---------|---------|
```

## Security Features

- **JWT Authentication**: Short-lived access tokens (30 min) with refresh tokens
- **Password Hashing**: bcrypt with 10+ rounds
- **Role-Based Access**: Granular permissions per role
- **SQL Injection Prevention**: Parameterized queries
- **Audit Logging**: All actions logged with user, timestamp, IP
- **Secure Logout**: Server-side token revocation

## Default Users

For development/testing (password: `Test@123`):

| Email | Role | POD |
|-------|------|-----|
| admin@zluri.com | Admin | - |
| manager1@zluri.com | Manager | pod-1 |
| developer1@zluri.com | Developer | pod-1 |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

---

Built with  for secure database operations
