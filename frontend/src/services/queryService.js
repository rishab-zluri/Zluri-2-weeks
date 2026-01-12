import api from './api';

/**
 * Query Service
 * Handles all query/script submission and management API calls
 */
const queryService = {
  // ==================== Metadata ====================
  
  /**
   * Get all database instances
   * @param {string} type - Optional filter by type (postgresql/mongodb)
   * @returns {Promise<Object>}
   */
  async getInstances(type = null) {
    const params = type ? { type } : {};
    const response = await api.get('/api/queries/instances', { params });
    return response.data;
  },

  /**
   * Get databases for an instance
   * @param {string} instanceId 
   * @returns {Promise<Object>}
   */
  async getDatabases(instanceId) {
    const response = await api.get(`/api/queries/instances/${instanceId}/databases`);
    return response.data;
  },

  /**
   * Get all PODs
   * @returns {Promise<Object>}
   */
  async getPods() {
    const response = await api.get('/api/queries/pods');
    return response.data;
  },

  // ==================== Submission ====================

  /**
   * Submit a query request
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async submitQuery(data) {
    const response = await api.post('/api/queries/submit', data);
    return response.data;
  },

  /**
   * Submit a script execution request
   * @param {FormData} formData 
   * @returns {Promise<Object>}
   */
  async submitScript(formData) {
    const response = await api.post('/api/queries/submit-script', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // ==================== User Requests ====================

  /**
   * Get current user's requests
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>}
   */
  async getMyRequests(params = {}) {
    const response = await api.get('/api/queries/my-requests', { params });
    return response.data;
  },

  /**
   * Get status counts for current user
   * @returns {Promise<Object>}
   */
  async getMyStatusCounts() {
    const response = await api.get('/api/queries/my-status-counts');
    return response.data;
  },

  /**
   * Get a specific request by UUID
   * @param {string} uuid 
   * @returns {Promise<Object>}
   */
  async getRequest(uuid) {
    const response = await api.get(`/api/queries/requests/${uuid}`);
    return response.data;
  },

  /**
   * Clone and resubmit a request
   * @param {string} uuid 
   * @returns {Promise<Object>}
   */
  async cloneRequest(uuid) {
    const response = await api.post(`/api/queries/requests/${uuid}/clone`);
    return response.data;
  },

  // ==================== Approval (Manager/Admin) ====================

  /**
   * Get pending requests for approval
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>}
   */
  async getPendingRequests(params = {}) {
    const response = await api.get('/api/queries/pending', { params });
    return response.data;
  },

  /**
   * Approve a request
   * @param {string} uuid 
   * @param {Object} data - Optional approval data
   * @returns {Promise<Object>}
   */
  async approveRequest(uuid, data = {}) {
    const response = await api.post(`/api/queries/requests/${uuid}/approve`, data);
    return response.data;
  },

  /**
   * Reject a request
   * @param {string} uuid 
   * @param {string} reason - Optional rejection reason
   * @returns {Promise<Object>}
   */
  async rejectRequest(uuid, reason = null) {
    const response = await api.post(`/api/queries/requests/${uuid}/reject`, { reason });
    return response.data;
  },

  // ==================== Admin ====================

  /**
   * Get all requests (admin only)
   * @param {Object} params 
   * @returns {Promise<Object>}
   */
  async getAllRequests(params = {}) {
    const response = await api.get('/api/queries/all', { params });
    return response.data;
  },

  /**
   * Get query statistics (admin only)
   * @returns {Promise<Object>}
   */
  async getStats() {
    const response = await api.get('/api/queries/stats');
    return response.data;
  },
};

export default queryService;
