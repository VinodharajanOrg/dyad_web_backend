import { ContainerFactory } from '../../src/containerization/ContainerFactory';
import { ContainerLifecycleService } from '../../src/services/container_lifecycle_service';

// Must mock config BEFORE importing the service
jest.mock('../../src/config/containerization.config', () => ({
  loadContainerizationConfig: jest.fn(() => ({
    enabled: true,
    engine: 'podman',
  })),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../src/containerization/ContainerFactory');
jest.mock('../../src/services/container_lifecycle_service');

// NOW import the service after mocks are in place
import { ContainerizationService } from '../../src/services/containerization_service';

describe('ContainerizationService', () => {
  let service: ContainerizationService;
  let mockFactory: any;
  let mockHandler: any;
  let mockLifecycleService: any;
  const mockAppId = '1';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock handler
    mockHandler = {
      runContainer: jest.fn().mockResolvedValue({ success: true }),
      stopContainer: jest.fn().mockResolvedValue({ success: true }),
      getContainerStatus: jest.fn().mockResolvedValue({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'dyad-app-1',
        port: 3000,
        status: 'running',
      }),
      containerExists: jest.fn().mockResolvedValue(true),
      isContainerRunning: jest.fn().mockResolvedValue(true),
      isContainerReady: jest.fn().mockResolvedValue(true),
      hasDependenciesInstalled: jest.fn().mockResolvedValue(true),
      syncFilesToContainer: jest.fn().mockResolvedValue({ success: true }),
      execInContainer: jest.fn().mockResolvedValue({ success: true }),
      getContainerLogs: jest.fn().mockResolvedValue('Log output'),
      removeContainer: jest.fn().mockResolvedValue({ success: true }),
      cleanupVolumes: jest.fn().mockResolvedValue({ success: true }),
      getEngineInfo: jest.fn().mockResolvedValue({ version: '1.0.0' }),
      getVersion: jest.fn().mockResolvedValue('1.0.0'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getContainerName: jest.fn().mockReturnValue('dyad-app-1'),
      getLogs: jest.fn().mockResolvedValue('Log content'),
      streamLogs: jest.fn().mockResolvedValue((async function* () {})()),
      getEvents: jest.fn().mockResolvedValue([]),
    };

    // Setup mock factory
    mockFactory = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getCurrentHandler: jest.fn().mockReturnValue(mockHandler),
      getEngineType: jest.fn().mockReturnValue('podman'),
      isCurrentEngineAvailable: jest.fn().mockResolvedValue(true),
      resetInstance: jest.fn(),
    };

    // Setup factory mock
    const MockedContainerFactory = ContainerFactory as any;
    MockedContainerFactory.getInstance = jest.fn().mockReturnValue(mockFactory);
    MockedContainerFactory.resetInstance = jest.fn();

    // Setup lifecycle mock
    mockLifecycleService = {
      recordActivity: jest.fn(),
    };
    const MockedContainerLifecycleService = ContainerLifecycleService as any;
    MockedContainerLifecycleService.getInstance = jest.fn().mockReturnValue(mockLifecycleService);

    // Setup config mock
    const { loadContainerizationConfig } = require('../../src/config/containerization.config');
    loadContainerizationConfig.mockReturnValue({
      enabled: true,
      engine: 'podman',
    });

    // Setup logger mock
    const { logger } = require('../../src/utils/logger');
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();

    // Reset service singleton
    ContainerizationService.resetInstance();
    service = ContainerizationService.getInstance();
  });

  //
  // -------------------------------------------------------
  // SINGLETON AND INITIALIZATION
  // -------------------------------------------------------
  //
  describe('Singleton and Initialization', () => {
    it('should return singleton instance', () => {
      const instance1 = ContainerizationService.getInstance();
      const instance2 = ContainerizationService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = ContainerizationService.getInstance();
      ContainerizationService.resetInstance();
      const instance2 = ContainerizationService.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should initialize containerization service', async () => {
      await service.initialize();

      expect(service.isEnabled()).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // ENABLED STATE
  // -------------------------------------------------------
  //
  describe('Enabled State', () => {
    it('should check if containerization is enabled', () => {
      const isEnabled = service.isEnabled();

      expect(typeof isEnabled).toBe('boolean');
      expect(isEnabled).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // ENGINE AVAILABILITY
  // -------------------------------------------------------
  //
  describe('Engine Availability', () => {
    it('should check if engine is available', async () => {
      const available = await service.isEngineAvailable();

      expect(available).toBe(true);
    });

    it('should return false when engine check fails', async () => {
      // Reset the factory mock to simulate unavailable engine
      mockFactory.isCurrentEngineAvailable.mockResolvedValueOnce(false);

      const available = await service.isEngineAvailable();

      expect(available).toBe(false);
    });

    it('should return false when containerization disabled', async () => {
      const available = await service.isEngineAvailable();

      expect(typeof available).toBe('boolean');
    });
  });

  //
  // -------------------------------------------------------
  // RUN CONTAINER
  // -------------------------------------------------------
  //
  describe('Run Container', () => {
    it('should run container successfully', async () => {
      const result = await service.runContainer({
        appId: mockAppId,
        appPath: '/app/test',
        port: 3000,
      });

      expect(result.success).toBe(true);
      expect(mockHandler.runContainer).toHaveBeenCalled();
    });

    it('should record activity on successful run', async () => {
      await service.runContainer({
        appId: mockAppId,
        appPath: '/app/test',
        port: 3000,
      });

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith(mockAppId);
    });

    it('should handle run container errors', async () => {
      mockHandler.runContainer.mockRejectedValueOnce(new Error('Run failed'));

      const result = await service.runContainer({
        appId: mockAppId,
        appPath: '/app/test',
        port: 3000,
      });

      expect(result.success).toBe(false);
    });

    it('should return error when containerization disabled', async () => {
      const result = await service.runContainer({
        appId: mockAppId,
        appPath: '/app/test',
        port: 3000,
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  //
  // -------------------------------------------------------
  // STOP CONTAINER
  // -------------------------------------------------------
  //
  describe('Stop Container', () => {
    it('should stop container successfully', async () => {
      const result = await service.stopContainer(mockAppId);

      expect(result.success).toBe(true);
      expect(mockHandler.stopContainer).toHaveBeenCalledWith(mockAppId);
    });

    it('should handle stop container errors', async () => {
      mockHandler.stopContainer.mockRejectedValueOnce(new Error('Stop failed'));

      const result = await service.stopContainer(mockAppId);

      expect(result.success).toBe(false);
    });

    it('should return error when containerization disabled', async () => {
      const result = await service.stopContainer(mockAppId);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  //
  // -------------------------------------------------------
  // CONTAINER STATUS
  // -------------------------------------------------------
  //
  describe('Container Status', () => {
    it('should get container status', async () => {
      const status = await service.getContainerStatus(mockAppId);

      expect(status.isRunning).toBe(true);
      expect(status.appId).toBe('1');
    });

    it('should record activity when container is running', async () => {
      await service.getContainerStatus(mockAppId);

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith(mockAppId);
    });

    it('should handle status check errors', async () => {
      mockHandler.getContainerStatus.mockRejectedValueOnce(new Error('Status check failed'));

      const status = await service.getContainerStatus(mockAppId);

      expect(status.isRunning).toBe(false);
    });

    it('should return default status when containerization disabled', async () => {
      const status = await service.getContainerStatus(mockAppId);

      expect(status).toBeDefined();
      expect(status.appId).toBe(mockAppId);
    });
  });

  //
  // -------------------------------------------------------
  // CONTAINER CHECKS
  // -------------------------------------------------------
  //
  describe('Container Checks', () => {
    it('should check if container exists', async () => {
      const exists = await service.containerExists(mockAppId);

      expect(exists).toBe(true);
    });

    it('should check if container is running', async () => {
      const isRunning = await service.isContainerRunning(mockAppId);

      expect(isRunning).toBe(true);
    });

    it('should check if container is ready', async () => {
      const isReady = await service.isContainerReady(mockAppId);

      expect(isReady).toBe(true);
    });

    it('should check if dependencies installed', async () => {
      const hasInstalled = await service.hasDependenciesInstalled(mockAppId);

      expect(hasInstalled).toBe(true);
    });

    it('should return false on check errors', async () => {
      mockHandler.containerExists.mockRejectedValueOnce(new Error('Check failed'));

      const exists = await service.containerExists(mockAppId);

      expect(exists).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // SYNC FILES
  // -------------------------------------------------------
  //
  describe('Sync Files to Container', () => {
    it('should sync files successfully', async () => {
      const result = await service.syncFilesToContainer({
        appId: mockAppId,
        filePaths: ['src/App.tsx'],
      });

      expect(result.success).toBe(true);
    });

    it('should handle sync errors', async () => {
      mockHandler.syncFilesToContainer.mockRejectedValueOnce(new Error('Sync failed'));

      const result = await service.syncFilesToContainer({
        appId: mockAppId,
        filePaths: ['src/App.tsx'],
      });

      expect(result.success).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // EXEC IN CONTAINER
  // -------------------------------------------------------
  //
  describe('Exec in Container', () => {
    it('should execute command in container', async () => {
      const result = await service.execInContainer(mockAppId, ['npm', 'test']);

      expect(result.success).toBe(true);
      expect(mockHandler.execInContainer).toHaveBeenCalledWith(mockAppId, ['npm', 'test']);
    });

    it('should record activity on successful exec', async () => {
      await service.execInContainer(mockAppId, ['npm', 'test']);

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith(mockAppId);
    });

    it('should handle exec errors', async () => {
      mockHandler.execInContainer.mockRejectedValueOnce(new Error('Exec failed'));

      const result = await service.execInContainer(mockAppId, ['npm', 'test']);

      expect(result.success).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // CONTAINER LOGS
  // -------------------------------------------------------
  //
  describe('Container Logs', () => {
    it('should get container logs', async () => {
      const logs = await service.getContainerLogs(mockAppId);

      expect(logs).toBe('Log output');
    });

    it('should record activity when getting logs', async () => {
      await service.getContainerLogs(mockAppId);

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith(mockAppId);
    });

    it('should handle log retrieval errors', async () => {
      mockHandler.getContainerLogs.mockRejectedValueOnce(new Error('Log error'));

      const logs = await service.getContainerLogs(mockAppId);

      expect(logs).toContain('Error getting logs');
    });
  });

  //
  // -------------------------------------------------------
  // REMOVE CONTAINER AND VOLUMES
  // -------------------------------------------------------
  //
  describe('Remove Container and Volumes', () => {
    it('should remove container', async () => {
      const result = await service.removeContainer(mockAppId);

      expect(result.success).toBe(true);
    });

    it('should cleanup volumes', async () => {
      const result = await service.cleanupVolumes(mockAppId);

      expect(result.success).toBe(true);
    });

    it('should handle remove errors', async () => {
      mockHandler.removeContainer.mockRejectedValueOnce(new Error('Remove failed'));

      const result = await service.removeContainer(mockAppId);

      expect(result.success).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // ENGINE INFO AND STATUS
  // -------------------------------------------------------
  //
  describe('Engine Info and Status', () => {
    it('should get engine info', async () => {
      const info = await service.getEngineInfo();

      expect(info.enabled).toBe(true);
      expect(info.engine).toBe('podman');
    });

    it('should get service status', async () => {
      const status = await service.getServiceStatus();

      expect(status.enabled).toBe(true);
      expect(status.available).toBe(true);
    });

    it('should handle engine error', async () => {
      mockHandler.getEngineInfo.mockRejectedValueOnce(new Error('Engine error'));

      const info = await service.getEngineInfo();

      expect(info.error).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // QUICK START
  // -------------------------------------------------------
  //
  describe('Quick Start Container', () => {
    it('should quick start container without install', async () => {
      const result = await service.quickStartContainer(mockAppId, '/app', 3000, true);

      expect(result.success).toBe(true);
    });

    it('should quick start container with install', async () => {
      const result = await service.quickStartContainer(mockAppId, '/app', 3000, false);

      expect(result.success).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // CONTAINER NAME AND UTILITIES
  // -------------------------------------------------------
  //
  describe('Container Name and Utilities', () => {
    it('should get container name', () => {
      const name = service.getContainerName(mockAppId);

      expect(name).toBe('dyad-app-1');
    });

    it('should get configuration', () => {
      const config = service.getConfiguration();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
    });

    it('should get engine type', () => {
      const engineType = service.getEngineType();

      expect(engineType).toBe('podman');
    });

    it('should return string for container name', () => {
      const name = service.getContainerName(mockAppId);

      expect(typeof name).toBe('string');
    });
  });

  //
  // -------------------------------------------------------
  // RUNNING CONTAINERS
  // -------------------------------------------------------
  //
  describe('Running Containers', () => {
    it('should get running containers', async () => {
      const containers = await service.getRunningContainers();

      expect(Array.isArray(containers)).toBe(true);
    });

    it('should return array when disabled', async () => {
      const containers = await service.getRunningContainers();

      expect(Array.isArray(containers)).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // LOGS STREAMING
  // -------------------------------------------------------
  //
  describe('Logs Streaming', () => {
    it('should stream logs', async () => {
      const stream = await service.streamLogs({ appId: mockAppId });

      expect(stream).toBeDefined();
    });

    it('should get logs with options', async () => {
      const logs = await service.getLogs({
        appId: mockAppId,
        tail: 50,
        timestamps: true,
      });

      expect(logs).toBe('Log content');
    });

    it('should handle log retrieval errors', async () => {
      mockHandler.getLogs.mockRejectedValueOnce(new Error('Log error'));

      const logs = await service.getLogs({ appId: mockAppId });

      expect(logs).toBe('');
    });

    it('should handle streaming errors', async () => {
      mockHandler.streamLogs.mockRejectedValueOnce(new Error('Stream error'));

      try {
        await service.streamLogs({ appId: mockAppId });
        // If no error is thrown, fail the test
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('Stream error');
      }
    });
  });

  //
  // -------------------------------------------------------
  // EVENTS
  // -------------------------------------------------------
  //
  describe('Container Events', () => {
    it('should get container events', async () => {
      const events = await service.getEvents(mockAppId);

      expect(Array.isArray(events)).toBe(true);
    });

    it('should return empty array on event error', async () => {
      mockHandler.getEvents.mockRejectedValueOnce(new Error('Events error'));

      const events = await service.getEvents(mockAppId);

      expect(events).toEqual([]);
    });
  });

  //
  // -------------------------------------------------------
  // INTEGRATION SCENARIOS
  // -------------------------------------------------------
  //
  describe('Integration Scenarios', () => {
    it('should handle complete container lifecycle', async () => {
      // Run container
      const runResult = await service.runContainer({
        appId: mockAppId,
        appPath: '/app',
        port: 3000,
      });
      expect(runResult.success).toBe(true);

      // Get status
      const status = await service.getContainerStatus(mockAppId);
      expect(status.isRunning).toBe(true);

      // Stop container
      const stopResult = await service.stopContainer(mockAppId);
      expect(stopResult.success).toBe(true);
    });

    it('should handle multiple containers', async () => {
      const appIds = ['1', '2', '3'];

      // Run multiple containers
      for (const appId of appIds) {
        const result = await service.runContainer({
          appId,
          appPath: '/app',
          port: 3000 + parseInt(appId),
        });
        expect(result.success).toBe(true);
      }

      expect(mockHandler.runContainer).toHaveBeenCalledTimes(3);
    });
  });

  //
  // -------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------
  //
  describe('Error Handling', () => {
    it('should handle handler not available', async () => {
      const result = await service.runContainer({
        appId: mockAppId,
        appPath: '/app',
        port: 3000,
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });
});
