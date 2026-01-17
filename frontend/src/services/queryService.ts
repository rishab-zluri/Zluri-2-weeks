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
  completed?: number;
  executing?: number;
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
    // Use the database sync service endpoint which has real cached database data
    // API returns array of {name, description, source, last_seen_at} objects
    interface DatabaseEntry {
      name: string;
      description?: string;
      source?: string;
      last_seen_at?: string;
    }
    const response = await client.get<ApiResponse<DatabaseEntry[]>>(`/api/v1/databases/instances/${instanceId}/databases`);
    return response.data.data.map(db => db.name);
  },

  async getPods(params: object = {}): Promise<Pod[]> {
    const response = await client.get<ApiResponse<Pod[]>>('/api/queries/pods', { params });
    return response.data.data;
  },

  // ==================== Submission ====================

  async submitQuery(data: SubmitQueryInput): Promise<QueryRequest> {
    const response = await client.post<ApiResponse<QueryRequest>>('/api/queries/submit', { ...data, submissionType: 'query' });
    return response.data.data;
  },

  async submitScript(data: SubmitScriptInput): Promise<QueryRequest> {
    const formData = new FormData();
    formData.append('instanceId', data.instanceId);
    formData.append('databaseName', data.databaseName);
    formData.append('scriptFile', data.scriptFile);
    formData.append('comments', data.comments);
    formData.append('podId', data.podId);
    formData.append('databaseType', data.databaseType);
    formData.append('submissionType', 'script'); // Required by backend validation

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
  async getRequests(params: RequestFilters = {}, signal?: AbortSignal): Promise<PaginatedResponse<QueryRequest>> {
    // Backend returns flat structure: { success, data: [], pagination: {} }
    // We need to return { data: [], pagination: {} } to match PaginatedResponse interface
    const response = await client.get<{ success: boolean; data: QueryRequest[]; pagination: PaginatedResponse<QueryRequest>['pagination'] }>('/api/queries/requests', { params, signal });
    return {
      data: response.data.data,
      pagination: response.data.pagination,
      success: response.data.success
    } as any;
  },

  /**
   * Get current user's requests (for developers/all users)
   * Uses /my-requests endpoint which doesn't require admin/manager role
   */
  async getMyRequests(params: RequestFilters = {}, signal?: AbortSignal): Promise<PaginatedResponse<QueryRequest>> {
    // Backend returns: { success, message, data: [...], pagination: {...} }
    // We need to extract and return { data, pagination }
    const response = await client.get<{ success: boolean; message: string; data: QueryRequest[]; pagination: PaginatedResponse<QueryRequest>['pagination'] }>('/api/queries/my-requests', { params, signal });
    return {
      success: response.data.success,
      data: response.data.data,
      pagination: response.data.pagination,
    };
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

  // ==================== Query Analysis ====================

  async analyzeQuery(query: string, databaseType: string): Promise<QueryAnalysis> {
    const response = await client.post<ApiResponse<QueryAnalysis>>('/api/v1/queries/analyze', {
      query,
      databaseType,
    });
    return response.data.data;
  },
};

// Query Analysis Types
export interface OperationImpact {
  scope: string;
  reversible: boolean | null;
  estimatedEffect: string;
  rowEstimate?: string;
}

export interface AnalyzedOperation {
  operation: string;
  type: string;
  risk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  description: string;
  impact: OperationImpact;
  count?: number;
  lineNumbers?: number[];
}

export interface AnalysisWarning {
  level: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
  lineNumber?: number;
}

export interface AnalysisRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
}

export interface StatementDetail {
  lineNumber: number;
  statement: string;
  operation: string;
  risk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  type: string;
}

export interface OperationCount {
  operation: string;
  count: number;
  risk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  type: string;
}

export interface RiskBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  safe: number;
}

export interface QueryAnalysis {
  query?: string;
  databaseType: string;
  operations: AnalyzedOperation[];
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  riskColor: string;
  warnings: AnalysisWarning[];
  recommendations: AnalysisRecommendation[];
  summary: string;
  error?: string;
  // Enhanced fields for multi-statement analysis
  statementCount?: number;
  operationCounts?: OperationCount[];
  statementDetails?: StatementDetail[];
  riskBreakdown?: RiskBreakdown;
  isMultiStatement?: boolean;
}

export default queryService;

