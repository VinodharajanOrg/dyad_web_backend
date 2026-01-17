import { apiClient } from "../client";

export interface Prompt {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePromptParams {
  title: string;
  description?: string;
  content: string;
}

export interface UpdatePromptParams {
  title?: string;
  description?: string;
  content?: string;
}

export const promptsApi = {
  /**
   * List all prompts for current user
   * GET /api/prompts
   */
  list: async (): Promise<{ prompts: Prompt[] }> => {
    return apiClient.get<{ prompts: Prompt[] }>("/prompts");
  },

  /**
   * Get a specific prompt
   * GET /api/prompts/:id
   */
  get: async (id: number): Promise<Prompt> => {
    return apiClient.get<Prompt>(`/prompts/${id}`);
  },

  /**
   * Create a new prompt
   * POST /api/prompts
   */
  create: async (params: CreatePromptParams): Promise<Prompt> => {
    return apiClient.post<Prompt>("/prompts", params);
  },

  /**
   * Update a prompt
   * PUT /api/prompts/:id
   */
  update: async (id: number, params: UpdatePromptParams): Promise<Prompt> => {
    return apiClient.put<Prompt>(`/prompts/${id}`, params);
  },

  /**
   * Delete a prompt
   * DELETE /api/prompts/:id
   */
  delete: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/prompts/${id}`);
  },

  /**
   * Search prompts by title or content
   * GET /api/prompts/search?query=:query
   */
  search: async (query: string): Promise<Prompt[]> => {
    return apiClient.get<Prompt[]>("/prompts/search", { params: { query } });
  },
};
