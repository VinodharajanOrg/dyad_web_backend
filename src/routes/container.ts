import { Router, Request, Response } from 'express';
import { AppService } from '../services/app_service';
import { ContainerizationService } from '../services/containerization_service';
import { LocalRunnerService } from '../services/local_runner_service';
import { logger } from '../utils/logger';
import { appIdField, syncAppFilesSchema } from '../db/validateSchema';
import { validate } from '../middleware/validateBody';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
const appService = new AppService();
const containerService = ContainerizationService.getInstance();
const localRunner = LocalRunnerService.getInstance();

/**
 * @swagger
 * /api/apps/{appId}/run:
 *   post:
 *     summary: Run an app in a container
 *     description: Creates and starts a container (Docker/Podman) for the specified app with automatic dependency installation
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               installCommand:
 *                 type: string
 *                 example: pnpm install
 *                 description: Override default installation command
 *               startCommand:
 *                 type: string
 *                 example: pnpm dev
 *                 description: Override default start command
 *     responses:
 *       200:
 *         description: App started successfully in container
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: App 1 started in container
 *                 data:
 *                   type: object
 *                   properties:
 *                     appId:
 *                       type: string
 *                       example: '1'
 *                     containerName:
 *                       type: string
 *                       example: dyad-app-1
 *                     port:
 *                       type: integer
 *                       example: 32100
 *       400:
 *         description: Containerization disabled or invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Containerization is disabled. Set CONTAINERIZATION_ENABLED=true in .env
 */
router.post('/:appId/run',requireAuth,validate(appIdField, 'params'), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const { appId } = req.params;
    //const { installCommand, startCommand } = req.body;

    // Get app details
    const app = await appService.getApp(appId, userId);

    // Get full app path
    const appPath = appService.getFullAppPath(app.path);

    // Check if containerization is enabled
    if (!containerService.isEnabled()) {
      // Run app locally without container
      const result = await localRunner.runApp(appId, appPath, 32100);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || result.message,
        });
      }

      const status = localRunner.getAppStatus(appId);

      return res.json({
        success: true,
        message: `App ${appId} started locally on port 32100`,
        data: {
          appId,
          port: status.port || 32100,
          mode: 'local',
        },
      });
    }

    // Run app in container
    const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
    const lifecycleService = ContainerLifecycleService.getInstance();
    
    // Check if container is already running
    const isRunning = await containerService.isContainerRunning(appId);
    if (isRunning) {
      lifecycleService.recordActivity(appId);
      const status = await containerService.getContainerStatus(appId);
      return res.json({
        success: true,
        message: `App ${appId} is already running`,
        data: {
          appId,
          containerName: status.containerName || `dyad-app-${appId}`,
          port: status.port || lifecycleService.getPort(appId) || 32100,
        },
      });
    }
    
    // Check if container is currently starting
    if (lifecycleService.isStarting(appId)) {
      return res.status(409).json({
        success: false,
        error: `Container for app ${appId} is already starting. Please wait.`,
      });
    }
    
    // Mark as starting to prevent concurrent start requests
    lifecycleService.markAsStarting(appId);
    
    try {
      const port = await lifecycleService.allocatePort(appId);
      
      logger.info('Running container for app', {
        appId,
        appPath,
        port,
        service: 'container-route'
      });
      
      const result = await containerService.runContainer({
        appId,
        appPath,
        port: port,
        skipInstall: false,
      });

      if (!result.success) {
        lifecycleService.clearStarting(appId);
        logger.error('Container failed to start', undefined, {
          appId,
          port,
          error: result.error,
          message: result.message,
          service: 'container-route'
        });
        return res.status(400).json({
          success: false,
          error: result.error || result.message
        });
      }

      // Mark as successfully started
      lifecycleService.markAsStarted(appId);
      
      const status = await containerService.getContainerStatus(appId);

      res.json({
        success: true,
        message: `App ${appId} started in container`,
        data: {
          appId,
          containerName: status.containerName || `dyad-app-${appId}`,
          port: status.port || port,
        },
      });
    } catch (error) {
      lifecycleService.clearStarting(appId);
      logger.error('Exception while starting container', error as Error, {
        appId,
        appPath,
        service: 'container-route'
      });
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/apps/{appId}/stop:
 *   post:
 *     summary: Stop a running container
 *     description: Stops the container for the specified app
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     responses:
 *       200:
 *         description: Container stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: App 1 stopped
 */
router.post('/:appId/stop',requireAuth,validate(appIdField, 'params'), async (req, res, next) => {
  try {
    const { appId } = req.params;
   // const userId = (req as any).user?.id;
    // Check if running locally
    if (localRunner.isAppRunning(appId)) {
      const result = await localRunner.stopApp(appId);
      return res.json({
        success: result.success,
        message: result.message || `App ${appId} stopped`,
      });
    }

    // Otherwise stop container
    const result = await containerService.stopContainer(appId);

    res.json({
      success: result.success,
      message: result.message || `App ${appId} stopped`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/apps/{appId}/restart:
 *   post:
 *     summary: Restart a running container
 *     description: Stops and immediately restarts the container with a quick startup (skips dependency installation)
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     responses:
 *       200:
 *         description: Container restarted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Container restarted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     appId:
 *                       type: string
 *                     port:
 *                       type: integer
 *       404:
 *         description: Container not running
 *       500:
 *         description: Restart failed
 */
router.post('/:appId/restart',requireAuth,validate(appIdField, 'params'), async (req, res, next) => {
  try {
    const { appId } = req.params;
    const userId = (req as any).user?.id;
    console.log('Restarting container for app', appId);
    // Check if app exists
    const app = await appService.getApp(appId, userId);
    
    if (!app) {
      return res.status(404).json({
        success: false,
        error: `App ${appId} not found`,
      });
    }
    // Check if containerization is enabled
    if (!containerService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Containerization is disabled. Set CONTAINERIZATION_ENABLED=true in .env',
      });
    }

    // Check if container is currently running
    const isRunning = await containerService.isContainerRunning(appId);
    if (!isRunning) {
      return res.status(404).json({
        success: false,
        error: `Container for app ${appId} is not running. Use /api/apps/${appId}/run to start it.`,
      });
    }

    logger.info('Restarting container', { service: 'container', appId });

    // Stop the container
    const stopResult = await containerService.stopContainer(appId);
    if (!stopResult.success) {
      throw new Error(stopResult.error || 'Failed to stop container');
    }

    // Wait a moment for clean shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the allocated port (should be cached from previous run)
    const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
    const lifecycleService = ContainerLifecycleService.getInstance();
    const port = await lifecycleService.allocatePort(appId);

    // Restart with quick startup (skip dependency installation)
    const startResult = await containerService.runContainer({
      appId,
      appPath: app.path,
      port,
    });

    if (!startResult.success) {
      throw new Error(startResult.error || 'Failed to restart container');
    }

    logger.info('Container restarted successfully', { 
      service: 'container', 
      appId, 
      port 
    });

    res.json({
      success: true,
      message: `Container restarted successfully`,
      data: {
        appId,
        port,
        url: `http://localhost:${port}`,
      },
    });
  } catch (error) {
    logger.error('Container restart failed', error as Error, { 
      service: 'container', 
      appId: req.params.appId 
    });
    next(error);
  }
});

/**
 * @swagger
 * /api/apps/{appId}/status:
 *   get:
 *     summary: Check if app is running in a container
 *     description: Returns the current running status of the app's container
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     responses:
 *       200:
 *         description: App container status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ContainerStatus'
 */
router.get('/:appId/status',requireAuth,validate(appIdField, 'params'), async (req, res, next) => {
  try {
    const { appId } = req.params;

    // Check if running locally
    if (localRunner.isAppRunning(appId)) {
      const localStatus = localRunner.getAppStatus(appId);
      return res.json({
        success: true,
        data: {
          appId,
          isRunning: localStatus.isRunning,
          isReady: localStatus.isRunning,
          hasDependenciesInstalled: true,
          port: localStatus.port,
          uptime: localStatus.uptime,
          status: 'running',
          health: 'healthy',
          containerizationEnabled: containerService.isEnabled(),
          mode: 'local',
        },
      });
    }

    const status = await containerService.getContainerStatus(appId);

    res.json({
      success: true,
      data: {
        ...status,
        containerizationEnabled: containerService.isEnabled(),
        mode: 'container',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/apps/{appId}/quick-start:
 *   post:
 *     summary: Quick start app container (optimized)
 *     description: Starts the container immediately with template, faster than full run
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               skipInstall:
 *                 type: boolean
 *                 example: false
 *                 description: Skip npm install for faster startup (use if deps already installed)
 *     responses:
 *       200:
 *         description: Container quick started
 */
router.post('/:appId/quick-start',requireAuth,validate(appIdField, 'params'), async (req, res, next) => {
  try {
    const { appId } = req.params;
    const userId = (req as any).user?.id;
    const { skipInstall } = req.body;

    if (!containerService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'Containerization is disabled',
      });
    }

    const app = await appService.getApp(appId, userId);
    const appPath = appService.getFullAppPath(app.path);

    const result = await containerService.quickStartContainer(
      appId,
      appPath,
      32100,
      skipInstall || false
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || result.message,
      });
    }

    const status = await containerService.getContainerStatus(appId);

    res.json({
      success: true,
      message: `App ${appId} quick started in container`,
      data: {
        appId,
        containerName: status.containerName || `dyad-app-${appId}`,
        port: status.port || 32100,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/apps/{appId}/sync:
 *   post:
 *     summary: Sync updated files to running container
 *     description: Incrementally sync AI-generated file changes to the running container without restart
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filePaths:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['src/App.tsx', 'src/pages/Index.tsx']
 *                 description: Optional list of specific files to sync
 *     responses:
 *       200:
 *         description: Files synced successfully
 */
router.post('/:appId/sync',requireAuth,validate(appIdField, 'params'),validate(syncAppFilesSchema, 'body'), async (req, res, next) => {
  try {
    const { appId } = req.params;
    const { filePaths } = req.body;

    const result = await containerService.syncFilesToContainer({
      appId,
      filePaths,
    });

    res.json({
      success: result.success,
      message: result.message || `Files synced to container for app ${appId}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/apps/{appId}/cleanup:
 *   post:
 *     summary: Remove container volumes for an app
 *     description: Deletes container volumes (pnpm cache, node_modules) to free up disk space
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     responses:
 *       200:
 *         description: Volumes removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Container volumes removed for app 1
 */
router.post('/:appId/cleanup',requireAuth,validate(appIdField, 'params'), async (req, res, next) => {
  try {
    const { appId } = req.params;

    const result = await containerService.removeVolumes(appId);

    res.json({
      success: result.success,
      message: result.message || `Container volumes removed for app ${appId}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/container/lifecycle/stats:
 *   get:
 *     summary: Get container lifecycle statistics
 *     description: Returns statistics about managed containers, ports, and lifecycle service status
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lifecycle statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     managedContainers:
 *                       type: number
 *                       example: 5
 *                     allocatedPorts:
 *                       type: number
 *                       example: 5
 *                     startingContainers:
 *                       type: number
 *                       example: 0
 *                     portRange:
 *                       type: string
 *                       example: "32100-32200"
 *                     inactivityTimeout:
 *                       type: number
 *                       example: 600000
 *                     initialized:
 *                       type: boolean
 *                       example: true
 */
router.get('/lifecycle/stats', requireAuth, async (req, res, next) => {
  try {
    const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
    const lifecycleService = ContainerLifecycleService.getInstance();
    const stats = lifecycleService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/container/status:
 *   get:
 *     summary: Get containerization service status
 *     description: Returns containerization service configuration, availability, and running containers
 *     tags: [Container]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Containerization service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                       example: true
 *                     available:
 *                       type: boolean
 *                       example: true
 *                     engine:
 *                       type: string
 *                       enum: [docker, podman, tanzu, kubernetes]
 *                       example: docker
 *                     config:
 *                       $ref: '#/components/schemas/ContainerizationConfig'
 *                     runningContainers:
 *                       type: integer
 *                       example: 2
 *                     runningAppIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ['1', '3']
 */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const enabled = containerService.isEnabled();
    const isAvailable = await containerService.isEngineAvailable();
    const config = containerService.getConfiguration();
    const engineType = containerService.getEngineType();
    const runningContainers = await containerService.getRunningContainers();

    res.json({
      success: true,
      data: {
        enabled,
        available: isAvailable,
        engine: engineType,
        config,
        runningContainers: runningContainers.length,
        runningAppIds: runningContainers,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
