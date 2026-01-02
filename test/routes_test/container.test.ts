import request from 'supertest';
import express, { Express } from 'express';
import { AppService } from '../../src/services/app_service';
import { ContainerizationService } from '../../src/services/containerization_service';
import { LocalRunnerService } from '../../src/services/local_runner_service';
import { ContainerLifecycleService } from '../../src/services/container_lifecycle_service';

// Mock errorHandler middleware
jest.mock('../../src/middleware/errorHandler', () => {
  const errorHandler = (err: any, req: any, res: any, next: any) => {
    if (err.statusCode && err.message) {
      return res.status(err.statusCode).json({
        error: err.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
    });
  };

  const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  class AppError extends Error {
    constructor(public statusCode: number, public message: string) {
      super(message);
    }
  }

  return {
    errorHandler,
    asyncHandler,
    AppError
  };
});

// Mock auth middleware
jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

// Mock all dependencies
jest.mock('../../src/services/app_service');
jest.mock('../../src/services/containerization_service');
jest.mock('../../src/services/local_runner_service');
jest.mock('../../src/services/container_lifecycle_service');

describe('Container Routes', () => {
  let app: Express;
  let mockAppService: any;
  let mockContainerService: any;
  let mockLocalRunner: any;
  let mockLifecycleService: any;

  beforeAll(async () => {
    // Setup mock services
    mockAppService = {
      getApp: jest.fn(),
      getFullAppPath: jest.fn(),
    };

    mockContainerService = {
      isEnabled: jest.fn().mockReturnValue(true),
      isEngineAvailable: jest.fn().mockResolvedValue(true),
      isContainerRunning: jest.fn().mockResolvedValue(false),
      getContainerStatus: jest.fn().mockResolvedValue({
        appId: '1',
        isRunning: true,
        containerName: 'dyad-app-1',
        port: 32100,
      }),
      runContainer: jest.fn().mockResolvedValue({ success: true }),
      stopContainer: jest.fn().mockResolvedValue({ success: true }),
      quickStartContainer: jest.fn().mockResolvedValue({ success: true }),
      syncFilesToContainer: jest.fn().mockResolvedValue({ success: true }),
      removeVolumes: jest.fn().mockResolvedValue({ success: true }),
      getRunningContainers: jest.fn().mockResolvedValue([]),
      getConfiguration: jest.fn().mockReturnValue({ enabled: true }),
      getEngineType: jest.fn().mockReturnValue('docker'),
    };

    mockLocalRunner = {
      isAppRunning: jest.fn().mockReturnValue(false),
      runApp: jest.fn().mockResolvedValue({ success: true }),
      stopApp: jest.fn().mockResolvedValue({ success: true, message: 'App stopped' }),
      getAppStatus: jest.fn().mockReturnValue({
        appId: '1',
        isRunning: false,
        port: 32100,
        uptime: 0,
      }),
    };

    mockLifecycleService = {
      recordActivity: jest.fn(),
      isStarting: jest.fn().mockReturnValue(false),
      markAsStarting: jest.fn(),
      clearStarting: jest.fn(),
      markAsStarted: jest.fn(),
      allocatePort: jest.fn().mockResolvedValue(32100),
      getPort: jest.fn().mockReturnValue(32100),
      getStats: jest.fn().mockReturnValue({
        managedContainers: 1,
        allocatedPorts: 1,
        startingContainers: 0,
        portRange: '32100-32200',
        inactivityTimeout: 600000,
        initialized: true,
      }),
    };

    // Setup mocks in service modules
    (AppService as any).mockImplementation(() => mockAppService);
    (ContainerizationService as any).getInstance = jest.fn().mockReturnValue(mockContainerService);
    (LocalRunnerService as any).getInstance = jest.fn().mockReturnValue(mockLocalRunner);
    (ContainerLifecycleService as any).getInstance = jest.fn().mockReturnValue(mockLifecycleService);

    // Setup express app with routes
    app = express();
    app.use(express.json());

    // Import and mount router - container router is mounted at both paths
    const containerRouter = (await import('../../src/routes/container')).default;
    app.use('/api/apps', containerRouter);
    app.use('/api/container', containerRouter);
    
    // Add error handler middleware
    const { errorHandler } = await import('../../src/middleware/errorHandler');
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Re-setup mocks after clearing
    (AppService as any).mockImplementation(() => mockAppService);
    (ContainerizationService as any).getInstance = jest.fn().mockReturnValue(mockContainerService);
    (LocalRunnerService as any).getInstance = jest.fn().mockReturnValue(mockLocalRunner);
    (ContainerLifecycleService as any).getInstance = jest.fn().mockReturnValue(mockLifecycleService);
  });

  //
  // -------------------------------------------------------
  // POST /api/apps/:appId/run - Run Container
  // -------------------------------------------------------
  //
  describe('POST /api/apps/:appId/run', () => {
    it('should run app in container successfully', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        containerName: 'dyad-app-1',
        port: 32100,
      });

      const response = await request(app)
        .post('/api/apps/1/run')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('started in container');
      expect(response.body.data.appId).toBe('1');
      expect(mockContainerService.runContainer).toHaveBeenCalled();
    });

    it('should run app locally if containerization disabled', async () => {
      mockContainerService.isEnabled.mockReturnValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockLocalRunner.runApp.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/apps/1/run')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.mode).toBe('local');
      expect(mockLocalRunner.runApp).toHaveBeenCalled();
    });

    it('should return 400 if local run fails', async () => {
      mockContainerService.isEnabled.mockReturnValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockLocalRunner.runApp.mockResolvedValueOnce({ success: false, error: 'Run failed' });

      const response = await request(app)
        .post('/api/apps/1/run')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Run failed');
    });

    it('should return 409 if container already starting', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockLifecycleService.isStarting.mockReturnValueOnce(true);

      const response = await request(app)
        .post('/api/apps/1/run')
        .send({})
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already starting');
    });

    it('should return 200 if container already running', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        containerName: 'dyad-app-1',
        port: 32100,
      });

      const response = await request(app)
        .post('/api/apps/1/run')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('already running');
    });

    it('should return 400 if container run fails', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.runContainer.mockResolvedValueOnce({
        success: false,
        error: 'Container start failed',
      });

      const response = await request(app)
        .post('/api/apps/1/run')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Container start failed');
    });

    it('should support custom install and start commands', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        containerName: 'dyad-app-1',
        port: 32100,
      });

      await request(app)
        .post('/api/apps/1/run')
        .send({
          installCommand: 'npm install',
          startCommand: 'npm start',
        })
        .expect(200);

      expect(mockContainerService.runContainer).toHaveBeenCalled();
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/apps/:appId/stop - Stop Container
  // -------------------------------------------------------
  //
  describe('POST /api/apps/:appId/stop', () => {
    it('should stop container successfully', async () => {
      mockContainerService.stopContainer.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/apps/1/stop')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('stopped');
      expect(mockContainerService.stopContainer).toHaveBeenCalledWith('1');
    });

    it('should stop local app if running locally', async () => {
      mockLocalRunner.isAppRunning.mockReturnValueOnce(true);
      mockLocalRunner.stopApp.mockResolvedValueOnce({ success: true, message: 'App stopped' });

      const response = await request(app)
        .post('/api/apps/1/stop')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockLocalRunner.stopApp).toHaveBeenCalledWith('1');
    });

    it('should handle stop container errors', async () => {
      mockContainerService.stopContainer.mockResolvedValueOnce({ success: false, error: 'Stop failed' });

      const response = await request(app)
        .post('/api/apps/1/stop')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/apps/:appId/restart - Restart Container
  // -------------------------------------------------------
  //
  describe('POST /api/apps/:appId/restart', () => {
    it('should restart container successfully', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.stopContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/apps/1/restart')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('restarted');
      expect(mockContainerService.stopContainer).toHaveBeenCalledWith('1');
      expect(mockContainerService.runContainer).toHaveBeenCalled();
    });

    it('should return 404 if app not found', async () => {
      mockAppService.getApp.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/apps/999/restart')
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 400 if containerization disabled', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockContainerService.isEnabled.mockReturnValueOnce(false);

      const response = await request(app)
        .post('/api/apps/1/restart')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('disabled');
    });

    it('should return 404 if container not running', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/apps/1/restart')
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not running');
    });

    it('should handle stop failure during restart', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.stopContainer.mockResolvedValueOnce({ success: false, error: 'Stop failed' });

      const response = await request(app)
        .post('/api/apps/1/restart')
        .send({});

      // Should get an error response
      expect(response.status >= 400).toBe(true);
    });

    it('should handle start failure during restart', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.stopContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.runContainer.mockResolvedValueOnce({ success: false, error: 'Start failed' });

      const response = await request(app)
        .post('/api/apps/1/restart')
        .send({});

      // Should get an error response
      expect(response.status >= 400).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/apps/:appId/status - Get Container Status
  // -------------------------------------------------------
  //
  describe('GET /api/apps/:appId/status', () => {
    it('should get container status successfully', async () => {
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'dyad-app-1',
        port: 32100,
        status: 'running',
      });

      const response = await request(app)
        .get('/api/apps/1/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isRunning).toBe(true);
      expect(response.body.data.containerName).toBe('dyad-app-1');
      expect(response.body.data.mode).toBe('container');
    });

    it('should get local app status if running locally', async () => {
      mockLocalRunner.isAppRunning.mockReturnValueOnce(true);
      mockLocalRunner.getAppStatus.mockReturnValueOnce({
        appId: '1',
        isRunning: true,
        port: 32100,
        uptime: 5000,
      });

      const response = await request(app)
        .get('/api/apps/1/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isRunning).toBe(true);
      expect(response.body.data.mode).toBe('local');
    });

    it('should include containerization enabled flag', async () => {
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: false,
      });

      const response = await request(app)
        .get('/api/apps/1/status')
        .expect(200);

      expect(response.body.data.containerizationEnabled).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/apps/:appId/quick-start - Quick Start
  // -------------------------------------------------------
  //
  describe('POST /api/apps/:appId/quick-start', () => {
    it('should quick start container successfully', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.quickStartContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        containerName: 'dyad-app-1',
        port: 32100,
      });

      const response = await request(app)
        .post('/api/apps/1/quick-start')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('quick started');
      expect(mockContainerService.quickStartContainer).toHaveBeenCalled();
    });

    it('should quick start with skipInstall option', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.quickStartContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        containerName: 'dyad-app-1',
        port: 32100,
      });

      await request(app)
        .post('/api/apps/1/quick-start')
        .send({ skipInstall: true })
        .expect(200);

      expect(mockContainerService.quickStartContainer).toHaveBeenCalledWith('1', '/full/path/apps/app1', 32100, true);
    });

    it('should return 400 if containerization disabled', async () => {
      mockContainerService.isEnabled.mockReturnValueOnce(false);

      const response = await request(app)
        .post('/api/apps/1/quick-start')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('disabled');
    });

    it('should handle quick start errors', async () => {
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.quickStartContainer.mockResolvedValueOnce({
        success: false,
        error: 'Quick start failed',
      });

      const response = await request(app)
        .post('/api/apps/1/quick-start')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/apps/:appId/sync - Sync Files
  // -------------------------------------------------------
  //
  describe('POST /api/apps/:appId/sync', () => {
    it('should sync files successfully', async () => {
      mockContainerService.syncFilesToContainer.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/apps/1/sync')
        .send({ filePaths: ['src/App.tsx'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('synced');
      expect(mockContainerService.syncFilesToContainer).toHaveBeenCalledWith({
        appId: '1',
        filePaths: ['src/App.tsx'],
      });
    });

    it('should sync all files if no filePaths provided', async () => {
      mockContainerService.syncFilesToContainer.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/apps/1/sync')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockContainerService.syncFilesToContainer).toHaveBeenCalledWith({
        appId: '1',
        filePaths: undefined,
      });
    });

    it('should handle sync errors', async () => {
      mockContainerService.syncFilesToContainer.mockResolvedValueOnce({
        success: false,
        message: 'Sync failed',
      });

      const response = await request(app)
        .post('/api/apps/1/sync')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/apps/:appId/cleanup - Cleanup Volumes
  // -------------------------------------------------------
  //
  describe('POST /api/apps/:appId/cleanup', () => {
    it('should cleanup volumes successfully', async () => {
      mockContainerService.removeVolumes.mockResolvedValueOnce({ success: true });

      const response = await request(app)
        .post('/api/apps/1/cleanup')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('volumes removed');
      expect(mockContainerService.removeVolumes).toHaveBeenCalledWith('1');
    });

    it('should handle cleanup errors', async () => {
      mockContainerService.removeVolumes.mockResolvedValueOnce({
        success: false,
        message: 'Cleanup failed',
      });

      const response = await request(app)
        .post('/api/apps/1/cleanup')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/container/lifecycle/stats - Lifecycle Stats
  // -------------------------------------------------------
  //
  describe('GET /api/container/lifecycle/stats', () => {
    it('should get lifecycle statistics successfully', async () => {
      mockLifecycleService.getStats.mockReturnValueOnce({
        managedContainers: 5,
        allocatedPorts: 5,
        startingContainers: 0,
        portRange: '32100-32200',
        inactivityTimeout: 600000,
        initialized: true,
      });

      const response = await request(app)
        .get('/api/container/lifecycle/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.managedContainers).toBe(5);
      expect(response.body.data.allocatedPorts).toBe(5);
      expect(response.body.data.portRange).toBe('32100-32200');
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/container/status - Containerization Status
  // -------------------------------------------------------
  //
  describe('GET /api/container/status', () => {
    it('should get containerization service status', async () => {
      mockContainerService.getRunningContainers.mockResolvedValueOnce(['1', '2']);

      const response = await request(app)
        .get('/api/container/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
      expect(response.body.data.available).toBe(true);
      expect(response.body.data.engine).toBe('docker');
      expect(response.body.data.runningContainers).toBe(2);
      expect(response.body.data.runningAppIds).toEqual(['1', '2']);
    });

    it('should show disabled status when containerization disabled', async () => {
      mockContainerService.isEnabled.mockReturnValueOnce(false);
      mockContainerService.getRunningContainers.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/container/status')
        .expect(200);

      expect(response.body.data.enabled).toBe(false);
      expect(response.body.data.runningContainers).toBe(0);
    });

    it('should show unavailable status when engine not available', async () => {
      mockContainerService.isEngineAvailable.mockResolvedValueOnce(false);
      mockContainerService.getRunningContainers.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/container/status')
        .expect(200);

      expect(response.body.data.available).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------
  //
  describe('Error Handling', () => {
    it('should handle unexpected errors on run', async () => {
      mockAppService.getApp.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/apps/1/run')
        .send({});

      // Should get an error response
      expect(response.status >= 400).toBe(true);
    });

    it('should handle unexpected errors on stop', async () => {
      mockContainerService.stopContainer.mockRejectedValueOnce(new Error('Stop error'));

      const response = await request(app)
        .post('/api/apps/1/stop')
        .send({});

      // Should get an error response
      expect(response.status >= 400).toBe(true);
    });

    it('should handle unexpected errors on status check', async () => {
      mockContainerService.getContainerStatus.mockRejectedValueOnce(new Error('Status error'));

      const response = await request(app)
        .get('/api/apps/1/status');

      // Should get an error response
      expect(response.status >= 400).toBe(true);
    });

    it('should handle unexpected errors on containerization status', async () => {
      mockContainerService.isEngineAvailable.mockRejectedValueOnce(new Error('Engine error'));

      const response = await request(app)
        .get('/api/container/status');

      // Should get an error response
      expect(response.status >= 400).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // Integration Scenarios
  // -------------------------------------------------------
  //
  describe('Integration Scenarios', () => {
    it('should handle complete app lifecycle', async () => {
      // Run app
      mockAppService.getApp.mockResolvedValueOnce({ id: '1', path: '/apps/app1' });
      mockAppService.getFullAppPath.mockReturnValueOnce('/full/path/apps/app1');
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        containerName: 'dyad-app-1',
        port: 32100,
        isRunning: true,
      });

      let response = await request(app)
        .post('/api/apps/1/run')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check status
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        containerName: 'dyad-app-1',
        port: 32100,
      });

      response = await request(app)
        .get('/api/apps/1/status')
        .expect(200);

      expect(response.body.data.isRunning).toBe(true);

      // Sync files
      mockContainerService.syncFilesToContainer.mockResolvedValueOnce({ success: true });

      response = await request(app)
        .post('/api/apps/1/sync')
        .send({ filePaths: ['src/App.tsx'] })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Stop app
      mockContainerService.stopContainer.mockResolvedValueOnce({ success: true });

      response = await request(app)
        .post('/api/apps/1/stop')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle multiple containers running', async () => {
      // Check status with multiple running containers
      mockContainerService.getRunningContainers.mockResolvedValueOnce(['1', '2', '3']);

      const response = await request(app)
        .get('/api/container/status')
        .expect(200);

      expect(response.body.data.runningContainers).toBe(3);
      expect(response.body.data.runningAppIds).toEqual(['1', '2', '3']);
    });
  });
});
