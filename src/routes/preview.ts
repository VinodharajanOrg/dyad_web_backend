import { Router, Request, Response, NextFunction } from 'express';
import { ContainerizationService } from '../services/containerization_service';
import { ContainerLifecycleService } from '../services/container_lifecycle_service';
import { AppService } from '../services/app_service';
import { logger } from '../utils/logger';
import http from 'node:http';

const router = Router();

/**
 * Container preview proxy route
 * Proxies requests to running containers on their allocated ports
 * 
 * GET /app/preview/:appId
 * GET /app/preview/:appId/*
 */

// Handle all preview requests with optional path
router.get('/app/preview/:appId/:path(*)?', async (req: Request, res: Response, next: NextFunction) => {
  const { appId, path } = req.params;
  const userId = (req as any).user?.id;

  const requestPath = path || '';
  
  try {
    const containerService = ContainerizationService.getInstance();
    const lifecycleService = ContainerLifecycleService.getInstance();
    const appService = new AppService();

    // Record activity for lifecycle management
    lifecycleService.recordActivity(appId);

    // Check if container is running
    const isRunning = await containerService.isContainerRunning(appId);
    
    if (!isRunning) {
      // Start container if not running
      logger.info('Container not running, starting', {
        service: 'preview',
        appId
      });

      const containerExists = await containerService.containerExists(appId);
      
      if (containerExists) {
        // Remove stopped container
        await containerService.stopContainer(appId);
        lifecycleService.releasePort(appId);
      }

      // Get app details and start container
      const app = await appService.getApp(appId, userId);
      const port = await lifecycleService.allocatePort(appId, true);
      const fullAppPath = appService.getFullAppPath(app.path);

      const result = await containerService.runContainer({
        appId: appId,
        appPath: fullAppPath,
        port: port,
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to start container',
          details: result.error
        });
      }

      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Get actual container port from container status
    const status = await containerService.getContainerStatus(appId);
    const port = status.port || lifecycleService.getPort(appId) || 32100;

    // Proxy request to container
    // In Docker, app containers expose ports to host, so use host.docker.internal
    // In development, use localhost directly
    const containerHost = process.env.NODE_ENV === 'production' ? 'host.docker.internal' : 'localhost';
    const targetUrl = new URL(`http://${containerHost}:${port}/${requestPath}`);
    
    logger.info(`Proxying to container - app:${appId} target:${targetUrl.href}`);

    // Create proxy request
    const forwardHeaders: http.OutgoingHttpHeaders = {
      'user-agent': req.headers['user-agent'] || 'DyadPreviewProxy/1.0',
      'accept': req.headers['accept'] || '*/*',
      'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      'host': targetUrl.host,
    };

    // Forward cookies if present
    if (req.headers.cookie) {
      forwardHeaders.cookie = req.headers.cookie;
    }

    logger.info(`Proxy headers:`, forwardHeaders);

    const proxyReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers: forwardHeaders,
        timeout: 30000, // 30 second timeout
      },
      (proxyRes) => {
        logger.info(`Proxy response received - status:${proxyRes.statusCode} app:${appId}`);
        
        // Forward status code
        res.status(proxyRes.statusCode || 200);

        // Forward headers
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        });

        // Handle content rewriting for HTML/JS files
        const contentType = proxyRes.headers['content-type'] || '';
        const isTextContent = contentType.includes('text/html') ||
                             contentType.includes('text/javascript') ||
                             contentType.includes('application/javascript') ||
                             contentType.includes('text/css');

        if (isTextContent) {
          let body = '';
          proxyRes.setEncoding('utf8');
          
          proxyRes.on('data', (chunk) => {
            body += chunk;
          });

          proxyRes.on('end', () => {
            // Rewrite absolute paths to include /app/preview/:appId prefix
            const rewritten = body
              .replace(/(\s+src=["'])\/(?!app\/preview)/g, `$1/app/preview/${appId}/`)
              .replace(/(\s+href=["'])\/(?!app\/preview)/g, `$1/app/preview/${appId}/`)
              .replace(/(from\s+["'])\/(?!app\/preview)/g, `$1/app/preview/${appId}/`)
              .replace(/(import\s*\(\s*["'])\/(?!app\/preview)/g, `$1/app/preview/${appId}/`)
              .replace(/(import\s+["'])\/(?!app\/preview)/g, `$1/app/preview/${appId}/`)
              .replace(/(url\(\s*["']?)\/(?!app\/preview)/g, `$1/app/preview/${appId}/`);

            // Add base tag for HTML files
            if (contentType.includes('text/html') && !rewritten.includes('<base')) {
              const withBase = rewritten.replace(
                '<head>',
                `<head>\n  <base href="/app/preview/${appId}/">`
              );
              res.send(withBase);
            } else {
              res.send(rewritten);
            }
          });
        } else {
          // Stream binary content directly
          proxyRes.pipe(res);
        }
      }
    );

    proxyReq.on('timeout', () => {
      logger.error(`Proxy request timeout - app:${appId} port:${port} path:${requestPath}`);
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway timeout - container not responding',
          appId,
          port
        });
      }
    });

    proxyReq.on('error', (error) => {
      logger.error(`Proxy request failed - app:${appId} port:${port}`, error);

      if (!res.headersSent) {
        res.status(502).json({
          error: 'Failed to connect to container',
          details: error.message,
          appId,
          port
        });
      }
    });

    proxyReq.on('timeout', () => {
      logger.error(`Proxy request timeout - app:${appId} port:${port}`);
      proxyReq.destroy();
      
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Container response timeout',
          appId,
          port
        });
      }
    });

    // Forward request body only for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '') && req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
    }

    proxyReq.end();

  } catch (error: any) {
    logger.error('Preview route error', error, {
      service: 'preview',
      appId
    });
    next(error);
  }
});

/**
 * Root preview endpoint - returns info about preview service
 */
router.get('/app/preview', (req: Request, res: Response) => {
  res.json({
    service: 'Container Preview Proxy',
    version: '1.0.0',
    usage: '/app/preview/:appId/[path]',
    examples: [
      '/app/preview/1/',
      '/app/preview/2/index.html',
      '/app/preview/3/assets/logo.png'
    ],
    portRange: {
      min: 32100,
      max: 32200
    }
  });
});

export default router;
