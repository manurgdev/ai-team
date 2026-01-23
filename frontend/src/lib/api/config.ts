import apiClient from './client';
import { Provider, ApiKey, SaveApiKeyDto } from '../types/config.types';

export const configApi = {
  getProviders: async (): Promise<Provider[]> => {
    const response = await apiClient.get<Provider[]>('/config/providers');
    return response.data;
  },

  getApiKeys: async (): Promise<ApiKey[]> => {
    const response = await apiClient.get<ApiKey[]>('/config/api-keys');
    return response.data;
  },

  saveApiKey: async (data: SaveApiKeyDto): Promise<ApiKey> => {
    const response = await apiClient.post<ApiKey>('/config/api-keys', data);
    return response.data;
  },

  deleteApiKey: async (provider: string): Promise<void> => {
    await apiClient.delete(`/config/api-keys/${provider}`);
  },

  validateApiKey: async (provider: string, apiKey: string): Promise<boolean> => {
    const response = await apiClient.post<{ valid: boolean }>(
      '/config/api-keys/validate',
      { provider, apiKey }
    );
    return response.data.valid;
  },
};
