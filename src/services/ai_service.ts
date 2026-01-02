import { streamText, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { AppError } from '../middleware/errorHandler';
import { SettingsService } from './settings_service';
import { logger } from '../utils/logger';

/**
 * AI Service - Handles LLM provider configuration and streaming
 * Migrated from src/ipc/utils/get_model_client.ts
 */

export interface AISettings {
  selectedModel: {
    id: string;
    name: string;
    providerId: string;
  };
  apiKeys: Record<string, string>;
  apiEndpoint?: string;
  selectedChatMode: 'auto-code' | 'agent' | 'ask' | 'custom';
  smartContextEnabled: boolean;
  turboEditsV2Enabled: boolean;
}

export interface StreamOptions {
  messages: CoreMessage[];
  systemPrompt: string;
  abortSignal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  overrideModel?: {
    id: string;
    name: string;
    providerId: string;
  };
  user_id?: string;
}

export class AIService {
  private static _instance: AIService;
  private settingsCache: AISettings | null = null;
  private readonly settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  static get instance(): AIService {
    if (!this._instance) this._instance = new AIService();
    return this._instance;
  }

  /**
   * Get user settings from database with fallback to environment variables
   */
  async getSettings(userId: string | undefined): Promise<AISettings> {
    if (this.settingsCache) return this.settingsCache;

    try {
      const dbSettings = await this.settingsService.getSettings(userId);
      // Use database API keys, fall back to environment variables only if not present in DB
      const apiKeys = { ...dbSettings.apiKeys };
      // Only use env vars as fallback if key is not in database
      if (!apiKeys['openai'] && process.env.OPENAI_API_KEY) {
        apiKeys['openai'] = process.env.OPENAI_API_KEY;
      }
      if (!apiKeys['anthropic'] && process.env.ANTHROPIC_API_KEY) {
        apiKeys['anthropic'] = process.env.ANTHROPIC_API_KEY;
      }
      if (!apiKeys['google'] && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        apiKeys['google'] = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      }

      // Get custom API endpoint from settings or environment
      const apiEndpoint = dbSettings.apiEndpoint || process.env.CUSTOM_API_ENDPOINT;

      this.settingsCache = {
        selectedModel: dbSettings.selectedModel,
        apiKeys,
        apiEndpoint,
        selectedChatMode: dbSettings.selectedChatMode,
        smartContextEnabled: dbSettings.smartContextEnabled,
        turboEditsV2Enabled: dbSettings.turboEditsV2Enabled,
      };

      return this.settingsCache;
    } catch (error: any) {
      // Fallback to environment variables only if database fails
      logger.warn('Failed to load settings from database, using environment variables', { 
        service: 'ai', 
        error: error?.message 
      });
      
      const openaiKey = process.env.OPENAI_API_KEY || '';
      const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
      const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

      if (!openaiKey && !anthropicKey && !googleKey) {
        throw new AppError(500, 'No API keys configured. Set API keys via /api/settings or environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY).');
      }

      // Use DEFAULT_AI_MODEL from env if set, otherwise fallback to old logic
      let defaultProvider = 'openai';
      let defaultModel = 'gpt-4o';
      let defaultChatMode = 'auto-code';

      if (process.env.DEFAULT_AI_MODEL) {
        const [provider, model] = process.env.DEFAULT_AI_MODEL.split(':');
        if (provider && model) {
          defaultProvider = provider;
          defaultModel = model;
          logger.info('Using DEFAULT_AI_MODEL from env', { service: 'ai', provider, model });
        }
      } else {
        // Fallback to old logic if DEFAULT_AI_MODEL not set
        defaultProvider = openaiKey ? 'openai' : (googleKey ? 'google' : 'anthropic');
        defaultModel = openaiKey ? 'gpt-4o' : (googleKey ? 'gemini-2.0-flash-exp' : 'claude-3-5-sonnet-20241022');
      }

      if (process.env.DEFAULT_CHAT_MODE) {
        defaultChatMode = process.env.DEFAULT_CHAT_MODE as any;
      }

      this.settingsCache = {
        selectedModel: {
          id: defaultModel,
          name: defaultModel,
          providerId: defaultProvider,
        },
        apiKeys: {
          'openai': openaiKey,
          'anthropic': anthropicKey,
          'google': googleKey,
        },
        apiEndpoint: process.env.CUSTOM_API_ENDPOINT,
        selectedChatMode: defaultChatMode as any,
        smartContextEnabled: false,
        turboEditsV2Enabled: false,
      };

      return this.settingsCache;
    }
  }

  /**
   * Clear settings cache (call when settings are updated)
   */
  clearCache() {
    this.settingsCache = null;
  }

  /**
   * Get configured AI model client based on provider
   * @param overrideModel Optional model to use instead of settings
   */
  async getModelClient(overrideModel?: { id: string; name: string; providerId: string }, userId?: string) {
    const settings = await this.getSettings(userId);
    let { selectedModel, apiKeys } = settings;
    
    // Use override model if provided
    if (overrideModel) {
      selectedModel = overrideModel;
    }
    
    let { providerId, id: modelId } = selectedModel;
    
    // Normalize provider ID to lowercase for case-insensitive matching
    providerId = providerId.toLowerCase();

    // Check if API key is configured for selected model
    let apiKey = apiKeys[providerId];
    
    // If API key not configured, try fallback model
    if (!apiKey && process.env.FALLBACK_AI_MODEL) {
      const [fallbackProvider, fallbackModel] = process.env.FALLBACK_AI_MODEL.split(':');
      const fallbackApiKey = apiKeys[fallbackProvider];
      
      if (fallbackApiKey) {
        logger.warn('Selected model API key not configured, using fallback model', {
          service: 'ai',
          requestedProvider: providerId,
          requestedModel: modelId,
          fallbackProvider,
          fallbackModel
        });
        
        providerId = fallbackProvider;
        modelId = fallbackModel;
        apiKey = fallbackApiKey;
      }
    }
    
    if (!apiKey) {
      throw new AppError(400, `API key not configured for provider: ${providerId}. Please configure API key in settings or set ${providerId.toUpperCase()}_API_KEY environment variable.`);
    }

    switch (providerId) {
      case 'openai': {
        const openai = createOpenAI({ apiKey });
        return openai(modelId);
      }

      case 'anthropic': {
        const anthropicConfig: any = { apiKey };
        
        // Add custom endpoint if configured (e.g., Azure Foundry)
        if (settings.apiEndpoint) {
          anthropicConfig.baseURL = settings.apiEndpoint;
        }
        
        const anthropic = createAnthropic(anthropicConfig);
        return anthropic(modelId);
      }

      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey });
        return google(modelId);
      }

      // Add more providers as needed
      // case 'azure':
      // case 'bedrock':

      default:
        throw new AppError(400, `Unsupported AI provider: ${providerId}`);
    }
  }

  /**
   * Stream AI response
   */
  async *streamResponse(options: StreamOptions) {
    const startTime = Date.now();
    let requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    try {
      const model = await this.getModelClient(options.overrideModel, options.user_id);
      const settings = await this.getSettings(options.user_id);
      
      // Use override model for logging if provided
      const activeModel = options.overrideModel || settings.selectedModel;

      // Log AI request
      logger.info('AI Request', {
        service: 'ai',
        requestId,
        provider: activeModel.providerId,
        model: activeModel.id,
        modelName: activeModel.name,
        chatMode: settings.selectedChatMode,
        messageCount: options.messages.length,
        systemPromptLength: options.systemPrompt.length,
        temperature: options.temperature || 0.7,
        lastUserMessage: options.messages.filter(m => m.role === 'user').slice(-1)[0]?.content?.toString()
      });

      const { fullStream } = await streamText({
        model,
        system: options.systemPrompt,
        messages: options.messages,
        maxRetries: 2,
        temperature: options.temperature || 0.7,
        abortSignal: options.abortSignal,
      });

      let fullResponse = '';
      let chunkCount = 0;
      let inThinkingBlock = false;

      for await (const part of fullStream) {
        let chunk = '';
        
        // Close thinking block if we transition out of reasoning
        if (inThinkingBlock && !['reasoning-delta', 'reasoning-end', 'reasoning-start'].includes(part.type)) {
          chunk = '</think>';
          inThinkingBlock = false;
        }
        
        switch (part.type) {
          case 'text-delta':
            chunkCount++;
            chunk += part.text;
            fullResponse += part.text;
            
            // Log every chunk with full content
            // logger.info('AI Chunk', {
            //   service: 'ai',
            //   requestId,
            //   chunkNumber: chunkCount,
            //   chunkText: part.text,
            //   chunkLength: part.text.length,
            //   totalLength: fullResponse.length,
            //   fullResponseSoFar: fullResponse
            // });
            
            yield {
              type: 'text-delta' as const,
              text: chunk,
              fullText: fullResponse,
            };
            break;

          case 'reasoning-delta':
            // Start thinking block if not already in one
            if (!inThinkingBlock) {
              chunk = '<think>';
              inThinkingBlock = true;
            }
            chunk += part.text;
            fullResponse += part.text;
            
            yield {
              type: 'thinking' as const,
              text: chunk,
              fullText: fullResponse,
            };
            break;

          case 'reasoning-start':
            chunk = '<think>';
            inThinkingBlock = true;
            fullResponse += chunk;
            
            yield {
              type: 'thinking-start' as const,
              text: chunk,
              fullText: fullResponse,
            };
            break;

          case 'reasoning-end':
            chunk = '</think>';
            inThinkingBlock = false;
            fullResponse += chunk;
            
            yield {
              type: 'thinking-end' as const,
              text: chunk,
              fullText: fullResponse,
            };
            break;

          case 'error':
            logger.error('AI Stream Error', part.error as Error, { service: 'ai', requestId });
            throw new Error(String((part.error as any)?.message || part.error));
        }
      }

      const duration = Date.now() - startTime;
      
      // Log completion with full response
      logger.info('AI Response Complete', {
        service: 'ai',
        requestId,
        duration: `${duration}ms`,
        totalChunks: chunkCount,
        responseLength: fullResponse.length,
        avgChunkSize: Math.round(fullResponse.length / chunkCount),
        tokensPerSecond: Math.round((fullResponse.length / 4) / (duration / 1000)),
        fullResponse: fullResponse
      });

      yield {
        type: 'done' as const,
        fullText: fullResponse,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error?.name === 'AbortError') {
        logger.info('AI Request Cancelled', {
          service: 'ai',
          requestId,
          duration: `${duration}ms`,
          reason: 'User aborted'
        });
        yield { type: 'cancelled' as const };
      } else {
        logger.error('AI Request Failed', error, {
          service: 'ai',
          requestId,
          duration: `${duration}ms`
        });
        throw new AppError(500, `AI streaming error: ${error?.message || String(error)}`);
      }
    }
  }
}
