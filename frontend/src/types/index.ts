/**
 * Shared Type Definitions
 * Matches Backend DTOs
 */

export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    USER = 'user',
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    picture?: string;
}

export enum RequestStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    EXECUTING = 'executing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export enum DatabaseType {
    POSTGRESQL = 'postgresql',
    MONGODB = 'mongodb',
}

export enum SubmissionType {
    QUERY = 'query',
    SCRIPT = 'script',
}

export interface QueryRequest {
    uuid: string;
    user: User;
    status: RequestStatus;
    databaseType: DatabaseType;
    submissionType: SubmissionType;
    instanceId: string;
    instanceName: string;
    databaseName: string;
    queryContent?: string;
    scriptFilename?: string; // If script
    comments: string;
    podId: string;
    podName: string;
    createdAt: string; // ISO Date String
    approver?: User;
    rejectionReason?: string;
    executionResult?: string; // JSON string or text
    executionError?: string;
    executionStartedAt?: string;
    executionCompletedAt?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
