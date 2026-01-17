import { Router, Request, Response } from 'express';
import { ChatService } from '../services/chat_service';
import { AIService } from '../services/ai_service';
import { CodebaseService } from '../services/codebase_service';
import { PromptService } from '../services/prompt_service';
import { AppService } from '../services/app_service';
import { db } from '../db';
import { chats, messages, apps } from '../db/schema';
import { eq } from 'drizzle-orm';
import { CoreMessage } from 'ai';
import { logger } from '../utils/logger';
import { sanitizePromptInput } from '../utils/sanitize';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * HTTP Streaming API - Server-Sent Events (SSE)
 * Replaces WebSocket for AI chat streaming
 */

const router = Router();

/**
 * Check if package.json has dependency changes
 */
function hasPackageJsonChanged(appPath: string, newContent: string): boolean {
  try {
    const existingPath = path.join(appPath, 'package.json');
    if (!fs.existsSync(existingPath)) {
      return true; // New package.json
    }
    
    const existingContent = fs.readFileSync(existingPath, 'utf-8');
    const existing = JSON.parse(existingContent);
    const newPkg = JSON.parse(newContent);
    
    // Compare dependencies and devDependencies
    const existingDeps = JSON.stringify({
      dependencies: existing.dependencies || {},
      devDependencies: existing.devDependencies || {}
    });
    const newDeps = JSON.stringify({
      dependencies: newPkg.dependencies || {},
      devDependencies: newPkg.devDependencies || {}
    });
    
    return existingDeps !== newDeps;
  } catch (error) {
    logger.warn('Error comparing package.json', { error: String(error) });
    return true; // Assume changed if can't compare
  }
}

interface ChatStreamRequest {
  chatId: number;
  prompt?: string;
  messageId?: number;
  attachments?: Array<{
    name: string;
    type: string;
    data: string;
    attachmentType: 'upload-to-codebase' | 'chat-context';
  }>;
  selectedComponent?: {
    relativePath: string;
    label: string;
  } | null;
  redo?: boolean;
  selectedModel?: {
    id: string;
    name: string;
    providerId: string;
  };
  chatMode?: 'auto-code' | 'agent' | 'ask' | 'custom';
}

// Active streaming sessions with abort controllers
const activeStreams = new Map<string, AbortController>();

/**
 * @swagger
 * /api/stream/chat:
 *   post:
 *     tags: [Stream]
 *     summary: Stream AI chat response using SSE
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *             properties:
 *               chatId:
 *                 type: number
 *               prompt:
 *                 type: string
 *               messageId:
 *                 type: number
 *               redo:
 *                 type: boolean
 *               selectedModel:
 *                 type: object
 *                 description: Override AI model for this request (optional)
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: gemini-2.5-flash
 *                   name:
 *                     type: string
 *                     example: Gemini 2.5 Flash
 *                   providerId:
 *                     type: string
 *                     example: google
 *               chatMode:
 *                 type: string
 *                 enum: [auto-code, ask, agent, custom]
 *                 description: Override chat mode for this request (optional)
 *                 example: auto-code
 *     security:
 *         - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stream of chat events
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: API key not configured for selected model
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: API key not configured for google. Please configure it in settings.
 */
router.post('/chat', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const streamRequest: ChatStreamRequest = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Generate unique stream ID
  const streamId = `${streamRequest.chatId}-${Date.now()}`;

  // Send helper function
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Send connected event
    sendEvent('connected', { message: 'Stream connected' });

    await handleChatStream(res, streamRequest, streamId, sendEvent, userId);

    res.end();
  } catch (error: any) {
    logger.error('Stream error', error, { service: 'stream', chatId: streamRequest.chatId });
    sendEvent('error', { 
      chatId: streamRequest.chatId,
      error: error.message || 'Unknown error occurred' 
    });
    res.end();
  }

  // Cleanup on client disconnect
  req.on('close', () => {
    logger.info('Client disconnected from stream', { service: 'stream', streamId });
    const abortController = activeStreams.get(streamId);
    if (abortController) {
      abortController.abort();
      activeStreams.delete(streamId);
    }
  });
});

/**
 * @swagger
 * /api/stream/chat/{chatId}/cancel:
 *   post:
 *     tags: [Stream]
 *     summary: Cancel active chat stream
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: number
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stream cancelled
 */
router.post('/chat/:chatId/cancel', async (req: Request, res: Response) => {
  const chatId = Number.parseInt(req.params.chatId);
  
  // Cancel all streams for this chat
  for (const [streamId, abortController] of activeStreams.entries()) {
    if (streamId.startsWith(`${chatId}-`)) {
      abortController.abort();
      activeStreams.delete(streamId);
    }
  }

  res.json({ success: true, message: 'Stream cancelled' });
});

/**
 * Main chat streaming handler
 */
async function handleChatStream(
  res: Response,
  req: ChatStreamRequest,
  streamId: string,
  sendEvent: (event: string, data: any) => void,
  userId: string | undefined
) {
  //const chatService = new ChatService();
  const aiService = AIService.instance;
  const codebaseService = new CodebaseService();
  const promptService = new PromptService();

  let abortController: AbortController | undefined;

  try {
    // STEP 1: Create abort controller
    abortController = new AbortController();
    activeStreams.set(streamId, abortController);

    // STEP 2: Load chat, app, and messages from database
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, req.chatId))
      .limit(1);

    if (!chat) {
      throw new Error(`Chat not found: ${req.chatId}`);
    }

    const [app] = await db
      .select()
      .from(apps)
      .where(eq(apps.id, chat.appId))
      .limit(1);

    if (!app) {
      throw new Error(`App not found: ${chat.appId}`);
    }

    // Get full app path once (used throughout)
    const appServiceInstance = new AppService();
    const fullAppPath = appServiceInstance.getFullAppPath(app.path);

    logger.info('App Info', {
      service: 'stream',
      chatId: req.chatId,
      appId: String(app.id),
      appName: app.name,
      appPath: app.path,
      fullAppPath
    });

    let chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, req.chatId))
      .orderBy(messages.createdAt);

    // STEP 2.2: Handle redo - delete last 2 messages
    if (req.redo && chatMessages.length >= 2) {
      const lastTwoIds = chatMessages.slice(-2).map(m => m.id);
      await db.delete(messages).where(eq(messages.id, lastTwoIds[0]));
      await db.delete(messages).where(eq(messages.id, lastTwoIds[1]));
      chatMessages = chatMessages.slice(0, -2);
    }

    // STEP 3: Process prompt
    let processedPrompt = sanitizePromptInput(req.prompt as string) || '';
    
    // If messageId is provided, fetch the message content
    if (req.messageId && !req.prompt) {
      const [userMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, req.messageId))
        .limit(1);
      
      if (userMessage) {
        processedPrompt = userMessage.content;
      }
    }

    // STEP 4: Insert user message to database only if messageId is NOT provided
    // (messageId means the message was already created by the frontend)
    let userMessage;
    if (!req.messageId) {
      const [newMessage] = await db.insert(messages).values({
        chatId: req.chatId,
        user_id: userId,
        role: 'user',
        content: processedPrompt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
     
      userMessage = newMessage;
    } else {
      // Fetch the existing message
      const [existingMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, req.messageId))
        .limit(1);
     
      userMessage = existingMessage;
    }
 
    if (userMessage) {
      chatMessages.push(userMessage);
    }
 
    // STEP 5: Send initial loading state
    sendEvent('chat:start', {
      chatId: req.chatId,
      messages: chatMessages,
    });
 

    // STEP 5.5: Send thinking indicator immediately
    sendEvent('chat:thinking', {
      chatId: req.chatId,
      message: 'Thinking...',
    });

    // STEP 6: Get AI settings from database with fallback to environment variables
    // Override with frontend selections if provided
    let aiSettings = await aiService.getSettings(userId);
    
    // If frontend provides model/mode, validate and use it
    if (req.selectedModel || req.chatMode) {
      // Validate selected model has API key configured
      if (req.selectedModel) {
        // Normalize provider ID to lowercase for lookup
        const providerIdLower = req.selectedModel.providerId.toLowerCase();
        const hasApiKey = aiSettings.apiKeys[providerIdLower];
        if (!hasApiKey) {
          throw new Error(`API key not configured for ${req.selectedModel.providerId}. Please configure it in settings or select a different model.`);
        }
        aiSettings.selectedModel = req.selectedModel;
      }
      
      // Override chat mode if provided
      if (req.chatMode) {
        aiSettings.selectedChatMode = req.chatMode;
      }
    }

    logger.info('AI settings loaded', {
      service: 'stream',
      chatId: req.chatId,
      provider: aiSettings.selectedModel.providerId,
      model: aiSettings.selectedModel.id,
      chatMode: aiSettings.selectedChatMode,
      smartContextEnabled: aiSettings.smartContextEnabled,
      turboEditsV2Enabled: aiSettings.turboEditsV2Enabled,
      overriddenByFrontend: !!(req.selectedModel || req.chatMode)
    });

    // STEP 7: Extract codebase context with Smart Context filtering
    const codebaseContext = await codebaseService.extractContext(fullAppPath, {
      contextPaths: (app.chatContext as any)?.contextPaths,
      smartContextAutoIncludes: (app.chatContext as any)?.smartContextAutoIncludes,
      excludePaths: (app.chatContext as any)?.excludePaths,
      selectedComponent: req.selectedComponent,
      // Smart Context options from settings
      enableSmartContext: aiSettings.smartContextEnabled,
      smartContextMode: 'balanced', // Default to balanced
      maxFiles: undefined, // Use default
      prompt: processedPrompt, // Pass user prompt for keyword matching
    });

    logger.info('Extracted codebase context', {
      service: 'stream',
      chatId: req.chatId,
      totalFiles: codebaseContext.totalFiles,
      totalSize: codebaseContext.totalSize
    });

    // STEP 8: Prepare AI messages
    const systemPrompt = promptService.constructSystemPrompt({
      chatMode: aiSettings.selectedChatMode,
      enableTurboEditsV2: aiSettings.turboEditsV2Enabled,
      appName: app.name,
    });

    // Build conversation history with codebase in FIRST message only (not every message)
    const aiMessages: CoreMessage[] = [];
    const maxTurns = promptService.getMaxContextTurns();
    const recentMessages = chatMessages.slice(-maxTurns);
    const isFirstMessage = chatMessages.length === 1;

    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      
      if (msg.role === 'user') {
        // Only include codebase context in the VERY FIRST user message to save tokens and speed up
        const content = (isFirstMessage && i === 0)
          ? `Here is the current codebase:\n\n${codebaseContext.formattedOutput}\n\n${msg.content}`
          : msg.content;
        
        aiMessages.push({
          role: 'user',
          content,
        });
      } else if (msg.role === 'assistant') {
        aiMessages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }

    // STEP 10-11: Stream AI response with optional model override
    let fullResponse = '';
    let hasStartedStreaming = false;
    
    for await (const chunk of aiService.streamResponse({
      messages: aiMessages,
      systemPrompt,
      abortSignal: abortController.signal,
      overrideModel: req.selectedModel, 
      user_id: userId,
    })) {
      // Clear thinking indicator on first actual chunk
      if (!hasStartedStreaming && (chunk.type === 'text-delta' || chunk.type === 'thinking')) {
        hasStartedStreaming = true;
        sendEvent('chat:thinking-done', { chatId: req.chatId });
      }
      
      if (chunk.type === 'text-delta') {
        fullResponse = chunk.fullText;
        
        // Send chunk to client
        sendEvent('chat:chunk', {
          chatId: req.chatId,
          chunk: chunk.text,
          fullText: fullResponse,
        });
      } else if (chunk.type === 'thinking' || chunk.type === 'thinking-start') {
        fullResponse = chunk.fullText;
        
        // Send thinking chunk to client
        sendEvent('chat:thinking-chunk', {
          chatId: req.chatId,
          chunk: chunk.text,
          fullText: fullResponse,
        });
      } else if (chunk.type === 'thinking-end') {
        fullResponse = chunk.fullText;
        
        sendEvent('chat:thinking-end', {
          chatId: req.chatId,
          chunk: chunk.text,
        });
      } else if (chunk.type === 'done') {
        fullResponse = chunk.fullText;
      } else if (chunk.type === 'cancelled') {
        sendEvent('chat:cancelled', { chatId: req.chatId });
        return;
      }
    }

    // STEP 14: Save AI response to database
    const [assistantMessage] = await db.insert(messages).values({
      chatId: req.chatId,
      user_id: userId,
      role: 'assistant',
      content: fullResponse,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // STEP 15: Parse and execute file operations
    const fileChanges: Array<{ path: string; type: string; content?: string; oldContent?: string }> = [];
    const dyadWriteRegex = /<dyad-write\s+path="([^"]+)"(?:\s+[^>]*)?>\s*(?:```[\w]*\s*)?([\s\S]*?)(?:```\s*)?<\/dyad-write>/g;
    const dyadRenameRegex = /<dyad-rename\s+from="([^"]+)"\s+to="([^"]+)"(?:\s+[^>]*)?\/?>/g;
    const dyadDeleteRegex = /<dyad-delete\s+path="([^"]+)"(?:\s+[^>]*)?\/?>/g;
    
    // Support both old format (|||) and new git-style format (<<<<<<< SEARCH / ======= / >>>>>>> REPLACE)
    // New format is preferred for Turbo Edits V2
    const dyadSearchReplaceRegex = /<dyad-search-replace\s+path="([^"]+)"(?:\s+[^>]*)?>\s*([\s\S]*?)\s*<\/dyad-search-replace>/g;

    logger.info('Parsing dyad tags from AI response', {
      service: 'stream',
      chatId: req.chatId,
      responseLength: fullResponse.length,
      responsePreview: fullResponse.substring(0, 500)
    });

    // Parse write operations
    let match;
    let writeCount = 0;
    while ((match = dyadWriteRegex.exec(fullResponse)) !== null) {
      const [, filePath, content] = match;
      writeCount++;
      logger.info('Write operation parsed', {
        service: 'stream',
        chatId: req.chatId,
        operation: writeCount,
        filePath,
        contentLength: content.length,
        fullAppPath
      });
      
      fileChanges.push({
        path: filePath,
        type: 'write',
        content: content.trim(),
      });
    }

    // Helper function to strip markdown code fences
    const stripCodeFences = (text: string): string => {
      let cleaned = text.trim();
      // Remove opening fence: ```typescript, ```jsx, ```javascript, ```
      cleaned = cleaned.replace(/^```[\w]*\s*\n?/, '');
      // Remove closing fence: ```
      cleaned = cleaned.replace(/\n?```\s*$/, '');
      return cleaned.trim();
    };

    // Parse search-replace operations (supports git-style format with multiple blocks)
    let searchReplaceCount = 0;
    while ((match = dyadSearchReplaceRegex.exec(fullResponse)) !== null) {
      const [, filePath, content] = match;
      
      // Parse individual SEARCH/REPLACE blocks within the content
      // Format: <<<<<<< SEARCH\n[old]\n=======\n[new]\n>>>>>>> REPLACE
      const searchReplaceBlockRegex = /<<<<<<< SEARCH\s*([\s\S]*?)\s*=======\s*([\s\S]*?)\s*>>>>>>> REPLACE/g;
      let blockMatch;
      let blocksFound = 0;
      
      while ((blockMatch = searchReplaceBlockRegex.exec(content)) !== null) {
        const [, oldContent, newContent] = blockMatch;
        blocksFound++;
        searchReplaceCount++;
        
        // Strip markdown code fences from both old and new content
        const cleanedOld = stripCodeFences(oldContent);
        const cleanedNew = stripCodeFences(newContent);
        
        logger.info('Search-Replace block parsed', {
          service: 'stream',
          chatId: req.chatId,
          operation: searchReplaceCount,
          block: blocksFound,
          filePath,
          oldPreview: cleanedOld.substring(0, 80),
          newPreview: cleanedNew.substring(0, 80)
        });
        
        fileChanges.push({
          path: filePath,
          type: 'search-replace',
          oldContent: cleanedOld,
          content: cleanedNew,
        });
      }
      
      // If no git-style blocks found, try old format (|||)
      if (blocksFound === 0) {
        const oldFormatRegex = /^\s*([\s\S]*?)\s*\|\|\|\s*([\s\S]*?)\s*$/;
        const oldFormatMatch = content.match(oldFormatRegex);
        
        if (oldFormatMatch) {
          const [, oldContent, newContent] = oldFormatMatch;
          searchReplaceCount++;
          
          const cleanedOld = stripCodeFences(oldContent);
          const cleanedNew = stripCodeFences(newContent);
          
          logger.info('Search-Replace operation parsed (old format)', {
            service: 'stream',
            chatId: req.chatId,
            operation: searchReplaceCount,
            filePath,
            oldPreview: cleanedOld.substring(0, 80),
            newPreview: cleanedNew.substring(0, 80)
          });
          
          fileChanges.push({
            path: filePath,
            type: 'search-replace',
            oldContent: cleanedOld,
            content: cleanedNew,
          });
        }
      }
    }

    // Parse rename operations
    let renameCount = 0;
    while ((match = dyadRenameRegex.exec(fullResponse)) !== null) {
      const [, fromPath, toPath] = match;
      renameCount++;
      logger.debug('Rename operation parsed', {
        service: 'stream',
        chatId: req.chatId,
        operation: renameCount,
        fromPath,
        toPath
      });
      
      fileChanges.push({
        path: fromPath,
        type: 'rename',
        content: toPath,
      });
    }

    // Parse delete operations
    let deleteCount = 0;
    while ((match = dyadDeleteRegex.exec(fullResponse)) !== null) {
      const [, filePath] = match;
      deleteCount++;
      logger.debug('Delete operation parsed', {
        service: 'stream',
        chatId: req.chatId,
        operation: deleteCount,
        filePath
      });
      
      fileChanges.push({
        path: filePath,
        type: 'delete',
      });
    }

    // Parse add-dependency operations
    const dyadAddDependencyRegex = /<dyad-add-dependency packages="([^"]+)"(?:\s*\/)?>(?:<\/dyad-add-dependency>)?/g;
    const packagesToAdd: string[] = [];
    let dependencyCount = 0;
    while ((match = dyadAddDependencyRegex.exec(fullResponse)) !== null) {
      const [, packagesStr] = match;
      dependencyCount++;
      
      // Split by spaces (not commas) as per prompt instructions
      const packages = packagesStr.trim().split(/\s+/).filter(p => p.length > 0);
      packagesToAdd.push(...packages);
      
      logger.info('Add-dependency operation parsed', {
        service: 'stream',
        chatId: req.chatId,
        operation: dependencyCount,
        packages
      });
    }

    logger.info('File operations parsed', {
      service: 'stream',
      chatId: req.chatId,
      totalOperations: fileChanges.length,
      writes: writeCount,
      searchReplaces: searchReplaceCount,
      renames: renameCount,
      deletes: deleteCount,
      dependencies: packagesToAdd.length
    });

    // Execute file operations in parallel for better performance
    if (fileChanges.length > 0) {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      
      logger.info('Executing file operations', {
        service: 'stream',
        chatId: req.chatId,
        appPath: app.path,
        fullAppPath,
        operationCount: fileChanges.length
      });
      
      // Send file operation start event
      sendEvent('file:operations-start', {
        chatId: req.chatId,
        totalOperations: fileChanges.length,
      });
      
      // Process operations in parallel batches of 5 for better performance
      const batchSize = 5;
      for (let i = 0; i < fileChanges.length; i += batchSize) {
        const batch = fileChanges.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (change, batchIndex) => {
          const operationIndex = i + batchIndex;
          
          try {
            const fullPath = path.join(fullAppPath, change.path);
            
            if (change.type === 'write') {
              const dir = path.dirname(fullPath);
              await fs.mkdir(dir, { recursive: true });
              await fs.writeFile(fullPath, change.content || '', 'utf-8');
              
              // Verify file was written
              const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
              const fileSize = fileExists ? (await fs.stat(fullPath)).size : 0;
              
              logger.info('File written', {
                service: 'stream',
                chatId: req.chatId,
                filePath: change.path,
                fullPath,
                fileExists,
                fileSize,
                contentLength: (change.content || '').length
              });
              
              // Send progress event
              sendEvent('file:operation', {
                chatId: req.chatId,
                operation: 'write',
                path: change.path,
                progress: Math.round(((operationIndex + 1) / fileChanges.length) * 100),
              });
              
            } else if (change.type === 'search-replace') {
              // Read the file, replace content, and write back
              try {
                let fileContent = await fs.readFile(fullPath, 'utf-8');
                
                if (fileContent.includes(change.oldContent || '')) {
                  fileContent = fileContent.replace(change.oldContent || '', change.content || '');
                  await fs.writeFile(fullPath, fileContent, 'utf-8');
                  logger.info('Search-Replace completed', {
                    service: 'stream',
                    chatId: req.chatId,
                    filePath: change.path,
                    fullPath
                  });
                  
                  sendEvent('file:operation', {
                    chatId: req.chatId,
                    operation: 'search-replace',
                    path: change.path,
                    progress: Math.round(((operationIndex + 1) / fileChanges.length) * 100),
                  });
                } else {
                  logger.warn('Search-Replace skipped - old content not found', {
                    service: 'stream',
                    chatId: req.chatId,
                    filePath: change.path,
                    oldContentPreview: (change.oldContent || '').substring(0, 80)
                  });
                }
              } catch (readError: any) {
                if (readError.code === 'ENOENT') {
                  logger.error('File not found for search-replace', readError, {
                    service: 'stream',
                    chatId: req.chatId,
                    filePath: change.path
                  });
                } else {
                  throw readError;
                }
              }
              
            } else if (change.type === 'rename' && change.content) {
              const newPath = path.join(fullAppPath, change.content);
              const newDir = path.dirname(newPath);
              await fs.mkdir(newDir, { recursive: true });
              await fs.rename(fullPath, newPath);
              logger.info('File renamed', {
                service: 'stream',
                chatId: req.chatId,
                fromPath: change.path,
                toPath: change.content,
                fullFromPath: fullPath,
                fullToPath: newPath
              });
              
              sendEvent('file:operation', {
                chatId: req.chatId,
                operation: 'rename',
                path: change.path,
                progress: Math.round(((operationIndex + 1) / fileChanges.length) * 100),
              });
              
            } else if (change.type === 'delete') {
              await fs.unlink(fullPath);
              logger.info('File deleted', {
                service: 'stream',
                chatId: req.chatId,
                filePath: change.path,
                fullPath
              });
              
              sendEvent('file:operation', {
                chatId: req.chatId,
                operation: 'delete',
                path: change.path,
                progress: Math.round(((operationIndex + 1) / fileChanges.length) * 100),
              });
            }
          } catch (error: any) {
            logger.error(`Failed to ${change.type} file`, error, {
              service: 'stream',
              chatId: req.chatId,
              operation: change.type,
              filePath: change.path,
              attemptedPath: path.join(fullAppPath, change.path)
            });
          }
        }));
      }
      
      // Send file operations complete event
      sendEvent('file:operations-complete', {
        chatId: req.chatId,
        totalOperations: fileChanges.length,
      });

      // STEP 17.5: Handle dependency additions by updating package.json
      // STEP 17.5: Install dependencies directly using pnpm add
      if (packagesToAdd.length > 0) {
        logger.info('Installing dependencies', {
          service: 'stream',
          chatId: req.chatId,
          packages: packagesToAdd
        });

        try {
          sendEvent('dependencies:installing', {
            chatId: req.chatId,
            packages: packagesToAdd,
            message: `Installing ${packagesToAdd.length} package${packagesToAdd.length > 1 ? 's' : ''}...`
          });

          // Check if containerization is enabled
          const { ContainerizationService } = await import('../services/containerization_service');
          const containerService = ContainerizationService.getInstance();
          
          if (containerService.isEnabled()) {
            // Install in container using pnpm add (installs latest version and updates package.json)
            const isRunning = await containerService.isContainerRunning(app.id.toString());
            
            if (isRunning) {
              // Container is running - install packages directly
              const packagesStr = packagesToAdd.join(' ');
              const installResult = await containerService.execInContainer(
                app.id.toString(),
                ['sh', '-c', `cd /app && pnpm add ${packagesStr}`]
              );

              if (!installResult.success) {
                throw new Error(installResult.error || 'Failed to install dependencies');
              }

              logger.info('Dependencies installed successfully in container', {
                service: 'stream',
                chatId: req.chatId,
                appId: String(app.id),
                packages: packagesToAdd
              });
            } else {
              // Container not running - install locally then start container
              logger.info('Container not running, installing dependencies locally', {
                service: 'stream',
                chatId: req.chatId,
                packages: packagesToAdd
              });
              
              const { spawn } = await import('node:child_process');
              const { detectPackageManager } = await import('../utils/app_commands');
              
              const packageManager = detectPackageManager(fullAppPath);
              const installCmd = packageManager === 'pnpm' ? 'pnpm' : packageManager === 'yarn' ? 'yarn' : 'npm';
              const installArgs = packageManager === 'pnpm' ? ['add', ...packagesToAdd] : 
                                 packageManager === 'yarn' ? ['add', ...packagesToAdd] :
                                 ['install', ...packagesToAdd];

              await new Promise<void>((resolve, reject) => {
                const proc = spawn(installCmd, installArgs, { cwd: fullAppPath });
                let output = '';
                
                proc.stdout.on('data', (data) => { output += data.toString(); });
                proc.stderr.on('data', (data) => { output += data.toString(); });
                
                proc.on('close', (code) => {
                  if (code === 0) {
                    logger.info('Dependencies installed locally (container not running)', {
                      service: 'stream',
                      chatId: req.chatId,
                      packages: packagesToAdd,
                      packageManager
                    });
                    resolve();
                  } else {
                    reject(new Error(`Install failed with code ${code}: ${output}`));
                  }
                });
              });
            }
          } else {
            // Local mode - install using local pnpm
            const { spawn } = await import('node:child_process');
            const { detectPackageManager } = await import('../utils/app_commands');
            
            const packageManager = detectPackageManager(fullAppPath);
            const installCmd = packageManager === 'pnpm' ? 'pnpm' : packageManager === 'yarn' ? 'yarn' : 'npm';
            const installArgs = packageManager === 'pnpm' ? ['add', ...packagesToAdd] : 
                               packageManager === 'yarn' ? ['add', ...packagesToAdd] :
                               ['install', ...packagesToAdd];

            await new Promise<void>((resolve, reject) => {
              const proc = spawn(installCmd, installArgs, { cwd: fullAppPath });
              let output = '';
              
              proc.stdout.on('data', (data) => { output += data.toString(); });
              proc.stderr.on('data', (data) => { output += data.toString(); });
              
              proc.on('close', (code) => {
                if (code === 0) {
                  logger.info('Dependencies installed locally', {
                    service: 'stream',
                    chatId: req.chatId,
                    packages: packagesToAdd,
                    packageManager
                  });
                  resolve();
                } else {
                  reject(new Error(`Install failed with code ${code}: ${output}`));
                }
              });
            });
          }

          sendEvent('dependencies:installed', {
            chatId: req.chatId,
            packages: packagesToAdd,
            message: `Installed ${packagesToAdd.length} package${packagesToAdd.length > 1 ? 's' : ''}`
          });
        } catch (error: any) {
          logger.error('Failed to install dependencies', error, {
            service: 'stream',
            chatId: req.chatId,
            packages: packagesToAdd
          });

          sendEvent('error', {
            chatId: req.chatId,
            error: `Failed to install dependencies: ${error.message}`
          });
        }
      }

      // STEP 18: Restart container after files are updated
      const { ContainerizationService } = await import('../services/containerization_service');
      const containerService = ContainerizationService.getInstance();
      
      if (containerService.isEnabled()) {
        const engineType = containerService.getEngineType();
        logger.info('Containerization enabled, syncing files to container', {
          service: 'stream',
          chatId: req.chatId,
          appId: String(app.id),
          engine: engineType,
          filesChanged: fileChanges.length
        });
        
        try {
          // Check if already running
          const isRunning = await containerService.isContainerRunning(app.id.toString());
          
          if (isRunning) {
            // Container is running - sync files instead of restart
            logger.info('Syncing files to running container', {
              service: 'stream',
              chatId: req.chatId,
              appId: String(app.id)
            });

            sendEvent('container:sync-start', {
              chatId: req.chatId,
              appId: app.id,
              message: 'Syncing updated files...',
            });

            // Check if package.json changed (dependencies are already installed in STEP 17.5)
            let needsInstall = false;
            for (const change of fileChanges) {
              if (change.path === 'package.json' && change.type === 'write') {
                needsInstall = hasPackageJsonChanged(fullAppPath, change.content || '');
                break;
              }
            }

            // Collect all modified file paths for container sync
            const modifiedFiles = fileChanges
              .filter(change => change.type === 'write' || change.type === 'search-replace')
              .map(change => change.path);

            // Touch files in container to trigger Vite HMR
            if (modifiedFiles.length > 0) {
              logger.info('Triggering hot-reload for modified files', {
                service: 'stream',
                chatId: req.chatId,
                appId: String(app.id),
                fileCount: modifiedFiles.length
              });

              await containerService.syncFilesToContainer({
                appId: app.id.toString(),
                filePaths: modifiedFiles
              });
            }

            // Files sync automatically via volume mount
            // Just need to trigger dependency install if package.json changed
            if (needsInstall) {
              logger.info('Dependencies changed, running install', {
                service: 'stream',
                chatId: req.chatId,
                appId: String(app.id)
              });

              sendEvent('container:installing', {
                chatId: req.chatId,
                appId: app.id,
                message: 'Installing new dependencies...',
              });

              // Run install command in container
              const installResult = await containerService.execInContainer(
                app.id.toString(),
                ['sh', '-c', 'cd /app && pnpm install --no-frozen-lockfile']
              );

              if (!installResult.success) {
                throw new Error(installResult.error || 'Failed to install dependencies');
              }

              logger.info('Dependencies installed successfully', {
                service: 'stream',
                chatId: req.chatId,
                appId: String(app.id)
              });
            }

            sendEvent('container:sync-complete', {
              chatId: req.chatId,
              appId: app.id,
              message: needsInstall ? 'Files synced and dependencies installed' : 'Files synced (Vite hot-reload active)',
              success: true,
            });

          } else {
            // Container not running - start it with current files
            logger.info('Starting container with app files', {
              service: 'stream',
              chatId: req.chatId,
              appId: String(app.id)
            });

            sendEvent('container:starting', {
              chatId: req.chatId,
              appId: app.id,
              message: 'Starting container...',
            });

            // Allocate unique port for this container
            const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
            const lifecycleService = ContainerLifecycleService.getInstance();
            const port = await lifecycleService.allocatePort(app.id.toString());

            // Start app in container with updated code
            const result = await containerService.runContainer({
              appId: app.id.toString(),
              appPath: fullAppPath,
              port: port,
            });

            if (result.success) {
              logger.info('Container started successfully', {
                service: 'stream',
                chatId: req.chatId,
                appId: String(app.id),
                port: port,
                url: `http://localhost:${port}`
              });
              
              sendEvent('container:ready', {
                chatId: req.chatId,
                appId: app.id,
                port: port,
                url: `http://localhost:${port}`,
                message: 'Container is running',
                success: true,
              });
            } else {
              throw new Error(result.error || 'Failed to start container');
            }
          }

        } catch (containerError: any) {
          logger.error('Container operation failed', containerError, {
            service: 'stream',
            chatId: req.chatId,
            appId: String(app.id)
          });
          sendEvent('container:error', {
            chatId: req.chatId,
            appId: app.id,
            error: containerError.message,
            success: false,
          });
        }
      } else {
        logger.warn('Containerization is disabled', {
          service: 'stream',
          chatId: req.chatId,
          message: 'Set CONTAINERIZATION_ENABLED=true to run apps in containers'
        });
      }
    }

    // STEP 19: Send completion
    sendEvent('chat:complete', {
      chatId: req.chatId,
      assistantMessageId: assistantMessage.id,
      fullText: fullResponse,
      fileChanges: fileChanges,
    });

  } catch (error: any) {
    logger.error('Chat stream error', error, {
      service: 'stream',
      chatId: req.chatId
    });
    
    sendEvent('chat:error', {
      chatId: req.chatId,
      error: error.message || 'Unknown error occurred'
    });
  } finally {
    // Cleanup
    if (abortController) {
      activeStreams.delete(streamId);
    }
  }
}

export default router;
