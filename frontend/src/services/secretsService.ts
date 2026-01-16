import client, { ApiResponse } from '@/api/client';

export interface SecretResponse {
  name: string;
  value: any;
}

export interface SecretsListResponse {
  secrets: string[];
}

/**
 * Secrets Service
 * Handles AWS Secrets Manager API calls
 */
const secretsService = {
  /**
   * Get all secrets
   */
  async getSecrets(): Promise<ApiResponse<SecretsListResponse>> {
    const response = await client.get<ApiResponse<SecretsListResponse>>('/api/secrets');
    return response.data;
  },

  /**
   * Search secrets by query
   */
  async searchSecrets(query: string): Promise<ApiResponse<SecretsListResponse>> {
    const response = await client.get<ApiResponse<SecretsListResponse>>('/api/secrets/search', {
      params: { q: query },
    });
    return response.data;
  },

  /**
   * Get a specific secret value
   */
  async getSecret(secretName: string): Promise<ApiResponse<SecretResponse>> {
    const encodedName = encodeURIComponent(secretName);
    const response = await client.get<ApiResponse<SecretResponse>>(`/api/secrets/${encodedName}`);
    return response.data;
  },

  /**
   * Download secret as JSON file
   */
  async downloadSecret(secretName: string): Promise<void> {
    const data = await this.getSecret(secretName);
    if (!data.data) {
      throw new Error('Secret data not found');
    }
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
