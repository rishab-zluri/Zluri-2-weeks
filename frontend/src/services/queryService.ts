import client, { ApiResponse } from '@/api/client';
import {
  QueryRequest,
  PaginatedResponse,
  DatabaseType
} from '@/types';

// Input Types
export interface SubmitQueryInput {
  instanceId: string;
  databaseName: string;
  queryContent: string;
  comments: string;
  podId: string;
  databaseType: DatabaseType;
}

export interface SubmitScriptInput {
  instanceId: string;
  databaseName: string;
  scriptFile: File;
  comments: string;
  podId: string;
  databaseType: DatabaseType;
}

export interface RequestFilters {
  status?: string | string[];
  podId?: string | string[];
  databaseType?: DatabaseType;
  submissionType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  // Legacy support
  forApproval?: boolean;
}

// Response Types
export interface DatabaseInstance {
  id: string; // or uuid
  instanceId: string;
  name: string;
  host: string;
  type: DatabaseType;
  port: number;
}

export interface DatabaseSchema {
  name: string;
  size?: string;
}

export interface Pod {
  id: string;
  name: string;
  code: string;
}

export interface StatusCounts {
  pending: number;
  approved: number;
  rejected: number;
  failed: number;
  total: number;
}

/**
 * Query Service
 * Handles all query/script submission and management API calls
 */
const queryService = {
  // ==================== Metadata ====================

  async getInstances(type?: DatabaseType | null): Promise<DatabaseInstance[]> {
    const params = type ? { type } : {};
    const response = await client.get<ApiResponse<DatabaseInstance[]>>('/api/queries/instances', { params });
    return response.data.data;
  },

  async getDatabases(instanceId: string): Promise<string[]> {
    const response = await client.get<ApiResponse<string[]>>(`/api/queries/instances/${instanceId}/databases`);
    return response.data.data;
  },

  async getPods(params: object = {}): Promise<Pod[]> {
    const response = await client.get<ApiResponse<Pod[]>>('/api/queries/pods', { params });
    return response.data.data;
  },

  // ==================== Submission ====================

  async submitQuery(data: SubmitQueryInput): Promise<QueryRequest> {
    const response = await client.post<ApiResponse<QueryRequest>>('/api/queries/submit', data);
    return response.data.data;
  },

  async submitScript(data: SubmitScriptInput): Promise<QueryRequest> {
    const formData = new FormData();
    formData.append('instanceId', data.instanceId);
    formData.append('databaseName', data.databaseName);
    formData.append('script', data.scriptFile);
    formData.append('comments', data.comments);
    formData.append('podId', data.podId);
    formData.append('databaseType', data.databaseType);

    const response = await client.post<ApiResponse<QueryRequest>>('/api/queries/submit-script', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  // ==================== Requests Fetching ====================

  /**
   * Unified Request Search
   * Replaces getMyRequests, getPendingRequests, getAllRequests
   */
  async getRequests(params: RequestFilters = {}): Promise<PaginatedResponse<QueryRequest>> {
    // Map legacy params if needed, or just pass through
    // The backend now accepts generic filters
    const response = await client.get<ApiResponse<PaginatedResponse<QueryRequest>>>('/api/requests', { params });
    return response.data.data;
  },

  /**
   * Legacy wrapper for "My Requests" - delegates to unified endpoint
   */
  async getMyRequests(params: RequestFilters = {}): Promise<PaginatedResponse<QueryRequest>> {
    // Current user ID is inferred by backend from token
    return this.getRequests(params);
  },

  /**
   * Legacy wrapper for "Pending Approval" - delegates to unified endpoint
   */
  async getPendingRequests(params: RequestFilters = {}): Promise<PaginatedResponse<QueryRequest>> {
    return this.getRequests({ ...params, status: 'pending' });
  },

  async getRequest(uuid: string): Promise<QueryRequest> {
    const response = await client.get<ApiResponse<QueryRequest>>(`/api/queries/requests/${uuid}`);
    return response.data.data;
  },

  async getMyStatusCounts(): Promise<StatusCounts> {
    const response = await client.get<ApiResponse<StatusCounts>>('/api/queries/my-status-counts');
    return response.data.data;
  },

  // ==================== Actions ====================

  async cloneRequest(uuid: string): Promise<QueryRequest> {
    const response = await client.post<ApiResponse<QueryRequest>>(`/api/queries/requests/${uuid}/clone`);
    return response.data.data;
  },

  async approveRequest(uuid: string, data: object = {}): Promise<QueryRequest> {
    const response = await client.post<ApiResponse<QueryRequest>>(`/api/queries/requests/${uuid}/approve`, data);
    return response.data.data;
  },

  async rejectRequest(uuid: string, reason: string | null = null): Promise<QueryRequest> {
    const response = await client.post<ApiResponse<QueryRequest>>(`/api/queries/requests/${uuid}/reject`, { reason });
    return response.data.data;
  },
};

export default queryService;
