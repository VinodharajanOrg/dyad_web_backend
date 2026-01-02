import { Router, Request, Response } from 'express';
import { ProvidersService } from '../services/providers_service';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { createModelSchema, createProviderSchema, deleteModelSchema, modelIdSchema, providerIdField } from '../db/validateSchema';
import { validate } from '../middleware/validateBody';

const router = Router();
const providersService = new ProvidersService();

/**
 * @swagger
 * /api/providers/provider:
 *   post:
 *     tags: [Providers]
 *     summary: Create provider
 *     description: >
 *       Creates a new provider in the language_model_providers table.  
 *       If the provider already exists, the existing provider is returned.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - apiBaseUrl
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the provider
 *                 example: "OpenAI"
 *               apiBaseUrl:
 *                 type: string
 *                 description: Base API URL of the provider
 *                 example: "https://api.openai.com/v1"
 *               envVarName:
 *                 type: string
 *                 nullable: true
 *                 description: Environment variable storing provider API key
 *                 example: "OPENAI_API_KEY"
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       201:
 *         description: Provider created or returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 provider:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Failed to create provider
 */
router.post(
  "/provider",
  validate(createProviderSchema, 'body'), 
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;

    const result = await providersService.createProvider(body);

    return res.status(201).json({
      message: result.message,
      provider: result.provider,
    });
  })
);

/**
 * @swagger
 * /api/providers/{providerId}/model:
 *   post:
 *     tags: [Providers]
 *     summary: Create model for a provider
 *     description: >
 *       Creates a new model in the language_models table for a specific provider.  
 *       If the model already exists, the existing model is returned.
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the provider to attach the model to
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - displayName
 *               - apiName
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: User-friendly model name
 *                 example: "GPT-4 Turbo"
 *               apiName:
 *                 type: string
 *                 description: API name used by provider
 *                 example: "gpt-4-turbo"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "High performance GPT-4 model"
 *               maxOutputTokens:
 *                 type: integer
 *                 nullable: true
 *                 example: 4096
 *               contextWindow:
 *                 type: integer
 *                 nullable: true
 *                 example: 128000
 *               approved:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Model created or returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 model:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Failed to create model
 */
router.post(
  "/:providerId/model",
  validate(providerIdField, 'params'),
  validate(createModelSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = Number(req.params.providerId);
    const body = req.body;

    const result = await providersService.createModel(providerId, body);

    return res.status(201).json({
      message: result.message,
      model: result.model,
    });
  })
);

/**
 * @swagger
 * /api/providers/models/{id}:
 *   put:
 *     tags: [Providers]
 *     summary: Update an existing AI model
 *     description: Modify the details of an existing language model
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the model to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: Updated display name
 *                 example: "OpenAI GPT-4.1 Turbo"
 *               apiName:
 *                 type: string
 *                 description: Updated API name
 *                 example: "gpt-4.1-turbo"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Faster optimized version of GPT-4.1"
 *               maxOutputTokens:
 *                 type: integer
 *                 nullable: true
 *                 example: 8192
 *               contextWindow:
 *                 type: integer
 *                 nullable: true
 *                 example: 256000
 *               builtinProviderId:
 *                 type: string
 *                 nullable: true
 *               customProviderId:
 *                 type: integer
 *                 nullable: true
 *               approved:
 *                 type: boolean
 *                 example: true
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Model updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.put(
  "/models/:modelId",
  validate(modelIdSchema , 'params'),                                                              
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.modelId);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: "Invalid model ID",
      });
    }

    const updatedModel = await providersService.updateModel(id, req.body);

    res.json({
      message: "Model updated successfully",
      data: updatedModel,
    });
  })
);

/**
 * @swagger
 * /api/providers/provider-model:
 *   delete:
 *     tags: [Providers]
 *     summary: Delete provider (and its models) or delete a single model
 *     description: >
 *       - If providerId is provided → deletes the provider AND all associated models.  
 *       - If modelId is provided → deletes only the model.  
 *       - One of providerId or modelId is required.
 *     parameters:
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: integer
 *         description: ID of the provider to delete
 *       - in: query
 *         name: modelId
 *         schema:
 *           type: integer
 *         description: ID of the model to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delete operation completed
 *       400:
 *         description: Missing providerId or modelId
 *       404:
 *         description: Provider or model not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/provider-model",
  validate(deleteModelSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = req.query.providerId ? Number(req.query.providerId) : undefined;
    const modelId = req.query.modelId ? Number(req.query.modelId) : undefined;

    if (!providerId && !modelId) {
      return res.status(400).json({
        message: "providerId or modelId is required",
      });
    }

    const result = await providersService.deleteProviderOrModel({ providerId, modelId });

    res.json({
      message: providerId
        ? "Provider and all associated models deleted successfully"
        : "Model deleted successfully",
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/providers/all_providers:
 *   get:
 *     tags: [Providers]
 *     summary: Get all providers
 *     description: Fetch all providers stored in the language_model_providers table.
 *     security:  
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of providers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "OpenAI"
 *                       apiBaseUrl:
 *                         type: string
 *                         example: "https://api.openai.com/v1"
 *                       envVarName:
 *                         type: string
 *                         example: "OPENAI_API_KEY"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-12-05T10:00:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-12-05T10:00:00.000Z"
 *       500:
 *         description: Failed to fetch providers
 */
router.get(
  "/all_providers",
  asyncHandler(async (_req: Request, res: Response) => {
    const providers = await providersService.getAllProviders();
    res.status(200).json({ data: providers });
  })
);

/**
 * @swagger
 * /api/providers/provider-model:
 *   get:
 *     tags: [Providers]
 *     summary: Get all providers with their available models
 *     description: >
 *       Returns a list of all providers and the models linked to them in the language_models table.
 *       Each provider includes its metadata and the list of models associated with it.
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: Providers with their models retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   description: An object where each key is a provider name (e.g., "openai")
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       displayName:
 *                         type: string
 *                         example: "OpenAI"
 *                       apiBaseUrl:
 *                         type: string
 *                         example: "https://api.openai.com/v1"
 *                       envVarName:
 *                         type: string
 *                         nullable: true
 *                         example: "OPENAI_API_KEY"
 *                       models:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 10
 *                             apiName:
 *                               type: string
 *                               example: "gpt-4-turbo"
 *                             name:
 *                               type: string
 *                               example: "GPT-4 Turbo"
 *                             description:
 *                               type: string
 *                               nullable: true
 *                               example: "High-performance GPT-4 model"
 *                             maxOutputTokens:
 *                               type: integer
 *                               nullable: true
 *                               example: 4096
 *                             contextWindow:
 *                               type: integer
 *                               nullable: true
 *                               example: 128000
 *                             builtinProviderId:
 *                               type: integer
 *                               nullable: true
 *                               example: null
 *                             customProviderId:
 *                               type: integer
 *                               example: 1
 *                             approved:
 *                               type: boolean
 *                               example: true
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                               example: "2025-12-05T10:00:00.000Z"
 *                             updatedAt:
 *                               type: string
 *                               format: date-time
 *                               example: "2025-12-05T10:00:00.000Z"
 *       500:
 *         description: Failed to fetch providers and models
 */
router.get(
  "/provider-model",
  asyncHandler(async (_req: Request, res: Response) => {
    const models = await providersService.getAvailableModels();
    res.json({ data: models });
  })
);

/**
 * @swagger
 * /api/providers/{providerId}/models:
 *   get:
 *     tags: [Providers]
 *     summary: Get all models for a provider
 *     description: >
 *       Fetch all AI models associated with a specific provider from the language_models table.
 *       The provider's basic information is also returned along with the list of models.
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the provider whose models need to be retrieved.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of models retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 provider:
 *                   type: object
 *                   description: Provider details
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "OpenAI"
 *                     apiBaseUrl:
 *                       type: string
 *                       example: "https://api.openai.com/v1"
 *                     envVarName:
 *                       type: string
 *                       nullable: true
 *                       example: "OPENAI_API_KEY"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-05T10:00:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-05T10:00:00.000Z"
 *                 models:
 *                   type: array
 *                   description: List of models for the provider
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 10
 *                       displayName:
 *                         type: string
 *                         example: "GPT-4 Turbo"
 *                       apiName:
 *                         type: string
 *                         example: "gpt-4-turbo"
 *                       description:
 *                         type: string
 *                         nullable: true
 *                         example: "High performance GPT-4 model"
 *                       maxOutputTokens:
 *                         type: integer
 *                         nullable: true
 *                         example: 4096
 *                       contextWindow:
 *                         type: integer
 *                         nullable: true
 *                         example: 128000
 *                       customProviderId:
 *                         type: integer
 *                         example: 1
 *                       approved:
 *                         type: boolean
 *                         example: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-12-05T10:00:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-12-05T10:00:00.000Z"
 *       400:
 *         description: Invalid provider ID
 *       404:
 *         description: Provider not found
 *       500:
 *         description: Failed to fetch models
 */
router.get(
  "/:providerId/models",
  validate(providerIdField, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const providerId = Number(req.params.providerId);

    if (!providerId || Number.isNaN(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }

    const result = await providersService.getModelsByProviderId(providerId);

    res.status(200).json({
      provider: result.provider,
      models: result.models,
    });
  })
);


/**
 * @swagger
 * /api/providers/models:
 *   get:
 *     tags: [Providers]
 *     summary: Get all AI models
 *     description: Fetch all language models stored in the language_models table.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of models retrieved successfully
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
 *                         example: 1
 *                       displayName:
 *                         type: string
 *                         example: "GPT-4 Turbo"
 *                       apiName:
 *                         type: string
 *                         example: "gpt-4-turbo"
 *                       description:
 *                         type: string
 *                         nullable: true
 *                         example: "High performance GPT-4 model"
 *                       maxOutputTokens:
 *                         type: integer
 *                         nullable: true
 *                         example: 4096
 *                       contextWindow:
 *                         type: integer
 *                         nullable: true
 *                         example: 128000
 *                       builtinProviderId:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       customProviderId:
 *                         type: integer
 *                         nullable: true
 *                         example: 1
 *                       approved:
 *                         type: boolean
 *                         example: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-12-05T10:00:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-12-05T10:00:00.000Z"
 *       500:
 *         description: Failed to fetch models
 */
router.get(
  "/models",
  asyncHandler(async (_req: Request, res: Response) => {
    const models = await providersService.getAllModels();
    res.status(200).json({ data: models });
  })
);

/**
 * @swagger
 * /api/providers/{id}:
 *   put:
 *     tags: [Providers]
 *     summary: Update an existing AI provider
 *     description: Modify the details of an existing provider in the language_model_providers table.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the provider to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Updated provider name
 *                 example: "OpenAI"
 *               apiBaseUrl:
 *                 type: string
 *                 description: Updated API base URL
 *                 example: "https://api.openai.com/v1"
 *               envVarName:
 *                 type: string
 *                 nullable: true
 *                 description: Updated environment variable key for API access
 *                 example: "OPENAI_API_KEY"
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: Provider updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Provider updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "OpenAI"
 *                     apiBaseUrl:
 *                       type: string
 *                       example: "https://api.openai.com/v1"
 *                     envVarName:
 *                       type: string
 *                       nullable: true
 *                       example: "OPENAI_API_KEY"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-05T10:00:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-06T15:20:00.000Z"
 *       400:
 *         description: Invalid provider ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid provider ID"
 *       404:
 *         description: Provider not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Provider not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put(
  "/:providerId",
  validate(providerIdField, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.providerId);

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }

    try {
      const updatedProvider = await providersService.updateProvider(id, req.body);

      return res.status(200).json({
        message: "Provider updated successfully",
        data: updatedProvider,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  })
);


export default router;
