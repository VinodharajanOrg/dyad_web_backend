import { Router, Request, Response } from 'express';
import { GitService } from '../services/git_service';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const gitService = new GitService();

/**
 * Git Routes - REST API for git operations
 * Replaces git operations from src/ipc/handlers/github_handlers.ts
 */

/**
 * @swagger
 * /api/git/{appId}/init:
 *   post:
 *     tags: [Git]
 *     summary: Initialize git repository
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
 *         description: Repository initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post('/:appId/init', asyncHandler(async (req: Request, res: Response) => {
  await gitService.init(req.params.appId);
  res.json({ success: true, message: 'Git repository initialized' });
}));

/**
 * @swagger
 * /api/git/{appId}/clone:
 *   post:
 *     tags: [Git]
 *     summary: Clone repository
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
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: Git repository URL
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Repository cloned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/:appId/clone', asyncHandler(async (req: Request, res: Response) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }
  
  await gitService.clone(req.params.appId, url);
  res.json({ success: true, message: 'Repository cloned successfully' });
}));

/**
 * @swagger
 * /api/git/{appId}/add:
 *   post:
 *     tags: [Git]
 *     summary: Stage files
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filepath:
 *                 type: string
 *                 default: '.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Files staged
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post('/:appId/add', asyncHandler(async (req: Request, res: Response) => {
  const { filepath = '.' } = req.body;
  await gitService.add(req.params.appId, filepath);
  res.json({ success: true, message: 'Files staged successfully' });
}));

/**
 * @swagger
 * /api/git/{appId}/commit:
 *   post:
 *     tags: [Git]
 *     summary: Commit changes
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               author:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Changes committed
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
 *                     sha:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/:appId/commit', asyncHandler(async (req: Request, res: Response) => {
  const { message, author } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  
  const sha = await gitService.commit(req.params.appId, message, author);
  res.json({ success: true, data: { sha } });
}));

/**
 * @swagger
 * /api/git/{appId}/log:
 *   get:
 *     tags: [Git]
 *     summary: Get commit log
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: depth
 *         schema:
 *           type: string
 *           default: '10'
 *         description: Number of commits to retrieve
 *     security: 
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Commit history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GitCommit'
 */
router.get('/:appId/log', asyncHandler(async (req: Request, res: Response) => {
  const { depth = '10' } = req.query;
  const commits = await gitService.log(req.params.appId, Number.parseInt(depth as string));
  res.json({ data: commits });
}));

/**
 * @swagger
 * /api/git/{appId}/checkout:
 *   post:
 *     tags: [Git]
 *     summary: Checkout branch/commit
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
 *               - ref
 *             properties:
 *               ref:
 *                 type: string
 *                 description: Branch name, tag, or commit SHA
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Checked out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/:appId/checkout', asyncHandler(async (req: Request, res: Response) => {
  const { ref } = req.body;
  
  if (!ref) {
    return res.status(400).json({ error: 'ref is required' });
  }
  
  await gitService.checkout(req.params.appId, ref);
  res.json({ success: true, message: `Checked out ${ref}` });
}));

/**
 * @swagger
 * /api/git/{appId}/push:
 *   post:
 *     tags: [Git]
 *     summary: Push to remote
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remote:
 *                 type: string
 *                 default: origin
 *               ref:
 *                 type: string
 *                 default: main
 *     security: 
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pushed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post('/:appId/push', asyncHandler(async (req: Request, res: Response) => {
  const { remote = 'origin', ref = 'main' } = req.body;
  await gitService.push(req.params.appId, remote, ref);
  res.json({ success: true, message: 'Pushed successfully' });
}));

/**
 * @swagger
 * /api/git/{appId}/status:
 *   get:
 *     tags: [Git]
 *     summary: Get repository status
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
 *         description: Repository status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/GitStatus'
 */
router.get('/:appId/status', asyncHandler(async (req: Request, res: Response) => {
  const status = await gitService.status(req.params.appId);
  res.json({ data: status });
}));

/**
 * @swagger
 * /api/git/{appId}/branch:
 *   get:
 *     tags: [Git]
 *     summary: Get current branch
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
 *         description: Current branch name
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     branch:
 *                       type: string
 */
router.get('/:appId/branch', asyncHandler(async (req: Request, res: Response) => {
  const branch = await gitService.getCurrentBranch(req.params.appId);
  res.json({ data: { branch } });
}));

/**
 * @swagger
 * /api/git/{appId}/branches:
 *   get:
 *     tags: [Git]
 *     summary: List branches
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
 *         description: List of branches
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GitBranch'
 */
router.get('/:appId/branches', asyncHandler(async (req: Request, res: Response) => {
  const branches = await gitService.listBranches(req.params.appId);
  res.json({ data: branches });
}));

export default router;
