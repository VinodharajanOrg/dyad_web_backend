import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings_service';
import { checkRole } from '../middleware/checkRoles';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { apiKeyField, providerIdField } from '../db/validateSchema';
import { validate } from '../middleware/validateBody';

const router = Router();
const settingsService = new SettingsService();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get user settings
 *     description: Retrieve current user settings including selected AI model and API keys
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     userId:
 *                       type: string
 *                     selectedModel:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         providerId:
 *                           type: string
 *                     apiKeys:
 *                       type: object
 *                       description: API keys by provider (keys are masked)
 *                     selectedChatMode:
 *                       type: string
 *                       enum: [auto-code, agent, ask, custom]
 *                     smartContextEnabled:
 *                       type: boolean
 *                     turboEditsV2Enabled:
 *                       type: boolean
 */
router.get('/',asyncHandler(async (req: Request, res: Response) => {
  // Extract userId from token (set by auth middleware)
  let userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }
  const settings = await settingsService.getSettings(userId);
  
  // Mask API keys in response
  const maskedSettings = {
    ...settings,
    apiKeys: Object.keys(settings.apiKeys).reduce((acc, key) => {
      const value = settings.apiKeys[key];
      acc[key] = value ? `${value.slice(0, 8)}...${value.slice(-4)}` : '';
      return acc;
    }, {} as Record<string, string>),
  };
  
  res.json({ data: maskedSettings });
}));

/**
 * @swagger
 * /api/settings:
 *   put:
 *     tags: [Settings]
 *     summary: Update settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selectedModel:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   providerId:
 *                     type: string
 *               selectedChatMode:
 *                 type: string
 *                 enum: [auto-code, agent, ask, custom]
 *               smartContextEnabled:
 *                 type: boolean
 *               turboEditsV2Enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated
 */

router.put('/', checkRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  let userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }
  const updates = req.body;
  const settings = await settingsService.updateSettings(updates, userId );
  
  res.json({ data: settings });
}));

/**
 * @swagger
 * /api/settings/api-keys/{providerId}:
 *   put:
 *     tags: [Settings]
 *     summary: Update API key for a provider
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID (openai, anthropic, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: API key for the provider
 *     responses:
 *       200:
 *         description: API key updated
 */

//provider id is name like openai, anthropic etc.
router.put('/api-keys/:providerId',checkRole('admin'), validate(providerIdField, 'params'), validate(apiKeyField, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { apiKey } = req.body;
  let userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }
  
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }
  
  await settingsService.updateApiKey(userId, providerId, apiKey);
  
  res.json({ 
    message: `API key for ${providerId} updated successfully` 
  });
}));

/**
 * @swagger
 * /api/settings/api-keys/{providerId}:
 *   delete:
 *     tags: [Settings]
 *     summary: Delete API key for a provider
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key deleted
 */
router.delete('/api-keys/:providerId',checkRole('admin'), validate(providerIdField, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  let userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }
  await settingsService.deleteApiKey( providerId, userId);
  
  res.json({ 
    message: `API key for ${providerId} deleted successfully` 
  });
}));

export default router;

