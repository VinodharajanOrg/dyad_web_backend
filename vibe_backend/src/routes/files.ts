import { Router, Request, Response } from 'express';
import { FileService } from '../services/file_service';
import { asyncHandler } from '../middleware/errorHandler';
import { appIdField, createAppFileSchema, pathQuerySchema } from '../db/validateSchema';
import { validate } from '../middleware/validateBody';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
const fileService = new FileService();

/**
 * File Routes - REST API for file operations
 * Replaces file operations from src/ipc/handlers/app_handlers.ts
 */

/**
 * @swagger
 * /api/files/{appId}:
 *   get:
 *     tags: [Files]
 *     summary: List files in directory
 * 
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *       - in: query
 *         name: path
 *         schema:
 *           type: string
 *         description: Relative path within app directory
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FileInfo'
 */
router.get('/:appId',validate(appIdField, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const { path = '' } = req.query;
  const files = await fileService.listFiles(req.params.appId, path as string);
  res.json({ data: files });
}));

/**
 * @swagger
 * /api/files/{appId}/read:
 *   get:
 *     tags: [Files]
 *     summary: Read file content
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File path relative to app directory
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: File content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/:appId/read',validate(appIdField, 'params'),validate(pathQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { path } = req.query;
  
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path query parameter is required' });
  }
  
  const content = await fileService.readFile(req.params.appId, path);
  res.json({ data: { content } });
}));

/**
 * @swagger
 * /api/files/{appId}/write:
 *   post:
 *     tags: [Files]
 *     summary: Write file content
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *               - content
 *             properties:
 *               path:
 *                 type: string
 *               content:
 *                 type: string
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: File written
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/:appId/write',  validate(createAppFileSchema, 'body'), validate(appIdField, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const { path, content } = req.body;
  
  if (!path || content === undefined) {
    return res.status(400).json({ error: 'path and content are required' });
  }
  
  await fileService.writeFile(req.params.appId, path, content);
  
  // Trigger container sync to enable hot-reload if container is running
  try {
    const { containerizationService } = await import('../services/containerization_service');
    const status = await containerizationService.getContainerStatus(req.params.appId);
    
    if (status.isRunning) {
      // Touch the file in container to trigger Vite HMR
      await containerizationService.syncFilesToContainer({
        appId: req.params.appId,
        filePaths: [path]
      });
    }
  } catch (error) {
    // Log but don't fail the file write if container sync fails
    console.warn('Container sync failed (container may not be running):', error);
  }
  
  res.json({ success: true, message: 'File written successfully' });
}));

/**
 * @swagger
 * /api/files/{appId}:
 *   delete:
 *     tags: [Files]
 *     summary: Delete file
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File path relative to app directory
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: File deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.delete('/:appId',validate(appIdField, 'params'), validate(pathQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { path } = req.query;
  
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path query parameter is required' });
  }
  
  await fileService.deleteFile(req.params.appId, path);
  res.json({ success: true, message: 'File deleted successfully' });
}));

/**
 * @swagger
 * /api/files/{appId}/mkdir:
 *   post:
 *     tags: [Files]
 *     summary: Create directory
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *             properties:
 *               path:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Directory created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/:appId/mkdir',validate(pathQuerySchema, 'body'), validate(appIdField, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const { path } = req.body;
  
  if (!path) {
    return res.status(400).json({ error: 'path is required' });
  }
  
  await fileService.createDirectory(req.params.appId, path);
  res.json({ success: true, message: 'Directory created successfully' });
}));

/**
 * @swagger
 * /api/files/{appId}/stats:
 *   get:
 *     tags: [Files]
 *     summary: Get file stats
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File path relative to app directory
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: File statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FileStats'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/:appId/stats',validate(appIdField, 'params'), validate(pathQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { path } = req.query;
  
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path query parameter is required' });
  }
  
  const stats = await fileService.getFileStats(req.params.appId, path);
  res.json({ data: stats });
}));

export default router;
