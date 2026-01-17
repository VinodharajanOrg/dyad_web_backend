import { apiClient } from "../client";

export interface UserSettingsResponse {
  id: number;
  userId: string;
  selectedModel: {
    id: string;
    name: string;
    providerId: string;
  };
  apiKeys: {
    [providerName: string]: string;
  };
  selectedChatMode: string;
  smartContextEnabled: boolean;
  turboEditsV2Enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateApiKeyParams {
  apiKey: string;
}

export interface UpdateApiKeyResponse {
  message: string;
}

/**
 * Settings API endpoints
 * GET /api/settings endpoint returns user settings with apiKeys
 */
export const settingsApi = {
  getSettings: async (): Promise<UserSettingsResponse> => {
    return apiClient.get<UserSettingsResponse>("/settings");
  },

  /**
   * Update API key for a specific provider
   * PUT /api/settings/api-keys/:provider
   */
  updateApiKey: async (
    providerName: string,
    params: UpdateApiKeyParams,
  ): Promise<UpdateApiKeyResponse> => {
    return apiClient.put<UpdateApiKeyResponse>(
      `/settings/api-keys/${providerName.toLowerCase()}`,
      params,
    );
  },

  /**
   * Delete API key for a specific provider
   */
  deleteApiKey: async (providerName: string): Promise<UpdateApiKeyResponse> => {
    return apiClient.delete<UpdateApiKeyResponse>(
      `/settings/api-keys/${providerName.toLowerCase()}`,
    );
  },
};
