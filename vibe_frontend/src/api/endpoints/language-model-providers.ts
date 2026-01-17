import { apiClient } from "../client";
import type { LanguageModel } from "./language-models";

export interface ProviderWithModels {
  id: number;
  name: string;
  apiBaseUrl: string;
  envVarName: string | null;
  models: LanguageModel[];
}

/**
 * Provider data returned from /api/providers/provider-model endpoint
 * Contains provider info with all associated models
 */
export interface ProviderModelData extends Omit<ProviderWithModels, 'models'> {
  models: LanguageModel[];
}

export interface AllProvidersWithModelsResponse {
  data: Record<string, ProviderModelData>;
}

export interface LanguageModelProvidersResponse {
  data: Provider[];
}

export interface CreateProviderParams {
  name: string;
  apiBaseUrl: string;
  envVarName?: string;
}

export interface Provider {
  id: number;
  name: string;
  apiBaseUrl: string;
  envVarName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderResponse {
  success: boolean;
  message: string;
  provider: Provider;
}

export interface UpdateProviderParams {
  name?: string;
  apiBaseUrl?: string;
  envVarName?: string;
}

export interface DeleteProviderResponse {
  message: string;
  data: {
    provider: Provider;
    modelsDeleted: boolean;
  };
}

export interface UpdateProviderResponse {
  success: boolean;
  message: string;
  data: Provider;
}

export const languageModelProvidersApi = {
  /**
   * List all language model providers for current user
   * GET /api/settings/providers
   */
  list: async (): Promise<Provider[]> => {
    return apiClient.get<Provider[]>("/providers/all_providers");
  },

  /**
   * Get a specific language model provider
   * GET /api/language-model-providers/:id
   */
  get: async (id: string): Promise<LanguageModelProvidersResponse> => {
    return apiClient.get<LanguageModelProvidersResponse>(
      `/language-model-providers/${id}`,
    );
  },

  /**
   * Create a new language model provider
   * POST /api/settings/provider
   */
  create: async (
    params: CreateProviderParams,
  ): Promise<CreateProviderResponse> => {
    return apiClient.post<CreateProviderResponse>(
      "/providers/provider",
      params,
    );
  },

  /**
   * Update a language model provider
   * PUT /api/settings/providers/:providerId
   */
  update: async (
    providerId: number,
    params: UpdateProviderParams,
  ): Promise<UpdateProviderResponse> => {
    return apiClient.put<UpdateProviderResponse>(
      `/providers/${providerId}`,
      params,
    );
  },

  /**
   * Delete a language model provider
   * DELETE /api/settings/provider-model?providerId=:id
   */
  delete: async (id: string): Promise<DeleteProviderResponse> => {
    return apiClient.delete<DeleteProviderResponse>(
      `/providers/provider-model?providerId=${id}`,
    );
  },

  /**
   * Get all providers with their models in a single request
   * GET /api/providers/provider-model
   */
  getAllProvidersWithModels: async (): Promise<AllProvidersWithModelsResponse> => {
    return apiClient.get<AllProvidersWithModelsResponse>(
      "/providers/provider-model",
    );
  },
};
