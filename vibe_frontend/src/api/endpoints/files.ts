import { apiClient } from "../client";

export interface FileInfo {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface FileStats {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  createdAt: Date;
  modifiedAt: Date;
}

export const filesApi = {
  /**
   * Read file content
   * GET /api/files/:appId/read?path=:path
   */
  readFile: async (appId: number, filePath: string): Promise<string> => {
    const response = await apiClient.get<{ content: string }>(
      `/files/${appId}/read`,
      { params: { path: filePath } },
    );
    return response.content;
  },

  /**
   * Write file content
   * POST /api/files/:appId/write
   */
  writeFile: async (
    appId: number,
    filePath: string,
    content: string,
  ): Promise<{ warning?: string }> => {
    const response = await apiClient.post<{ warning?: string }>(
      `/files/${appId}/write`,
      {
        path: filePath,
        content,
      },
    );
    return response || {};
  },

  /**
   * Delete file
   * DELETE /api/files/:appId?path=:path
   */
  deleteFile: async (appId: number, filePath: string): Promise<void> => {
    await apiClient.delete(`/files/${appId}`, {
      params: { path: filePath },
    });
  },

  /**
   * List files in directory
   * GET /api/files/:appId?path=:path
   */
  listFiles: async (
    appId: number,
    dirPath: string = "",
  ): Promise<FileInfo[]> => {
    return apiClient.get<FileInfo[]>(`/files/${appId}`, {
      params: { path: dirPath },
    });
  },

  /**
   * Create directory
   * POST /api/files/:appId/mkdir
   */
  createDirectory: async (appId: number, dirPath: string): Promise<void> => {
    await apiClient.post(`/files/${appId}/mkdir`, {
      path: dirPath,
    });
  },

  /**
   * Get file stats
   * GET /api/files/:appId/stats?path=:path
   */
  getFileStats: async (appId: number, filePath: string): Promise<FileStats> => {
    return apiClient.get<FileStats>(`/files/${appId}/stats`, {
      params: { path: filePath },
    });
  },

  /**
   * Check if file exists
   * Uses getFileStats internally
   */
  exists: async (appId: number, filePath: string): Promise<boolean> => {
    try {
      await filesApi.getFileStats(appId, filePath);
      return true;
    } catch {
      return false;
    }
  },
};
