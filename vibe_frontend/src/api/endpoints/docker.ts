import { apiClient } from "../client";

// Docker-related interfaces
export interface RunAppParams {
  installCommand?: string;
  startCommand?: string;
}

export interface DockerStatus {
  appId: string;
  isRunning: boolean;
  isReady?: boolean;
  hasDependenciesInstalled?: boolean;
  port?: number;
  uptime?: number;
  status?: string;
  health?: string;
  containerizationEnabled?: boolean;
  mode?: string;
}

export interface DockerServiceStatus {
  enabled: boolean;
  available: boolean;
  config: {
    enabled: boolean;
    port: number;
    image: string;
    network: string;
  };
  runningContainers: number;
  runningAppIds: number[];
}

export interface RunAppResponse {
  success: boolean;
  message: string;
  data: {
    appId: number;
    containerName: string;
    port: number;
  };
}

// Docker API methods
export const dockerApi = {
  /**
   * Run an app in Docker
   * POST /api/apps/:appId/run
   */
  runInDocker: async (
    appId: number,
    params?: RunAppParams,
  ): Promise<{ appId: number; containerName: string; port: number }> => {
    return apiClient.post<{
      appId: number;
      containerName: string;
      port: number;
    }>(`/apps/${appId}/run`, params);
  },

  /**
   * Stop a Docker app
   * POST /api/apps/:appId/stop
   */
  stopDocker: async (
    appId: number,
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(
      `/apps/${appId}/stop`,
    );
  },

  /**
   * Restart a Docker app (stops and restarts with quick startup)
   * POST /api/apps/:appId/restart
   */
  restartDocker: async (
    appId: number,
  ): Promise<{
    success: boolean;
    message: string;
    data: { appId: string; port: number; url: string };
  }> => {
    return apiClient.post<{
      success: boolean;
      message: string;
      data: { appId: string; port: number; url: string };
    }>(`/apps/${appId}/restart`);
  },

  /**
   * Get Docker status for an app
   * GET /api/apps/:appId/status
   */
  getDockerStatus: async (appId: number): Promise<DockerStatus> => {
    return apiClient.get<DockerStatus>(`/apps/${appId}/status`);
  },

  /**
   * Cleanup Docker volumes for an app
   * POST /api/apps/:appId/cleanup
   */
  cleanupDocker: async (
    appId: number,
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(
      `/apps/${appId}/cleanup`,
    );
  },

  /**
   * Sync updated files to running container
   * POST /api/apps/:appId/sync
   */
  syncToDocker: async (
    appId: number,
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(
      `/apps/${appId}/sync`,
    );
  },

  /**
   * Get Docker service status
   * GET /api/docker/status
   */
  getDockerServiceStatus: async (): Promise<DockerServiceStatus> => {
    return apiClient.get<DockerServiceStatus>("/docker/status");
  },
};
