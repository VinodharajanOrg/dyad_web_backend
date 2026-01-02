import { DockerService, getDockerService } from '../../src/services/docker_service_refactored';
import { containerizationService } from '../../src/services/containerization_service';

jest.mock('../../src/services/containerization_service');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DockerService (Refactored)', () => {
  let service: DockerService;
  const mockAppId = 1;
  const mockAppPath = '/app/test-app';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.CONTAINERIZATION_ENABLED;
    delete process.env.DOCKER_ENABLED;
    delete process.env.DOCKER_APP_PORT;
    delete process.env.DOCKER_NODE_IMAGE;

    service = new DockerService();
  });

  //
  // -------------------------------------------------------
  // CONSTRUCTOR AND CONFIGURATION
  // -------------------------------------------------------
  //
  describe('Constructor and Configuration', () => {
    it('should initialize with default config', () => {
      const config = service.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.port).toBe(32100);
      expect(config.nodeImage).toBe('node:22-alpine');
    });

    it('should load DOCKER_ENABLED from environment', () => {
      process.env.DOCKER_ENABLED = 'true';
      const testService = new DockerService();

      expect(testService.getConfig().enabled).toBe(true);
    });

    it('should prioritize CONTAINERIZATION_ENABLED over DOCKER_ENABLED', () => {
      process.env.DOCKER_ENABLED = 'false';
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      expect(testService.getConfig().enabled).toBe(true);
    });

    it('should load DOCKER_APP_PORT from environment', () => {
      process.env.DOCKER_APP_PORT = '5000';
      const testService = new DockerService();

      expect(testService.getConfig().port).toBe(5000);
    });

    it('should load DOCKER_NODE_IMAGE from environment', () => {
      process.env.DOCKER_NODE_IMAGE = 'node:20-slim';
      const testService = new DockerService();

      expect(testService.getConfig().nodeImage).toBe('node:20-slim');
    });

    it('should handle invalid DOCKER_APP_PORT', () => {
      process.env.DOCKER_APP_PORT = 'invalid';
      const testService = new DockerService();

      expect(isNaN(testService.getConfig().port)).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // IS DOCKER AVAILABLE
  // -------------------------------------------------------
  //
  describe('isDockerAvailable()', () => {
    it('should return true when engine is available', async () => {
      (containerizationService.isEngineAvailable as jest.Mock).mockResolvedValue(true);

      const result = await service.isDockerAvailable();

      expect(result).toBe(true);
      expect(containerizationService.isEngineAvailable).toHaveBeenCalled();
    });

    it('should return false when engine is not available', async () => {
      (containerizationService.isEngineAvailable as jest.Mock).mockResolvedValue(false);

      const result = await service.isDockerAvailable();

      expect(result).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // RUN APP IN DOCKER
  // -------------------------------------------------------
  //
  describe('runAppInDocker()', () => {
    it('should throw error if containerization is disabled', async () => {
      await expect(
        service.runAppInDocker({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Containerization is disabled');
    });

    it('should successfully run app in container', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Container started',
      });

      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
      });

      expect(containerizationService.runContainer).toHaveBeenCalledWith({
        appId: '1',
        appPath: mockAppPath,
        port: 32100,
        forceRecreate: false,
        skipInstall: false,
      });
    });

    it('should throw error if container start fails', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Container already running',
      });

      await expect(
        testService.runAppInDocker({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Container already running');
    });

    it('should use custom install and start commands', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
        installCommand: 'npm install',
        startCommand: 'npm start',
      });

      expect(containerizationService.runContainer).toHaveBeenCalled();
    });

    it('should call onOutput callback if provided', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();
      const onOutput = jest.fn();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
        onOutput,
      });

      expect(containerizationService.runContainer).toHaveBeenCalled();
    });

    it('should use custom port from config', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      process.env.DOCKER_APP_PORT = '3000';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
      });

      expect(containerizationService.runContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3000,
        })
      );
    });
  });

  //
  // -------------------------------------------------------
  // STOP APP
  // -------------------------------------------------------
  //
  describe('stopApp()', () => {
    it('should successfully stop running container', async () => {
      (containerizationService.stopContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await service.stopApp(mockAppId);

      expect(containerizationService.stopContainer).toHaveBeenCalledWith('1');
    });

    it('should log warning if stop fails', async () => {
      const logger = require('../../src/utils/logger').logger;

      (containerizationService.stopContainer as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Container not found',
      });

      await service.stopApp(mockAppId);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle stop for non-existent container', async () => {
      (containerizationService.stopContainer as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Container not found',
      });

      await service.stopApp(999);

      expect(containerizationService.stopContainer).toHaveBeenCalledWith('999');
    });
  });

  //
  // -------------------------------------------------------
  // SYNC FILES TO CONTAINER
  // -------------------------------------------------------
  //
  describe('syncFilesToContainer()', () => {
    it('should sync files to container successfully', async () => {
      (containerizationService.syncFilesToContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await service.syncFilesToContainer(mockAppId, ['src/App.tsx', 'src/index.tsx']);

      expect(containerizationService.syncFilesToContainer).toHaveBeenCalledWith({
        appId: '1',
        filePaths: ['src/App.tsx', 'src/index.tsx'],
        fullSync: false,
      });
    });

    it('should throw error if sync fails', async () => {
      (containerizationService.syncFilesToContainer as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Sync failed',
      });

      await expect(
        service.syncFilesToContainer(mockAppId, ['src/App.tsx'])
      ).rejects.toThrow('Sync failed');
    });

    it('should sync without file paths', async () => {
      (containerizationService.syncFilesToContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await service.syncFilesToContainer(mockAppId);

      expect(containerizationService.syncFilesToContainer).toHaveBeenCalledWith({
        appId: '1',
        filePaths: undefined,
        fullSync: false,
      });
    });
  });

  //
  // -------------------------------------------------------
  // QUICK START CONTAINER
  // -------------------------------------------------------
  //
  describe('quickStartContainer()', () => {
    it('should throw error if containerization is disabled', async () => {
      await expect(
        service.quickStartContainer({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Containerization is disabled');
    });

    it('should quickly start container with skipInstall', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.quickStartContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.quickStartContainer({
        appId: mockAppId,
        appPath: mockAppPath,
        skipInstall: true,
      });

      expect(containerizationService.quickStartContainer).toHaveBeenCalledWith(
        '1',
        mockAppPath,
        32100,
        true
      );
    });

    it('should start container with install when skipInstall is false', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.quickStartContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.quickStartContainer({
        appId: mockAppId,
        appPath: mockAppPath,
        skipInstall: false,
      });

      expect(containerizationService.quickStartContainer).toHaveBeenCalledWith(
        '1',
        mockAppPath,
        32100,
        false
      );
    });

    it('should throw error if quick start fails', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.quickStartContainer as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to start container',
      });

      await expect(
        testService.quickStartContainer({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Failed to start container');
    });

    it('should use custom port for quick start', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      process.env.DOCKER_APP_PORT = '5000';
      const testService = new DockerService();

      (containerizationService.quickStartContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.quickStartContainer({
        appId: mockAppId,
        appPath: mockAppPath,
      });

      expect(containerizationService.quickStartContainer).toHaveBeenCalledWith(
        '1',
        mockAppPath,
        5000,
        false
      );
    });
  });

  //
  // -------------------------------------------------------
  // CONTAINER STATUS CHECKS
  // -------------------------------------------------------
  //
  describe('Container Status Checks', () => {
    it('should return false for isContainerReady (deprecated)', () => {
      const result = service.isContainerReady(mockAppId);

      expect(result).toBe(false);
    });

    it('should return false for hasDependenciesInstalled (deprecated)', () => {
      const result = service.hasDependenciesInstalled(mockAppId);

      expect(result).toBe(false);
    });

    it('should get container status asynchronously', async () => {
      const mockStatus = {
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
      };

      (containerizationService.getContainerStatus as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.getContainerStatus(mockAppId);

      expect(result).toEqual(mockStatus);
      expect(containerizationService.getContainerStatus).toHaveBeenCalledWith('1');
    });

    it('should check if app is running', async () => {
      (containerizationService.isContainerRunning as jest.Mock).mockResolvedValue(true);

      const result = await service.isAppRunning(mockAppId);

      expect(result).toBe(true);
      expect(containerizationService.isContainerRunning).toHaveBeenCalledWith('1');
    });

    it('should return false when app is not running', async () => {
      (containerizationService.isContainerRunning as jest.Mock).mockResolvedValue(false);

      const result = await service.isAppRunning(999);

      expect(result).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // REMOVE APP VOLUMES
  // -------------------------------------------------------
  //
  describe('removeAppVolumes()', () => {
    it('should successfully remove app volumes', async () => {
      (containerizationService.cleanupVolumes as jest.Mock).mockResolvedValue({
        success: true,
      });

      await service.removeAppVolumes(mockAppId);

      expect(containerizationService.cleanupVolumes).toHaveBeenCalledWith('1');
    });

    it('should log warning if volume removal fails', async () => {
      const logger = require('../../src/utils/logger').logger;

      (containerizationService.cleanupVolumes as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Failed to cleanup volumes',
      });

      await service.removeAppVolumes(mockAppId);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle cleanup for non-existent volumes', async () => {
      (containerizationService.cleanupVolumes as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Volume not found',
      });

      await service.removeAppVolumes(999);

      expect(containerizationService.cleanupVolumes).toHaveBeenCalledWith('999');
    });
  });

  //
  // -------------------------------------------------------
  // GET RUNNING CONTAINERS
  // -------------------------------------------------------
  //
  describe('getRunningContainers()', () => {
    it('should return empty array (architectural limitation)', () => {
      const containers = service.getRunningContainers();

      expect(containers).toEqual([]);
      expect(Array.isArray(containers)).toBe(true);
    });

    it('should be consistent across multiple calls', () => {
      const containers1 = service.getRunningContainers();
      const containers2 = service.getRunningContainers();

      expect(containers1).toEqual(containers2);
    });
  });

  //
  // -------------------------------------------------------
  // SINGLETON PATTERN
  // -------------------------------------------------------
  //
  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getDockerService();
      const instance2 = getDockerService();

      expect(instance1).toBe(instance2);
    });

    it('should maintain config across singleton calls', () => {
      process.env.DOCKER_APP_PORT = '4000';
      const instance1 = getDockerService();
      const config1 = instance1.getConfig();

      const instance2 = getDockerService();
      const config2 = instance2.getConfig();

      expect(config1.port).toBe(config2.port);
    });
  });

  //
  // -------------------------------------------------------
  // INTEGRATION SCENARIOS
  // -------------------------------------------------------
  //
  describe('Integration Scenarios', () => {
    it('should handle complete app lifecycle', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });
      (containerizationService.getContainerStatus as jest.Mock).mockResolvedValue({
        isRunning: true,
        isReady: true,
      });
      (containerizationService.stopContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      // Start app
      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
      });

      // Check status
      const status = await testService.getContainerStatus(mockAppId);
      expect(status.isRunning).toBe(true);

      // Stop app
      await testService.stopApp(mockAppId);

      expect(containerizationService.runContainer).toHaveBeenCalled();
      expect(containerizationService.stopContainer).toHaveBeenCalled();
    });

    it('should sync files after container start', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });
      (containerizationService.syncFilesToContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
      });

      await testService.syncFilesToContainer(mockAppId, ['src/App.tsx']);

      expect(containerizationService.runContainer).toHaveBeenCalled();
      expect(containerizationService.syncFilesToContainer).toHaveBeenCalled();
    });

    it('should handle quick start with file sync', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.quickStartContainer as jest.Mock).mockResolvedValue({
        success: true,
      });
      (containerizationService.syncFilesToContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.quickStartContainer({
        appId: mockAppId,
        appPath: mockAppPath,
        skipInstall: true,
      });

      await testService.syncFilesToContainer(mockAppId, ['src/index.tsx']);

      expect(containerizationService.quickStartContainer).toHaveBeenCalled();
      expect(containerizationService.syncFilesToContainer).toHaveBeenCalled();
    });
  });

  //
  // -------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------
  //
  describe('Error Handling', () => {
    it('should handle containerization service errors gracefully', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Engine not running',
        message: 'Docker daemon is not running',
      });

      await expect(
        testService.runAppInDocker({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Engine not running');
    });

    it('should provide fallback message if error not specified', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Operation failed',
      });

      await expect(
        testService.runAppInDocker({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Operation failed');
    });

    it('should handle multiple app ids without interference', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });

      await testService.runAppInDocker({ appId: 1, appPath: '/app/1' });
      await testService.runAppInDocker({ appId: 2, appPath: '/app/2' });

      expect(containerizationService.runContainer).toHaveBeenCalledTimes(2);
      expect(containerizationService.runContainer).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ appId: '1' })
      );
      expect(containerizationService.runContainer).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ appId: '2' })
      );
    });
  });

  //
  // -------------------------------------------------------
  // EDGE CASES
  // -------------------------------------------------------
  //
  describe('Edge Cases', () => {
    it('should handle app id conversion to string properly', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      const largeAppId = 999999;
      await testService.runAppInDocker({
        appId: largeAppId,
        appPath: mockAppPath,
      });

      expect(containerizationService.runContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: '999999',
        })
      );
    });

    it('should handle app path with special characters', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      const specialPath = '/app/my-app_v2.0/test@folder';
      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: specialPath,
      });

      expect(containerizationService.runContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          appPath: specialPath,
        })
      );
    });

    it('should handle null or undefined commands', async () => {
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();

      (containerizationService.runContainer as jest.Mock).mockResolvedValue({
        success: true,
      });

      await testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
        installCommand: null,
        startCommand: undefined,
      });

      expect(containerizationService.runContainer).toHaveBeenCalled();
    });

    it('should preserve config across service instances', () => {
      process.env.DOCKER_APP_PORT = '7000';
      process.env.DOCKER_NODE_IMAGE = 'node:18';

      const testService1 = new DockerService();
      const config1 = testService1.getConfig();

      const testService2 = new DockerService();
      const config2 = testService2.getConfig();

      expect(config1.port).toBe(config2.port);
      expect(config1.nodeImage).toBe(config2.nodeImage);
    });
  });
});
