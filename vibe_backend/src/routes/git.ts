import { Router, Request, Response } from 'express';
import { GitService } from '../services/git_service';
import { asyncHandler } from '../middleware/errorHandler';
import axios from 'axios';
import { access } from 'fs';

const router = Router();
const gitService = new GitService();

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email?: string;
  };
}

/**
 * Git Routes - REST API for device flow operations
 */

/**
 * @swagger
 * /api/git/start:
 *   post:
 *     tags: [Git]
 *     summary: Start GitHub Device Authorization Flow
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device flow initiated
 */
router.post(
  '/start',
  asyncHandler(async (_req: Request, res: Response) => {
    const response = await axios.post(
      'https://github.com/login/device/code',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        scope: 'repo',
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    const {
      device_code,
      user_code,
      verification_uri,
      expires_in,
      interval,
    } = response.data;
    res.json({
      deviceCode: device_code,
      userCode: user_code,
      verificationUri: verification_uri,
      expiresIn: expires_in,
      interval,
    });
  })
);

/**
 * @swagger
 * /api/git/tokenStatus:
 *   get:
 *     tags: [Git]
 *     summary: Check GitHub Device Flow status
 *     parameters:
 *       - in: query
 *         name: deviceCode
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device flow status
 */
router.get(
  '/tokenStatus',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { deviceCode } = req.query;
    if (!deviceCode) {
      return res.status(400).json({ error: 'deviceCode is required' });
    }
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    const data = response.data;
    if (data.error === 'authorization_pending') {
      return res.json({ status: 'pending' });
    }
    if (data.error === 'access_denied') {
      return res.json({ status: 'denied' });
    }
    if (data.access_token) {
      await gitService.saveGithubToken(
        req.user.id,
        data.access_token
      );
      // TEMP (for now)
      return res.json({
        status: 'approved',
        accessToken: data.access_token
      });
    }
    return res.status(500).json({
      status: 'error',
      error: data,
    });
  })
);

/**
 * @swagger
 * /api/git/{appId}/repoSuggestion:
 *   get:
 *     tags: [Git]
 *     summary: Get GitHub repository suggestion for an app
 *     description: >
 *       Returns the suggested GitHub repository configuration for an app
 *       after a successful GitHub connection. This does not persist any data.
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Suggested GitHub repository configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     appName:
 *                       type: string
 *                       example: playful-deer-roam
 *                     org:
 *                       type: string
 *                       example: sruk1605-glitch
 *                     repo:
 *                       type: string
 *                       example: playful-deer-roam
 *                     branch:
 *                       type: string
 *                       example: main
 */
router.get(
  '/:appId/repoSuggestion',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await gitService.getGithubSuggestion(
      req.params.appId,
      req.user.id
    );
    res.json({ data });
  })
);

/**
 * @swagger
 * /api/git/repos:
 *   get:
 *     tags: [Git]
 *     summary: List existing GitHub repositories for connected user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of GitHub repositories
 */
router.get(
  '/repos',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const repos = await gitService.listGithubRepos(req.user.id);
    res.json({ data: repos });
  })
);


/**
 * @swagger
 * /api/git/{appId}/createRepo:
 *   post:
 *     tags: [Git]
 *     summary: Create a GitHub repository
 *     description: Creates a private GitHub repository under the connected GitHub account.
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
 *               - repo
 *               - branch
 *             properties:
 *               repo:
 *                 type: string
 *                 example: gentle-falcon-skip
 *               branch:
 *                 type: string
 *                 example: main
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Repository created successfully
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
 *                   example: Repository created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     org:
 *                       type: string
 *                       example: sruk1605-glitch
 *                     repo:
 *                       type: string
 *                       example: gentle-falcon-skip
 *                     branch:
 *                       type: string
 *                       example: main
 */
router.post(
  '/:appId/createRepo',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { repo, branch } = req.body;
    if (!repo || !branch) {
      return res.status(400).json({
        error: 'repo and branch are required',
      });
    }
    const data = await gitService.createGithubRepo(
      req.user.id,
      repo,
      branch
    );
    res.json({
      success: true,
      message: 'Repository created successfully',
      data,
    });
  })
);

/**
 * @swagger
 * /api/git/{appId}/sync:
 *   post:
 *     tags: [Git]
 *     summary: Push local app code to GitHub repository
 *     description: >
 *       Pushes the generated application code to a GitHub repository.
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - org
 *               - repo
 *               - branch
 *             properties:
 *               org:
 *                 type: string
 *                 description: GitHub organization or user name
 *                 example: sruk1605-glitch
 *               repo:
 *                 type: string
 *                 description: GitHub repository name
 *                 example: gentle-falcon-skip
 *               branch:
 *                 type: string
 *                 description: Branch to push code to
 *                 example: main
 *               force:
 *                 type: boolean
 *                 description: Force push to overwrite remote branch history
 *                 example: false
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Code pushed successfully
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
 *                   example: Code pushed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     sha:
 *                       type: string
 *                       description: Commit SHA of the pushed commit
 *                       example: 3f2c9a4b7c8d9e1a2b3c4d5e6f7a8b9c0d1e2f3
 *                     forceUsed:
 *                       type: boolean
 *                       example: false
 *       409:
 *         description: Branch has diverged (non-fast-forward / rejected)
 *       400:
 *         description: Invalid request or missing GitHub configuration
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: App not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:appId/sync',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { org, repo, branch, force = false } = req.body;
    if (!org || !repo || !branch) {
      return res.status(400).json({
        error: 'org, repo and branch are required for sync',
      });
    }
    const result = await gitService.syncToGithub(
      req.params.appId,
      req.user.id,
      { org, repo, branch },
      force
    );
    res.json({
      success: true,
      message: force
        ? 'Force push completed successfully'
        : 'Code pushed successfully',
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/git/checkConnectionStatus:
 *   get:
 *     tags: [Git]
 *     summary: Check GitHub connection status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub connection status
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
 *                     connected:
 *                       type: boolean
 *                       example: true
 */
router.get(
  '/checkConnectionStatus',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const status = await gitService.checkConnectionStatus(req.user.id);
    res.json({
      data: status,
    });
  })
);

/**
 * @swagger
 * /api/git/disconnect:
 *   delete:
 *     tags: [Git]
 *     summary: Disconnect GitHub account
 *     description: Removes GitHub OAuth token and disconnects GitHub integration for the entire account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub disconnected successfully
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
 *                   example: GitHub disconnected successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/disconnect',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await gitService.disconnectGithub(req.user.id);
    res.json({
      message: 'GitHub disconnected successfully',
    });
  })
);

/**
 * @swagger
 * /api/git/{appId}/disconnect:
 *   delete:
 *     tags: [Git]
 *     summary: Disconnect repository from app
 *     description: Removes the GitHub repository connection from a specific app while keeping the GitHub account connected
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Repository disconnected successfully
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
 *                   example: Repository disconnected from app successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: App not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:appId/disconnect',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await gitService.disconnectRepo(req.params.appId, req.user.id);
    res.json({
      success: true,
      message: 'Repository disconnected from app successfully',
    });
  })
);

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
  await gitService.add(req.params.appId);
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

/**
 * @swagger
 * /api/git/{appId}/revert:
 *   post:
 *     tags: [Git]
 *     summary: Revert to a previous commit by creating a new commit with that commit's state
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
 *               - targetOid
 *             properties:
 *               targetOid:
 *                 type: string
 *                 description: The commit oid (version) to revert to
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully reverted to the target commit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 newSha:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:appId/revert', asyncHandler(async (req: Request, res: Response) => {
  const { targetOid } = req.body;
  
  if (!targetOid) {
    return res.status(400).json({ error: 'targetOid is required' });
  }
  
  const newSha = await gitService.revert(req.params.appId, targetOid);
  res.json({ 
    success: true, 
    message: `Successfully reverted to commit ${targetOid}`,
    newSha,
  });
}));

export default router;
