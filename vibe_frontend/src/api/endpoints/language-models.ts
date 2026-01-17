import { apiClient } from "../client";
import type { Provider } from "./language-model-providers";

export interface LanguageModel {
  id: number;
  displayName: string;
  apiName: string;
  builtinProviderId: number | null;
  customProviderId: number | null;
  description: string | null;
  maxOutputTokens: number | null;
  contextWindow: number | null;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderWithModelsResponse {
  provider: Provider;
  models: LanguageModel[];
}

export interface CreateModelParams {
  displayName: string;
  apiName: string;
  builtinProviderId?: string;
  customProviderId?: string;
  description?: string;
  maxOutputTokens?: number;
  contextWindow?: number;
  approved?: boolean;
}

export interface CreateModelResponse {
  message: string;
  model: LanguageModel;
}

export interface UpdateModelParams {
  displayName?: string;
  apiName?: string;
  builtinProviderId?: string | null;
  customProviderId?: string | null;
  description?: string;
  maxOutputTokens?: number;
  contextWindow?: number;
  approved?: boolean;
}

export interface UpdateModelResponse {
  message: string;
  data: LanguageModel;
}

export interface DeleteModelResponse {
  message: string;
  data: {
    model: LanguageModel;
  };
}

export const languageModelsApi = {
  /**
   * List all language models for current user
   * GET /api/language-models
   */
  list: async (): Promise<{ models: LanguageModel[] }> => {
    return apiClient.get<{ models: LanguageModel[] }>("/language-models");
  },

  /**
   * Get a specific language model
   * GET /api/language-models/:id
   */
  get: async (id: number): Promise<LanguageModel> => {
    return apiClient.get<LanguageModel>(`/language-models/${id}`);
  },

  /**
   * Create a new language model for a specific provider
   * POST /api/settings/provider/:providerId/model
   */
  create: async (
    providerId: number,
    params: CreateModelParams,
  ): Promise<CreateModelResponse> => {
    return apiClient.post<CreateModelResponse>(
      `/providers/${providerId}/model`,
      params,
    );
  },

  /**
   * Update a language model
   * PUT /api/settings/models/:modelId
   */
  update: async (
    modelId: number,
    params: UpdateModelParams,
  ): Promise<UpdateModelResponse> => {
    return apiClient.put<UpdateModelResponse>(
      `/providers/models/${modelId}`,
      params,
    );
  },

  /**
   * Delete a language model
   * DELETE /api/settings/provider-model?modelId=:id
   */
  delete: async (modelId: number): Promise<DeleteModelResponse> => {
    return apiClient.delete<DeleteModelResponse>(
      `/providers/provider-model?modelId=${modelId}`,
    );
  },

  /**
   * Get provider and all associated models by provider ID
   * GET /api/settings/provider/:providerId/models
   */
  getProviderModels: async (
    providerId: number,
  ): Promise<ProviderWithModelsResponse> => {
    return apiClient.get<ProviderWithModelsResponse>(
      `/providers/${providerId}/models`,
    );
  },
};
