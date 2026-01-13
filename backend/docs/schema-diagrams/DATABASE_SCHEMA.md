# Database Schema Diagrams

## How to View These Diagrams

### Option 1: dbdiagram.io (Best for ERD)
1. Go to [dbdiagram.io](https://dbdiagram.io)
2. Copy contents of `portal_schema.dbml` or `target_databases.dbml`
3. Paste in the editor
4. Export as PNG/PDF

### Option 2: VS Code Extension
Install "Markdown Preview Mermaid Support" extension to view diagrams below.

### Option 3: GitHub
Push to GitHub - Mermaid diagrams render automatically in markdown.

---

## Portal Database (PostgreSQL)

This is the internal database that stores users, requests, and authentication data.

```mermaid
erDiagram
    users ||--o{ query_requests : "submits"
    users ||--o{ query_requests : "approves"
    users ||--o{ refresh_tokens : "has"
    users ||--o{ access_token_blacklist : "has"
    users ||--|| user_token_invalidation : "has"

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar role "developer|manager|admin"
        varchar pod_id
        varchar slack_user_id
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    query_requests {
        serial id PK
        uuid uuid UK "Public API ID"
        uuid user_id FK
        varchar database_type "postgresql|mongodb"
        varchar instance_id
        varchar instance_name
        varchar database_name
        varchar submission_type "query|script"
        text query_content
        varchar script_filename
        text script_content
        text comments
        varchar pod_id
        varchar pod_name
        varchar status "pending|approved|rejected|executing|completed|failed"
        uuid approver_id FK
        varchar approver_email
        timestamp approved_at
        text rejection_reason
        text execution_result
        text execution_error
        timestamp execution_started_at
        timestamp execution_completed_at
        timestamp created_at
        timestamp updated_at
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK
        varchar token_hash
        timestamp expires_at
        timestamp revoked_at
        timestamp created_at
    }

    access_token_blacklist {
        serial id PK
        varchar token_hash UK
        uuid user_id FK
        timestamp expires_at
        timestamp created_at
    }

    user_token_invalidation {
        uuid user_id PK
        timestamp invalidated_at
    }
```

---

## Target Databases (What Users Query)

### PostgreSQL Target Example

```mermaid
erDiagram
    pg_users ||--o{ pg_orders : "places"
    pg_products ||--o{ pg_orders : "contains"

    pg_users {
        serial id PK
        varchar email UK
        varchar name
        varchar department
        boolean is_active
        timestamp created_at
    }

    pg_orders {
        serial id PK
        int user_id FK
        varchar product_name
        int quantity
        decimal total_amount
        varchar status
        timestamp created_at
    }

    pg_products {
        serial id PK
        varchar name
        varchar category
        decimal price
        int stock
        timestamp created_at
    }
```

### MongoDB Target Example

```mermaid
erDiagram
    mongo_users ||--o{ mongo_events : "generates"

    mongo_users {
        objectid _id PK
        string email
        object profile "name avatar preferences"
        array roles
        object metadata
        date createdAt
        date updatedAt
    }

    mongo_events {
        objectid _id PK
        objectid userId FK
        string eventType
        object payload "Flexible JSON"
        date timestamp
    }

    mongo_analytics {
        objectid _id PK
        date date
        object metrics "pageViews uniqueUsers"
        array breakdown
    }
```

---

## System Architecture Overview

```mermaid
flowchart TB
    subgraph Frontend
        UI[React Frontend]
    end

    subgraph Backend
        API[Express API Server]
        Auth[Auth Middleware]
        Exec[Script Executor]
    end

    subgraph PortalDB[Portal Database - PostgreSQL]
        Users[(users)]
        Requests[(query_requests)]
        Tokens[(refresh_tokens)]
    end

    subgraph TargetDBs[Target Databases]
        PG1[(PostgreSQL Instance 1)]
        PG2[(PostgreSQL Instance 2)]
        Mongo1[(MongoDB Instance 1)]
    end

    subgraph External
        Slack[Slack API]
        AWS[AWS Secrets Manager]
    end

    UI --> API
    API --> Auth
    Auth --> Users
    API --> Requests
    API --> Tokens
    
    Exec --> PG1
    Exec --> PG2
    Exec --> Mongo1
    
    API --> Slack
    API --> AWS
```

---

## Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending: User submits request
    Pending --> Approved: Manager approves
    Pending --> Rejected: Manager rejects
    Approved --> Executing: System starts execution
    Executing --> Completed: Success
    Executing --> Failed: Error
    Rejected --> [*]
    Completed --> [*]
    Failed --> [*]
```

---

## Quick Reference

| Database | Type | Purpose |
|----------|------|---------|
| Portal DB | PostgreSQL | Stores users, requests, auth tokens |
| Target DBs | PostgreSQL/MongoDB | User's actual databases they query |

| Table | Records |
|-------|---------|
| users | User accounts, roles, POD assignments |
| query_requests | All submitted queries/scripts |
| refresh_tokens | JWT refresh tokens for sessions |
| access_token_blacklist | Revoked access tokens |
| user_token_invalidation | Bulk token invalidation timestamps |
