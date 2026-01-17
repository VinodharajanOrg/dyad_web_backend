import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dockerApi,
  DockerStatus,
  DockerServiceStatus,
  RunAppParams,
} from '../endpoints/docker';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('dockerApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockDockerStatus = (overrides?: Partial<DockerStatus>): DockerStatus => ({
    appId: '1',
    isRunning: false,
    isReady: false,
    hasDependenciesInstalled: false,
    port: undefined,
    uptime: 0,
    status: 'stopped',
    health: 'unknown',
    containerizationEnabled: false,
    mode: 'local',
    ...overrides,
  });

  describe('runInDocker()', () => {
    it('should run app in Docker', async () => {
      const params: RunAppParams = {
        installCommand: 'npm install',
        startCommand: 'npm start',
      };

      const mockResponse = {
        appId: 1,
        containerName: 'app-1-container',
        port: 3000,
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await dockerApi.runInDocker(1, params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/run', params);
      expect(result.port).toBe(3000);
      expect(result.containerName).toContain('app-1');
    });

    it('should run app without custom commands', async () => {
      const mockResponse = {
        appId: 1,
        containerName: 'app-1',
        port: 8000,
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await dockerApi.runInDocker(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/run', undefined);
      expect(result.port).toBe(8000);
    });
  });

  describe('stopDocker()', () => {
    it('should stop Docker app', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({
        success: true,
        message: 'App stopped',
      });

      const result = await dockerApi.stopDocker(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/stop');
      expect(result.success).toBe(true);
    });
  });

  describe('restartDocker()', () => {
    it('should restart Docker app', async () => {
      const mockResponse = {
        success: true,
        message: 'Restarted',
        data: { appId: '1', port: 3000, url: 'http://localhost:3000' },
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await dockerApi.restartDocker(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/restart');
      expect(result.data.appId).toBe('1');
    });
  });

  // ---------- FIXED TESTS BELOW ----------
  describe('getDockerStatus()', () => {
    it('should get Docker app status', async () => {
      const mockStatus = createMockDockerStatus({
        isRunning: true,
        isReady: true,
        port: 3000,
        status: 'running',
      });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStatus);

      const result = await dockerApi.getDockerStatus(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/apps/1/status');
      expect(result.isRunning).toBe(true);
      expect(result.port).toBe(3000);
    });

    it('should handle stopped app status', async () => {
      const mockStatus = createMockDockerStatus({
        isRunning: false,
        status: 'stopped',
      });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStatus);

      const result = await dockerApi.getDockerStatus(1);

      expect(result.isRunning).toBe(false);
    });
  });

  describe('getDockerServiceStatus()', () => {
    it('should get Docker service status', async () => {
      const mockServiceStatus: DockerServiceStatus = {
        enabled: true,
        available: true,
        config: {
          enabled: true,
          port: 2375,
          image: 'node:18',
          network: 'dyad-network',
        },
        runningContainers: 2,
        runningAppIds: [1, 2],
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockServiceStatus);

      const result = await dockerApi.getDockerServiceStatus();

      expect(mockApiClient.get).toHaveBeenCalledWith('/docker/status');
      expect(result.enabled).toBe(true);
      expect(result.runningContainers).toBe(2);
    });
  });

  describe('Integration scenarios', () => {
    it('should run → get status → stop app', async () => {
      const runResponse = {
        appId: 1,
        containerName: 'app-1',
        port: 3000,
      };

      const statusResponse = createMockDockerStatus({
        isRunning: true,
        port: 3000,
      });

      const stopResponse = { success: true, message: 'Stopped' };

      vi.mocked(mockApiClient.post)
        .mockResolvedValueOnce(runResponse)
        .mockResolvedValueOnce(stopResponse);

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(statusResponse);

      const run = await dockerApi.runInDocker(1);
      expect(run.port).toBe(3000);

      const status = await dockerApi.getDockerStatus(1);
      expect(status.isRunning).toBe(true);

      const stop = await dockerApi.stopDocker(1);
      expect(stop.success).toBe(true);
    });
  });

  describe('cleanupDocker()', () => {
    it('should cleanup Docker volumes', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({
        success: true,
        message: 'Cleanup completed',
      });

      const result = await dockerApi.cleanupDocker(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/cleanup');
      expect(result.success).toBe(true);
    });

    it('should handle cleanup failure', async () => {
      const error = new Error('Cleanup failed');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(dockerApi.cleanupDocker(1)).rejects.toThrow('Cleanup failed');
    });
  });

  describe('syncToDocker()', () => {
    it('should sync files to container', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({
        success: true,
        message: 'Files synced',
      });

      const result = await dockerApi.syncToDocker(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/sync');
      expect(result.success).toBe(true);
    });

    it('should handle sync errors', async () => {
      const error = new Error('Sync failed');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(dockerApi.syncToDocker(1)).rejects.toThrow('Sync failed');
    });
  });

  describe('Extended tests for better coverage', () => {
    it('runInDocker should handle error', async () => {
      const error = new Error('Docker daemon not available');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(dockerApi.runInDocker(1)).rejects.toThrow('Docker daemon not available');
    });

    it('stopDocker should handle error', async () => {
      const error = new Error('Container not found');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(dockerApi.stopDocker(1)).rejects.toThrow('Container not found');
    });

    it('restartDocker should return port', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({
        success: true,
        message: 'Restarted successfully',
        data: { appId: '10', port: 4000, url: 'http://localhost:4000' },
      });

      const result = await dockerApi.restartDocker(10);

      expect(result.data.port).toBe(4000);
      expect(result.data.url).toContain('4000');
    });

    it('getDockerStatus should handle unhealthy status', async () => {
      const mockStatus = createMockDockerStatus({
        isRunning: true,
        isReady: false,
        status: 'unhealthy',
        health: 'unhealthy',
      });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStatus);

      const result = await dockerApi.getDockerStatus(1);

      expect(result.health).toBe('unhealthy');
      expect(result.isReady).toBe(false);
    });

    it('getDockerServiceStatus should handle disabled service', async () => {
      const mockServiceStatus: DockerServiceStatus = {
        enabled: false,
        available: false,
        config: {
          enabled: false,
          port: 0,
          image: '',
          network: '',
        },
        runningContainers: 0,
        runningAppIds: [],
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockServiceStatus);

      const result = await dockerApi.getDockerServiceStatus();

      expect(result.enabled).toBe(false);
      expect(result.runningContainers).toBe(0);
    });

    it('getDockerServiceStatus should handle multiple running containers', async () => {
      const mockServiceStatus: DockerServiceStatus = {
        enabled: true,
        available: true,
        config: {
          enabled: true,
          port: 2375,
          image: 'node:18',
          network: 'dyad-network',
        },
        runningContainers: 5,
        runningAppIds: [1, 2, 3, 4, 5],
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockServiceStatus);

      const result = await dockerApi.getDockerServiceStatus();

      expect(result.runningContainers).toBe(5);
      expect(result.runningAppIds).toHaveLength(5);
    });
  });
});
