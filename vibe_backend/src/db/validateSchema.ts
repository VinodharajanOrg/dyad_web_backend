

import { z } from 'zod';
// --- App-related ---

// Base field schemas
export const idField = z.object({ id: z.union([z.number().min(1), z.string().min(1)]) });
export const appIdField = z.object({ appId: z.union([z.number().min(1).max(64), z.string().min(1)]) });
export const filePathField = z.object({ path: z.string().min(1) });

// App schemas
export const createAppSchema = z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    template: z.string().optional(),
    installCommand: z.string().optional(),
    startCommand: z.string().optional(),
});

export const updateAppSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  githubOrg: z.string().optional(),
  installCommand: z.string().optional(),
  isFavorite: z.boolean().optional(),
  renameFolder: z.boolean().optional(),
  startCommand: z.string().optional(),
});

//check id param schema

export const appIdParamSchema = idField;

/* Done app.ts validation schemas */

/* container.ts schema */
export const runAppSchema = appIdField;

export const stopAppSchema = appIdField;
export const getAppLogsSchema = appIdField.extend({ tail: z.union([z.number(), z.string()]).optional() });
export const getStreamSchema = z.object({
  follow: z.string().optional(),
  tail: z.string().optional(),
});
export const getAppHistorySchema =z.object({
  lines: z.string().optional(),
});

/* container.ts schema end */
export const getAppStatusSchema = appIdField;
export const quickStartAppSchema = z.object({ skipInstall: z.boolean().optional() });
export const syncAppFilesSchema = z.object({ filePaths: z.array(z.string().min(1)).optional() });

/* files.ts schema */
export const pathQuerySchema = z.object({
  path: z.string().min(1),
});
export const appIdParam = appIdField;
export const filePathParamSchema = filePathField;
export const appFilePathSchema = appIdField.merge(filePathField);
export const createAppFileSchema = z.object({
    path: z.string().min(1),
    content: z.string().min(0),
});

/* file.ts ends schema */

/* git.ts schema */
export const urlSchema = z.object({
  url: z.string().min(1),
});

export const commitSchema = z.object({
  message: z.string().min(1),
});

export const refSchema = z.object({
  ref: z.string().min(1),
});
/* git.ts schema end */
// --- Chat-related ---

// Base chat fields
export const chatIdField = z.object({ chatId: z.union([z.number().min(1).max(64), z.string().min(1)]) });
export const messageIdField = z.object({ messageId: z.union([z.number().min(1), z.string().min(1)]) });

/**
 * @api {GET} /chats/:chatId Get chat by ID
 * @param {string} chatId - Chat ID (required)
 */
export const getChatSchema = chatIdField;
export const createChatSchema = appIdField.extend({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});
export const titleChatsSchema = z.object({
  title: z.string().min(1),
});

export const createMessageSchema = z.object({
  content: z.string().min(1),
  role: z.string().min(1),
  model: z.string().optional(),
});

export const getMessageSchema = chatIdField.merge(messageIdField);
 /* Chat-related schemas end here */

 //--- Settings-related ---

// API Key schemas
export const providerIdField = z.object({ providerId: z.union([z.number().min(1), z.string().min(1)]) });
export const apiKeyField  = z.object({ apiKey: z.string().min(1) });
export const createApiKeySchema = providerIdField.extend({
  apiKey: z.string().min(1),
});
export const deleteApiKeySchema = providerIdField;

/* Settings-related schemas end here */

/* streaming-related schemas */
export const streamIdField = z.object({ streamId: z.union([z.number().min(1), z.string().min(1)]) });
export const createStreamSchema = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  config: z.record(z.any()).optional(),
});
export const updateStreamSchema = streamIdField.extend({
  name: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  config: z.record(z.any()).optional(),
});

/* streaming-related schemas end here */
/* provider-related schemas */
export const providerIdParamSchema = z.object({ providerId: z.union([z.number().min(1), z.string().min(1)]) });
export const createProviderSchema = z.object({
  name: z.string().min(1),
  apiBaseUrl: z.string().min(1),
});
export const createModelSchema = z.object({
  displayName: z.string().min(1),
  apiName: z.string().min(1)
});
export const modelIdSchema = z.object({ modelId: z.union([z.number().min(1), z.string().min(1)]) });
export const deleteModelSchema = z.object({
  providerId: z.union([z.number().min(1), z.string().min(1)]).optional(),
  modelId: z.union([z.number().min(1), z.string().min(1)]).optional(),
}).refine((data) => data.providerId || data.modelId, {
  message: "Either providerId or modelId must be provided",
});
export const updateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.any()).optional(),
});
/* provider-related schemas end here */