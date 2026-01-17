import { requireAuth } from "../middleware/auth.middleware";
import { Router, Request, Response } from 'express';
import { AppService } from '../services/app_service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from "../middleware/validateBody";
import { createAppSchema,updateAppSchema,appIdParamSchema } from '../db/validateSchema';
const router = Router();
const appService = new AppService();

/**
 * App Routes - REST API for app management
 * Replaces IPC handlers from src/ipc/handlers/app_handlers.ts
 */

/**
 * @swagger
 * /api/apps/templates:
 *   get:
 *     tags: [Apps]
 *     summary: Get available app templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 */
router.get(
  "/templates",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const templates = await appService.getTemplates();
    res.json({ data: templates });
  })
);

/**
 * @swagger
 * /api/apps:
 *   get:
 *     tags: [Apps]
 *     summary: Get all apps
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of apps
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/App'
 */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const allApps = await appService.listApps(userId);
    res.json({ data: allApps });
  })
);

/**
 * @swagger
 * /api/apps/search:
 *   get:
 *     tags: [Apps]
 *     summary: Get apps by name
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         description: Name or partial name of the app to search
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of matching apps
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       path:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 */
router.get(
  "/search",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.query;
    const userId = (req as any).user?.id;
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: "Query param 'name' is required" });
    }

    const apps = await appService.searchApps(String(name), userId);
    res.json({ data: apps });
  })
);

/**
 * @swagger
 * /api/apps/{id}:
 *   get:
 *     tags: [Apps]
 *     summary: Get app by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: App ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: App details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/App'
 *       404:
 *         description: App not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

router.get('/:id', requireAuth,validate(appIdParamSchema,'params'), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const app = await appService.getApp(req.params.id, userId);
  res.json({ data: app });
}));

/**
 * @swagger
 * /api/apps:
 *   post:
 *     tags: [Apps]
 *     summary: Create new app
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - path
 *             properties:
 *               name:
 *                 type: string
 *                 description: App name
 *               path:
 *                 type: string
 *                 description: App directory path (relative to APPS_BASE_DIR or absolute)
 *               template:
 *                 type: string
 *                 enum: [vite-react-shadcn, blank]
 *                 description: Template to use for app scaffolding
 *               githubOrg:
 *                 type: string
 *                 description: GitHub organization (for importing from GitHub)
 *               githubRepo:
 *                 type: string
 *                 description: GitHub repository (for importing from GitHub)
 *               installCommand:
 *                 type: string
 *                 description: Command to install dependencies (e.g., "pnpm install")
 *               startCommand:
 *                 type: string
 *                 description: Command to start dev server (e.g., "pnpm dev")
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: App created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/App'
 */

router.post('/',requireAuth, validate(createAppSchema, 'body'),asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const app = await appService.createApp({ ...req.body, userId });
  
  // Start container with scaffold immediately if containerization is enabled
  const { ContainerizationService } = await import('../services/containerization_service');
  const containerService = ContainerizationService.getInstance();
  
  if (containerService.isEnabled()) {
    // Start container in background (don't await)
    const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
    const lifecycleService = ContainerLifecycleService.getInstance();
    const fullAppPath = appService.getFullAppPath(app.path);
    
    lifecycleService.allocatePort(app.id.toString()).then(port => {
      return containerService.runContainer({
        appId: app.id.toString(),
        appPath: fullAppPath,
        port: port,
      });
    }).catch(error => {
      console.error('Failed to start container for new app:', error);
    });
  }
  
  res.status(201).json({ data: app });
}));

/**
 * @swagger
 * /api/apps/{id}:
 *   put:
 *     tags: [Apps]
 *     summary: Update app
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               path:
 *                 type: string
 *               githubOrg:
 *                 type: string
 *               installCommand:
 *                 type: string
 *               isFavorite:
 *                 type: boolean
 *               renameFolder:
 *                type: boolean
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: App updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/App'
 */

router.put('/:id',requireAuth,validate(appIdParamSchema, 'params'), validate(updateAppSchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
    const app = await appService.updateApp(Number.parseInt(req.params.id), userId, req.body);
  res.json({ data: app });
}));


/**
 * @swagger
 * /api/apps/{id}:
 *   delete:
 *     tags: [Apps]
 *     summary: Delete app
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: App deleted
 *       404:
 *         description: App not found
 */
router.delete(
  "/:id",
  requireAuth,
  validate(appIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const result = await appService.deleteApp(Number.parseInt(req.params.id), userId);
    res.json(result);
  })
);

/**
 * @swagger
 * /api/apps/{id}/favorite:
 *   post:
 *     tags: [Apps]
 *     summary: Toggle favorite status
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Favorite status toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/App'
 */
router.post(
  "/:id/favorite",
  requireAuth,
  validate(appIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const app = await appService.toggleFavorite(req.params.id, userId);
    res.json({ data: app });
  })
);

export default router;
