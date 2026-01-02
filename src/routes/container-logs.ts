import { Router, Request, Response } from 'express';
import { ContainerizationService } from '../services/containerization_service';
import { LocalRunnerService } from '../services/local_runner_service';
import { AppService } from '../services/app_service';
import { logger } from '../utils/logger';

/**
 * Container Log Streaming API - Server-Sent Events (SSE)
 * Stream real-time container logs and events
 * Also supports local (non-containerized) apps
 */

const router = Router();
const containerService = ContainerizationService.getInstance();
const localRunner = LocalRunnerService.getInstance();
const appService = new AppService();

// Active log streams
const activeLogStreams = new Map<string, boolean>();

/**
 * @swagger
 * /api/container-logs/{appId}/stream:
 *   get:
 *     tags: [Container Logs]
 *     summary: Stream container logs using SSE
 *     description: Real-time streaming of container logs including startup, dependencies installation, file changes, and runtime logs
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *       - in: query
 *         name: follow
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Continue streaming new logs as they appear
 *       - in: query
 *         name: tail
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of recent log lines to include
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stream of container log events
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   type: string
 *                   enum: [log, event, error, status, complete]
 *                 data:
 *                   type: object
 */
router.get('/:appId/stream', async (req: Request, res: Response) => {
  const { appId } = req.params;
  const userId = (req as any).user?.id;
  const follow = req.query.follow !== 'false';
  const tail = Number.parseInt(req.query.tail as string) || 100;
  const streamId = `${appId}-${Date.now()}`;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Helper to send SSE events
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Cleanup handler for client disconnection
  const cleanup = () => {
    if (activeLogStreams.has(streamId)) {
      logger.info('Client disconnected, cleaning up log stream', { appId, streamId });
      activeLogStreams.delete(streamId);
    }
  };

  // Listen for client disconnect
  req.on('close', cleanup);
  res.on('close', cleanup);

  try {
    // Verify app exists
    const app = await appService.getApp(appId, userId);

    // Mark stream as active
    activeLogStreams.set(streamId, true);

    // Send initial connection event
    sendEvent('status', {
      appId,
      appName: app.name,
      timestamp: new Date().toISOString(),
      message: 'Connected to log stream',
      status: 'connected',
    });

    // Check if containerization is enabled
    const isContainerized = containerService.isEnabled();
    const isLocalRunning = localRunner.isAppRunning(appId);

    if (!isContainerized && !isLocalRunning) {
      sendEvent('event', {
        type: 'app_not_running',
        timestamp: new Date().toISOString(),
        message: '🔴 App is not running (containerization disabled and no local process)',
        level: 'warn',
      });
      
      sendEvent('complete', {
        appId,
        timestamp: new Date().toISOString(),
        message: 'Log stream ended - app not running',
      });
      
      activeLogStreams.delete(streamId);
      return res.end();
    }

    // Handle local (non-containerized) apps
    if (!isContainerized || isLocalRunning) {
      sendEvent('event', {
        type: 'local_app',
        timestamp: new Date().toISOString(),
        message: '🖥️  Streaming logs from local process',
        level: 'info',
      });

      const localStatus = localRunner.getAppStatus(appId);
      sendEvent('status', {
        appId,
        timestamp: new Date().toISOString(),
        isRunning: localStatus.isRunning,
        port: localStatus.port,
        uptime: localStatus.uptime,
        status: 'running',
        type: 'local',
      });

      // Stream local logs
      try {
        for await (const log of localRunner.streamLogs(appId, follow)) {
          if (!activeLogStreams.get(streamId) || req.destroyed) {
            break;
          }

          const logEvent = categorizeLogLine(log.message, log.timestamp.toISOString());
          logEvent.data.level = log.level === 'stderr' ? 'error' : 'info';
          sendEvent(logEvent.type, logEvent.data);
        }
      } catch (error: any) {
        logger.error('Local log streaming error', error, { appId });
      }

      sendEvent('complete', {
        appId,
        timestamp: new Date().toISOString(),
        message: 'Log stream ended',
      });
      
      activeLogStreams.delete(streamId);
      return res.end();
    }

    // Handle containerized apps
    // Get container status
    const status = await containerService.getContainerStatus(appId);

    // Send container status event
    sendEvent('status', {
      appId,
      timestamp: new Date().toISOString(),
      containerRunning: status.isRunning,
      containerReady: status.isReady,
      containerName: status.containerName,
      port: status.port,
      status: status.status,
      health: status.health,
      type: 'container',
    });

    if (!status.isRunning) {
      sendEvent('event', {
        type: 'container_not_running',
        timestamp: new Date().toISOString(),
        message: '🔴 Container is not running',
        level: 'info',
      });
      
      sendEvent('complete', {
        appId,
        timestamp: new Date().toISOString(),
        message: 'Log stream ended - container not running',
      });
      
      activeLogStreams.delete(streamId);
      return res.end();
    }

    // Send container started event
    sendEvent('event', {
      type: 'container_started',
      timestamp: new Date().toISOString(),
      message: `🐳 Container ${status.containerName} is running`,
      containerName: status.containerName,
      level: 'success',
    });

    // Stream container logs
    const handler = containerService['getHandler']();
    const logsIterable = await handler.streamLogs({
      appId,
      follow,
      tail,
      timestamps: true,
    });

    // Process log stream
    for await (const logLine of logsIterable) {
      // Check if stream is still active
      if (!activeLogStreams.get(streamId) || req.destroyed) {
        logger.info('Log stream closed by client', { appId, streamId });
        break;
      }

      const timestamp = new Date().toISOString();
      const line = logLine.trim();

      if (!line) continue;

      // Parse and categorize log events
      const logEvent = categorizeLogLine(line, timestamp);
      
      sendEvent(logEvent.type, logEvent.data);

      // Send heartbeat periodically to keep connection alive
      if (Math.random() < 0.01) {
        sendEvent('heartbeat', { timestamp });
      }
    }

    // Send completion event
    sendEvent('complete', {
      appId,
      timestamp: new Date().toISOString(),
      message: 'Log stream ended',
    });

  } catch (error: any) {
    logger.error('Container log streaming error', error, { appId, streamId });
    
    sendEvent('error', {
      appId,
      timestamp: new Date().toISOString(),
      error: error.message,
      message: `Failed to stream logs: ${error.message}`,
    });
  } finally {
    activeLogStreams.delete(streamId);
    res.end();
  }
});

/**
 * Categorize and format log lines
 */
function categorizeLogLine(line: string, timestamp: string): { type: string; data: any } {
  const lowerLine = line.toLowerCase();

  // Container lifecycle events
  if (lowerLine.includes('starting container') || lowerLine.includes('container started')) {
    return {
      type: 'event',
      data: {
        type: 'container_starting',
        timestamp,
        message: '🚀 ' + line,
        level: 'info',
      },
    };
  }

  if (lowerLine.includes('stopping container') || lowerLine.includes('container stopped')) {
    return {
      type: 'event',
      data: {
        type: 'container_stopping',
        timestamp,
        message: '🛑 ' + line,
        level: 'info',
      },
    };
  }

  if (lowerLine.includes('restarting container') || lowerLine.includes('container restarted')) {
    return {
      type: 'event',
      data: {
        type: 'container_restarting',
        timestamp,
        message: '🔄 ' + line,
        level: 'info',
      },
    };
  }

  // Dependency installation
  if (lowerLine.includes('installing dependencies') || 
      lowerLine.includes('pnpm install') || 
      lowerLine.includes('npm install') ||
      lowerLine.includes('yarn install')) {
    return {
      type: 'event',
      data: {
        type: 'dependencies_installing',
        timestamp,
        message: '📦 ' + line,
        level: 'info',
      },
    };
  }

  if (lowerLine.includes('packages in') || 
      lowerLine.includes('dependencies installed') ||
      lowerLine.includes('already up to date')) {
    return {
      type: 'event',
      data: {
        type: 'dependencies_installed',
        timestamp,
        message: '✅ ' + line,
        level: 'success',
      },
    };
  }

  // Vite/Dev server events
  if (lowerLine.includes('vite') && lowerLine.includes('ready')) {
    return {
      type: 'event',
      data: {
        type: 'server_ready',
        timestamp,
        message: '✨ ' + line,
        level: 'success',
      },
    };
  }

  if (lowerLine.includes('server running') || lowerLine.includes('dev server')) {
    return {
      type: 'event',
      data: {
        type: 'server_started',
        timestamp,
        message: '🌐 ' + line,
        level: 'success',
      },
    };
  }

  if (lowerLine.includes('local:') || lowerLine.includes('network:')) {
    return {
      type: 'event',
      data: {
        type: 'server_url',
        timestamp,
        message: '🔗 ' + line,
        level: 'info',
      },
    };
  }

  // File change detection (HMR)
  if (lowerLine.includes('file changed') || 
      lowerLine.includes('hmr update') ||
      lowerLine.includes('page reload')) {
    return {
      type: 'event',
      data: {
        type: 'file_changed',
        timestamp,
        message: '📝 ' + line,
        level: 'info',
      },
    };
  }

  if (lowerLine.includes('restarting server') || 
      lowerLine.includes('server restarted')) {
    return {
      type: 'event',
      data: {
        type: 'server_restarted',
        timestamp,
        message: '🔄 ' + line,
        level: 'info',
      },
    };
  }

  // Errors and warnings
  if (lowerLine.includes('error') || 
      lowerLine.includes('failed') ||
      lowerLine.includes('exception')) {
    return {
      type: 'log',
      data: {
        timestamp,
        message: '❌ ' + line,
        level: 'error',
        raw: line,
      },
    };
  }

  if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
    return {
      type: 'log',
      data: {
        timestamp,
        message: '⚠️  ' + line,
        level: 'warn',
        raw: line,
      },
    };
  }

  // Build/compilation events
  if (lowerLine.includes('building') || 
      lowerLine.includes('compiling') ||
      lowerLine.includes('bundling')) {
    return {
      type: 'event',
      data: {
        type: 'building',
        timestamp,
        message: '🔨 ' + line,
        level: 'info',
      },
    };
  }

  if (lowerLine.includes('built in') || 
      lowerLine.includes('compiled successfully')) {
    return {
      type: 'event',
      data: {
        type: 'build_complete',
        timestamp,
        message: '✅ ' + line,
        level: 'success',
      },
    };
  }

  // Default log entry
  return {
    type: 'log',
    data: {
      timestamp,
      message: line,
      level: 'info',
      raw: line,
    },
  };
}

/**
 * @swagger
 * /api/container-logs/{appId}/history:
 *   get:
 *     tags: [Container Logs]
 *     summary: Get historical container logs
 *     description: Retrieve past container logs without streaming
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: lines
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of log lines to retrieve
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *         description: Only return logs since timestamp (ISO 8601)
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: Container logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     appId:
 *                       type: string
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/:appId/history', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const userId = (req as any).user?.id;

    const lines = Number.parseInt(req.query.lines as string) || 100;
    const since = req.query.since as string;

    // Verify app exists
    await appService.getApp(appId, userId);

    // Check if app is running locally
    const isLocalRunning = localRunner.isAppRunning(appId);
    
    if (isLocalRunning) {
      const logs = localRunner.getLogs(appId, lines);
      const parsedLogs = logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        message: log.message,
        level: log.level === 'stderr' ? 'error' : 'info',
        raw: log.message,
      }));

      return res.json({
        success: true,
        data: {
          appId,
          type: 'local',
          totalLines: parsedLogs.length,
          logs: parsedLogs,
        },
      });
    }

    // Check if containerization is enabled
    if (!containerService.isEnabled()) {
      return res.json({
        success: true,
        data: {
          appId,
          logs: [],
          message: 'Containerization is disabled and app not running locally - no logs available',
        },
      });
    }

    // Get container status
    const status = await containerService.getContainerStatus(appId);

    if (!status.isRunning) {
      return res.json({
        success: true,
        data: {
          appId,
          logs: [],
          message: 'Container is not running',
        },
      });
    }

    // Get logs from container
    const handler = containerService['getHandler']();
    const logs = await handler.getLogs({
      appId,
      tail: lines,
      since,
      timestamps: true,
    });

    const parsedLogs = logs.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const timestamp = new Date().toISOString();
        const logEvent = categorizeLogLine(line, timestamp);
        return {
          timestamp,
          ...logEvent.data,
        };
      });

    res.json({
      success: true,
      data: {
        appId,
        containerName: status.containerName,
        totalLines: parsedLogs.length,
        logs: parsedLogs,
      },
    });

  } catch (error: any) {
    logger.error('Failed to retrieve container logs', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/container-logs/{appId}/events:
 *   get:
 *     tags: [Container Logs]
 *     summary: Get container lifecycle events
 *     description: Get recent container events (start, stop, restart, etc.)
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Container events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/:appId/events', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const userId = (req as any).user?.id;
    // Verify app exists
    await appService.getApp(appId, userId);

    // Check if app is running locally
    const isLocalRunning = localRunner.isAppRunning(appId);
    
    if (isLocalRunning) {
      const localStatus = localRunner.getAppStatus(appId);
      
      return res.json({
        success: true,
        data: {
          appId,
          type: 'local',
          events: [
            {
              type: 'process_running',
              timestamp: new Date().toISOString(),
              uptime: localStatus.uptime,
              port: localStatus.port,
            }
          ],
          message: 'Local process - limited event tracking available',
        },
      });
    }

    // Check if containerization is enabled
    if (!containerService.isEnabled()) {
      return res.json({
        success: true,
        data: {
          appId,
          events: [],
          message: 'Containerization disabled and app not running locally',
        },
      });
    }

    // Get container status
    const status = await containerService.getContainerStatus(appId);

    // Get container events
    const handler = containerService['getHandler']();
    const events = await handler.getEvents(appId);

    res.json({
      success: true,
      data: {
        appId,
        type: 'container',
        containerName: status.containerName,
        events,
      },
    });

  } catch (error: any) {
    logger.error('Failed to retrieve container events', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
