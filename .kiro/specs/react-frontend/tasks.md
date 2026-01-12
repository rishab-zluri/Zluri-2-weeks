# Implementation Plan: React Frontend for Database Query Portal

## Overview

This implementation plan creates a React frontend application in a separate `frontend` directory, integrating with the existing backend API. Tasks are organized to build incrementally, starting with project setup and core infrastructure, then building out features.

## Tasks

- [ ] 1. Project Setup and Configuration
  - [ ] 1.1 Initialize React project with Vite in `frontend` directory
    - Run `npm create vite@latest frontend -- --template react-ts`
    - Install dependencies: react-router-dom, axios, tailwindcss, @headlessui/react, @heroicons/react
    - Configure Tailwind CSS with custom color palette from design
    - Set up path aliases in vite.config.ts
    - _Requirements: 9.1_

  - [ ] 1.2 Configure API client and environment
    - Create `.env` file with `VITE_API_URL=http://localhost:3000/api/v1`
    - Create `src/services/apiClient.ts` with Axios instance
    - Add request interceptor for Authorization header
    - Add response interceptor for token refresh on 401
    - _Requirements: 1.5, 10.1_

  - [ ] 1.3 Set up project structure
    - Create folder structure: components, pages, services, contexts, hooks, types, utils
    - Create TypeScript interfaces in `src/types/index.ts`
    - _Requirements: N/A (infrastructure)_

- [ ] 2. Authentication System
  - [ ] 2.1 Implement Auth Service
    - Create `src/services/authService.ts`
    - Implement login, logout, refreshToken, getStoredUser methods
    - Store tokens in localStorage (access) and handle refresh
    - _Requirements: 1.2, 1.4, 1.5_

  - [ ] 2.2 Create Auth Context and Provider
    - Create `src/contexts/AuthContext.tsx`
    - Implement AuthProvider with user state, login, logout functions
    - Add isLoading state for initial auth check
    - _Requirements: 1.1, 1.6_

  - [ ] 2.3 Create Protected Route component
    - Create `src/components/ProtectedRoute.tsx`
    - Redirect to login if not authenticated
    - Show loading spinner during auth check
    - _Requirements: 1.1, 1.6_

  - [ ]* 2.4 Write property test for route protection
    - **Property 1: Unauthenticated Access Protection**
    - **Validates: Requirements 1.1, 1.6**

- [ ] 3. Login Page
  - [ ] 3.1 Create Login Page component
    - Create `src/pages/LoginPage.tsx`
    - Implement centered form layout with logo
    - Add email and password input fields
    - Add login button with loading state
    - Display error messages for failed login
    - _Requirements: 1.2, 1.3, 8.1, 8.2_

  - [ ]* 3.2 Write property test for invalid credentials handling
    - **Property 3: Invalid Credentials Error Handling**
    - **Validates: Requirements 1.3**

- [ ] 4. Layout and Navigation
  - [ ] 4.1 Create Layout component
    - Create `src/components/Layout.tsx`
    - Implement sidebar + header + main content structure
    - Handle responsive sidebar collapse on mobile
    - _Requirements: 2.1, 9.3, 9.4_

  - [ ] 4.2 Create Sidebar component
    - Create `src/components/Sidebar.tsx`
    - Define navigation items with role-based visibility
    - Highlight active route
    - Implement mobile hamburger menu
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.4_

  - [ ] 4.3 Create Header component
    - Create `src/components/Header.tsx`
    - Display logged-in user email
    - Add logout button
    - _Requirements: 2.5, 2.6_

  - [ ]* 4.4 Write property test for role-based navigation
    - **Property 5: Role-Based Navigation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [ ] 5. Toast Notification System
  - [ ] 5.1 Create Toast Context and components
    - Create `src/contexts/ToastContext.tsx`
    - Create `src/components/Toast.tsx` for individual toast
    - Create `src/components/ToastContainer.tsx` for toast list
    - Implement auto-dismiss after duration
    - _Requirements: 8.4, 8.5_

  - [ ]* 5.2 Write property test for toast notifications
    - **Property 15: Toast Notifications**
    - **Validates: Requirements 8.4, 8.5**

- [ ] 6. Query Service
  - [ ] 6.1 Implement Query Service
    - Create `src/services/queryService.ts`
    - Implement getInstances, getDatabases, getPods methods
    - Implement submitQuery, submitScript methods
    - Implement getMyRequests, getPendingRequests methods
    - Implement approveRequest, rejectRequest, cloneRequest methods
    - _Requirements: 3.1, 3.2, 5.4, 6.4_

- [ ] 7. Checkpoint - Core Infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Query Submission Form
  - [ ] 8.1 Create form components
    - Create `src/components/forms/SelectField.tsx`
    - Create `src/components/forms/TextArea.tsx`
    - Create `src/components/forms/FileUpload.tsx`
    - Create `src/components/forms/RadioGroup.tsx`
    - _Requirements: 3.3, 3.4_

  - [ ] 8.2 Create QuerySubmissionForm component
    - Create `src/components/QuerySubmissionForm.tsx`
    - Implement cascading dropdowns (DB Type → Instance → Database)
    - Toggle between Query textarea and Script file upload
    - Add form validation with error messages
    - Implement submit and cancel handlers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 8.3 Write property test for cascading dropdowns
    - **Property 6: Cascading Dropdown Filtering**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 8.4 Write property test for form validation
    - **Property 7: Form Validation**
    - **Validates: Requirements 3.7, 3.8**

- [ ] 9. Script Submission with Documentation
  - [ ] 9.1 Create Documentation Panel component
    - Create `src/components/DocumentationPanel.tsx`
    - Display environment variables info
    - Show PostgreSQL and MongoDB code examples
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 9.2 Implement script file validation
    - Add .js file extension validation in FileUpload
    - Display error for non-.js files
    - _Requirements: 4.4, 4.5_

  - [ ]* 9.3 Write property test for file validation
    - **Property 8: Script File Validation**
    - **Validates: Requirements 4.4, 4.5**

- [ ] 10. Dashboard Page
  - [ ] 10.1 Create Dashboard Page
    - Create `src/pages/DashboardPage.tsx`
    - Integrate QuerySubmissionForm
    - Show DocumentationPanel when script type selected
    - Display success/error toasts on submission
    - _Requirements: 3.5, 4.1, 8.4, 8.5_

- [ ] 11. Checkpoint - Query Submission Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Request Table and Status Components
  - [ ] 12.1 Create StatusBadge component
    - Create `src/components/StatusBadge.tsx`
    - Render correct color and icon for each status
    - _Requirements: 6.5_

  - [ ]* 12.2 Write property test for status indicators
    - **Property 13: Status Visual Indicators**
    - **Validates: Requirements 6.5**

  - [ ] 12.3 Create RequestTable component
    - Create `src/components/RequestTable.tsx`
    - Implement table with configurable columns
    - Add action buttons (View, Approve, Reject, Clone)
    - Implement pagination controls
    - _Requirements: 5.3, 5.9, 6.2, 6.6_

- [ ] 13. Request Details Modal
  - [ ] 13.1 Create RequestDetailsModal component
    - Create `src/components/RequestDetailsModal.tsx`
    - Display all request metadata
    - Show execution results or error message
    - Add expand/collapse for long query content
    - Implement copy-to-clipboard for query
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 14. Approval Dashboard
  - [ ] 14.1 Create Approval Dashboard Page
    - Create `src/pages/ApprovalPage.tsx`
    - Fetch pending requests based on user role
    - Implement filter controls (POD, status, date range)
    - Implement search functionality
    - _Requirements: 5.1, 5.2, 5.7, 5.8_

  - [ ] 14.2 Implement approval/rejection actions
    - Add approve button handler
    - Add reject button with reason modal
    - Show loading state during action
    - Display success/error toasts
    - _Requirements: 5.4, 5.5, 5.6, 8.1, 8.4, 8.5_

  - [ ]* 14.3 Write property test for POD-based filtering
    - **Property 9: POD-Based Request Filtering**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 14.4 Write property test for approval action
    - **Property 10: Approval Action API Call**
    - **Validates: Requirements 5.4**

- [ ] 15. My Submissions Page
  - [ ] 15.1 Create My Submissions Page
    - Create `src/pages/MySubmissionsPage.tsx`
    - Fetch user's requests with pagination
    - Display RequestTable with View and Clone actions
    - Integrate RequestDetailsModal
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 15.2 Implement clone functionality
    - Add clone handler that calls API
    - Navigate to dashboard with success message
    - _Requirements: 6.4_

  - [ ]* 15.3 Write property test for clone functionality
    - **Property 12: Clone Creates New Submission**
    - **Validates: Requirements 6.4**

- [ ] 16. Checkpoint - All Pages Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Router Setup and Integration
  - [ ] 17.1 Configure React Router
    - Create `src/App.tsx` with router setup
    - Define routes: /login, /dashboard, /approvals, /my-submissions
    - Wrap routes with ProtectedRoute where needed
    - Apply Layout to authenticated routes
    - _Requirements: 1.1, 2.1_

- [ ] 18. Loading States and Error Handling
  - [ ] 18.1 Create Loading components
    - Create `src/components/LoadingSpinner.tsx`
    - Create `src/components/PageLoader.tsx`
    - Create `src/components/ButtonLoader.tsx`
    - _Requirements: 8.1, 8.3_

  - [ ] 18.2 Implement global error handling
    - Create error boundary component
    - Add API error transformation utility
    - _Requirements: 8.2_

  - [ ]* 18.3 Write property test for loading states
    - **Property 14: Loading State Display**
    - **Validates: Requirements 8.1, 8.3**

- [ ] 19. Responsive Design Polish
  - [ ] 19.1 Implement responsive breakpoints
    - Test and adjust layouts for desktop (1024px+)
    - Test and adjust layouts for tablet (768px-1023px)
    - Test and adjust layouts for mobile (<768px)
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 20. Final Integration and Testing
  - [ ] 20.1 Integration testing
    - Test login → dashboard flow
    - Test query submission flow
    - Test approval/rejection flow
    - Test clone functionality
    - _Requirements: All_

  - [ ]* 20.2 Write property test for URL security
    - **Property 16: URL Parameter Security**
    - **Validates: Requirements 10.2**

- [ ] 21. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all pages match PRD wireframes
  - Confirm responsive design works across breakpoints

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The frontend will be in a separate `frontend` directory to avoid conflicts with the backend
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
