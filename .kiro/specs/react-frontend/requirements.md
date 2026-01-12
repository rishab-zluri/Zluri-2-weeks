# Requirements Document

## Introduction

This document specifies the requirements for a React frontend application for the Database Query Execution Portal. The frontend will integrate with the existing Node.js/Express backend API to provide a user interface for developers to submit database queries/scripts, managers to approve/reject requests, and administrators to manage users and view statistics.

## Glossary

- **Portal**: The React web application for database query execution
- **User**: Any authenticated person using the Portal
- **Developer**: A user who submits queries/scripts for execution
- **Manager**: A user who approves/rejects queries for their assigned PODs
- **Admin**: A user with full access to manage users and view all requests
- **POD**: A team/group unit for organizing users and routing approvals
- **Query_Request**: A submission containing a database query or script for execution
- **Instance**: A database server (PostgreSQL or MongoDB)
- **Database**: A specific database within an Instance
- **Submission_Type**: Either "query" (raw SQL/MongoDB) or "script" (JavaScript file)
- **Auth_Service**: The frontend service handling authentication with the backend API
- **API_Client**: The HTTP client configured for backend communication

## Requirements

### Requirement 1: Authentication

**User Story:** As a user, I want to log in with my email and password, so that I can access the portal securely.

#### Acceptance Criteria

1. WHEN a user visits the Portal without authentication THEN the Portal SHALL redirect to the Login page
2. WHEN a user submits valid credentials THEN the Portal SHALL store the JWT tokens and redirect to the Dashboard
3. WHEN a user submits invalid credentials THEN the Portal SHALL display an error message without exposing sensitive details
4. WHEN a user clicks logout THEN the Portal SHALL clear stored tokens and redirect to the Login page
5. WHEN an access token expires THEN the Portal SHALL automatically refresh it using the refresh token
6. IF the refresh token is invalid or expired THEN the Portal SHALL redirect to the Login page

### Requirement 2: Navigation and Layout

**User Story:** As a user, I want a consistent navigation layout, so that I can easily access different sections of the portal.

#### Acceptance Criteria

1. THE Portal SHALL display a sidebar with navigation links based on user role
2. WHEN a Developer is logged in THEN the Portal SHALL show Dashboard and My Submissions links
3. WHEN a Manager is logged in THEN the Portal SHALL show Dashboard, Approval Dashboard, and My Submissions links
4. WHEN an Admin is logged in THEN the Portal SHALL show all navigation links including User Management
5. THE Portal SHALL display the logged-in user's email in the header
6. THE Portal SHALL display a logout button in the header

### Requirement 3: Query Submission Form

**User Story:** As a developer, I want to submit database queries through a form, so that I can request execution against production databases.

#### Acceptance Criteria

1. WHEN a user selects a Database Type THEN the Portal SHALL filter the Instance dropdown to show only instances of that type
2. WHEN a user selects an Instance THEN the Portal SHALL populate the Database dropdown with databases from that instance
3. WHEN a user selects "Query" submission type THEN the Portal SHALL display a textarea for entering the query
4. WHEN a user selects "Script" submission type THEN the Portal SHALL display a file upload component for .js files
5. WHEN a user submits a valid form THEN the Portal SHALL send the request to the API and display a success message
6. WHEN a user clicks Cancel THEN the Portal SHALL clear all form fields
7. IF form validation fails THEN the Portal SHALL display specific error messages for each invalid field
8. THE Portal SHALL require all mandatory fields: Database Type, Instance, Database, Submission Type, Query/Script, Comments, and POD

### Requirement 4: Script Submission with Documentation

**User Story:** As a developer, I want to see documentation when submitting scripts, so that I understand how to use database connections.

#### Acceptance Criteria

1. WHEN a user is on the Script submission view THEN the Portal SHALL display a documentation panel
2. THE Documentation_Panel SHALL show available environment variables (DB_CONFIG_FILE, MONGO_URI)
3. THE Documentation_Panel SHALL show code examples for PostgreSQL and MongoDB connections
4. WHEN a user uploads a script file THEN the Portal SHALL validate it is a .js file
5. IF a non-.js file is uploaded THEN the Portal SHALL display an error and reject the file

### Requirement 5: Approval Dashboard

**User Story:** As a manager, I want to view and act on pending requests for my PODs, so that I can approve or reject queries.

#### Acceptance Criteria

1. WHEN a Manager views the Approval Dashboard THEN the Portal SHALL display only requests for their assigned PODs
2. WHEN an Admin views the Approval Dashboard THEN the Portal SHALL display requests for all PODs
3. THE Approval_Dashboard SHALL display a table with columns: Database, Request ID, Query Preview, Requester, POD, Approver, Comments, Actions
4. WHEN a user clicks Approve THEN the Portal SHALL send an approval request to the API
5. WHEN a user clicks Reject THEN the Portal SHALL prompt for an optional rejection reason
6. WHEN a rejection reason is provided THEN the Portal SHALL include it in the rejection request
7. THE Portal SHALL support filtering by POD name, status, and date range
8. THE Portal SHALL support searching across all visible fields
9. THE Portal SHALL support pagination for large result sets

### Requirement 6: My Submissions View

**User Story:** As a developer, I want to view my submission history, so that I can track the status of my requests.

#### Acceptance Criteria

1. THE My_Submissions view SHALL display all requests submitted by the logged-in user
2. THE My_Submissions view SHALL show columns: ID, Database, Query Preview, Status, Date, Actions
3. WHEN a user clicks the View Details action THEN the Portal SHALL display the full request details in a modal
4. WHEN a user clicks Clone on a rejected or failed request THEN the Portal SHALL create a new submission with the same data
5. THE Portal SHALL display status with visual indicators: ✓ Executed, ⏳ Pending, ✗ Rejected, ⚠ Failed
6. THE Portal SHALL support pagination for large result sets

### Requirement 7: Request Details Modal

**User Story:** As a user, I want to view full details of a request, so that I can see the complete query/script and execution results.

#### Acceptance Criteria

1. WHEN viewing request details THEN the Portal SHALL display all request metadata
2. WHEN the request has execution results THEN the Portal SHALL display them in a formatted view
3. WHEN the request has an error THEN the Portal SHALL display the error message
4. THE Portal SHALL allow expanding/collapsing long query content
5. THE Portal SHALL provide a copy-to-clipboard function for query content

### Requirement 8: Loading and Error States

**User Story:** As a user, I want clear feedback during operations, so that I know when actions are in progress or have failed.

#### Acceptance Criteria

1. WHEN an API request is in progress THEN the Portal SHALL display a loading indicator
2. WHEN an API request fails THEN the Portal SHALL display a user-friendly error message
3. WHEN a form submission is in progress THEN the Portal SHALL disable the submit button
4. THE Portal SHALL display toast notifications for successful operations
5. THE Portal SHALL display toast notifications for failed operations with error details

### Requirement 9: Responsive Design

**User Story:** As a user, I want the portal to work on different screen sizes, so that I can use it on various devices.

#### Acceptance Criteria

1. THE Portal SHALL be usable on desktop screens (1024px and above)
2. THE Portal SHALL adapt layout for tablet screens (768px to 1023px)
3. THE Portal SHALL provide a mobile-friendly layout for screens below 768px
4. WHEN on mobile THEN the Portal SHALL collapse the sidebar into a hamburger menu

### Requirement 10: Security

**User Story:** As a system administrator, I want the frontend to follow security best practices, so that user data is protected.

#### Acceptance Criteria

1. THE Portal SHALL store JWT tokens in httpOnly cookies or secure storage
2. THE Portal SHALL not expose sensitive data in URL parameters
3. THE Portal SHALL sanitize user inputs before display to prevent XSS
4. THE Portal SHALL include CSRF protection for state-changing operations
5. WHEN a user's session expires THEN the Portal SHALL clear all stored credentials
