import api from './api';

/**
 * Secrets Service
 * Handles AWS Secrets Manager API calls
 */
const secretsService = {
  /**
   * Get all secrets
   * @returns {Promise<Object>}
   */
  async getSecrets() {
    const response = await api.get('/api/secrets');
    return response.data;
  },

  /**
   * Search secrets by query
   * @param {string} query 
   * @returns {Promise<Object>}
   */
  async searchSecrets(query) {
    const response = await api.get('/api/secrets/search', {
      params: { q: query },
    });
    return response.data;
  },

  /**
   * Get a specific secret value
   * @param {string} secretName 
   * @returns {Promise<Object>}
   */
  async getSecret(secretName) {
    const encodedName = encodeURIComponent(secretName);
    const response = await api.get(`/api/secrets/${encodedName}`);
    return response.data;
  },

  /**
   * Download secret as JSON file
   * @param {string} secretName 
   */
  async downloadSecret(secretName) {
    const data = await this.getSecret(secretName);
    const blob = new Blob([JSON.stringify(data.data.value, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${secretName.replace(/\//g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

export default secretsService;
