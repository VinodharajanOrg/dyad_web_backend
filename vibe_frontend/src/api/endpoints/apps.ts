import { apiClient } from "../client";

export interface App {
  id: number;
  userId?: number;
  name: string;
  path: string;
  files?: string[];
  createdAt: Date;
  updatedAt: Date;
  githubOrg: string | null;
  githubRepo: string | null;
  githubBranch: string | null;
  supabaseProjectId: string | null;
  supabaseParentProjectId: string | null;
  supabaseProjectName?: string | null;
  neonProjectId: string | null;
  neonDevelopmentBranchId: string | null;
  neonPreviewBranchId: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  vercelTeamId?: string | null;
  vercelTeamSlug?: string | null;
  vercelDeploymentUrl: string | null;
  installCommand: string | null;
  startCommand: string | null;
  chatContext?: any;
  isFavorite: boolean;
}

export interface CreateAppParams {
  name: string;
  path?: string;
  githubOrg?: string;
  githubRepo?: string;
  githubBranch?: string;
  installCommand?: string;
  startCommand?: string;
}

export interface UpdateAppParams {
  name?: string;
  path?: string;
  renameFolder?: boolean;
  isFavorite?: boolean;
  installCommand?: string;
  startCommand?: string;
  chatContext?: any;
}

export interface CopyAppParams {
  name?: string;
}

export const appsApi = {
  /**
   * List all apps
   * GET /api/apps
   */
  list: async (): Promise<{ apps: App[] }> => {
    return apiClient.get<{ apps: App[] }>("/apps");
  },

  /**
   * Get a specific app
   * GET /api/apps/:id
   */
  get: async (appId: number): Promise<App> => {
    const app = await apiClient.get<App>(`/apps/${appId}`);
    return app;
  },

  /**
   * Create a new app
   * POST /api/apps
   */
  create: async (params: CreateAppParams): Promise<App> => {
    return apiClient.post<App>("/apps", params);
  },

  /**
   * Update an app
   * PUT /api/apps/:id
   */
  update: async (appId: number, params: UpdateAppParams): Promise<App> => {
    return apiClient.put<App>(`/apps/${appId}`, params);
  },

  /**
   * Delete an app
   * DELETE /api/apps/:id
   */
  delete: async (appId: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/apps/${appId}`);
  },

  /**
   * Copy an app
   * POST /api/apps/:id/copy
   */
  copy: async (appId: number, params: CopyAppParams): Promise<App> => {
    return apiClient.post<App>(`/apps/${appId}/copy`, params);
  },

  /**
   * Toggle favorite status
   * POST /api/apps/:id/favorite
   */
  toggleFavorite: async (appId: number): Promise<App> => {
    return apiClient.post<App>(`/apps/${appId}/favorite`);
  },

  /**
   * Search for apps by name
   * GET /api/apps/search?name={query}
   * Returns full app details including chatContext
   */
  search: async (query: string): Promise<App[]> => {
    return apiClient.get<App[]>("/apps/search", {
      params: { name: query },
    });
  },
};
