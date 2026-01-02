import { db } from '../db';
import { settings, languageModelProviders,
  languageModels,} from '../db/schema';
import { eq, ilike } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler';
import { encryptApiKey, decryptApiKey } from '../utils/crypto';
import { AIService } from '../services/ai_service';
/**
 * Settings Service - Manages user settings and AI configuration
 */

export interface SelectedModel {
  id: string;
  name: string;
  providerId: string;
}

export interface UserSettings {
  id: number;
  userId: string;
  selectedModel: SelectedModel;
  apiKeys: Record<string, string>;
  apiEndpoint?: string;
  selectedChatMode: 'auto-code' | 'agent' | 'ask' | 'custom';
  smartContextEnabled: boolean;
  turboEditsV2Enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SettingsService {
  /**
   * Get or create default settings for user
   */
  async getSettings(userId: string = 'default'): Promise<UserSettings> {
    try {
      userId = "default";
      const [existingSettings] = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId))
        .limit(1);
      if (existingSettings) {
        // Decrypt all API keys before returning
        const decryptedKeys: Record<string, string> = {};
        const keys = (existingSettings.apiKeys as Record<string, string>) || {};
        for (const [provider, value] of Object.entries(keys)) {
          if (!value) {
            decryptedKeys[provider] = '';
          } else {
            // Check if the value is in encrypted format (iv:encrypted:authTag)
            const isEncrypted = value.split(':').length === 3;
            try {
              decryptedKeys[provider] = isEncrypted ? decryptApiKey(value) : value;
            } catch (error) {
              // If decryption fails, assume it's plain text (for backward compatibility)
              decryptedKeys[provider] = value;
            }
          }
        }

        // Fetch API endpoint from languageModelProviders table based on selected model's provider
        const selectedModel = existingSettings.selectedModel as SelectedModel;
        let apiEndpoint: string | undefined = undefined;
        
        if (selectedModel && selectedModel.providerId) {
          const [provider] = await db
            .select()
            .from(languageModelProviders)
            .where(eq(languageModelProviders.name, selectedModel.providerId.toLowerCase()))
            .limit(1);
          
          if (provider) {
            apiEndpoint = provider.apiBaseUrl;
          }
        }

        return {
          ...existingSettings,
          selectedModel: existingSettings.selectedModel as SelectedModel,
          apiKeys: decryptedKeys,
          apiEndpoint,
          selectedChatMode: existingSettings.selectedChatMode as 'auto-code' | 'agent' | 'ask' | 'custom',
        };
      }

      // Create default settings if none exist
      const defaultModel: SelectedModel = {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        providerId: 'google',
      };

      const [newSettings] = await db.insert(settings).values({
        userId,
        selectedModel: defaultModel as any,
        apiKeys: {},
        apiEndpoint: null,
        selectedChatMode: 'auto-code',
        smartContextEnabled: false,
        turboEditsV2Enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return {
        ...newSettings,
        selectedModel: newSettings.selectedModel as SelectedModel,
        apiKeys: (newSettings.apiKeys as Record<string, string>) || {},
        apiEndpoint: newSettings.apiEndpoint || undefined,
        selectedChatMode: newSettings.selectedChatMode as 'auto-code' | 'agent' | 'ask' | 'custom',
      };
    } catch (error: any) {
      throw new AppError(500, `Failed to get settings: ${error?.message || String(error)}`);
    }
  }

  /**
   * Update settings
   */
  async updateSettings(
    updates: Partial<{
      selectedModel: SelectedModel;
      apiKeys: Record<string, string>;
      apiEndpoint: string;
      selectedChatMode: string;
      smartContextEnabled: boolean;
      turboEditsV2Enabled: boolean;
    }>,
    userId: string = 'default'
  ): Promise<UserSettings> {
    try {
      // Ensure settings exist
      await this.getSettings(userId);
      userId = "default";
      const [updated] = await db
        .update(settings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(settings.userId, userId))
        .returning();

      if (!updated) {
        throw new AppError(404, 'Settings not found');
      }
      const aiService = AIService.instance;
      aiService.clearCache();
      return {
        ...updated,
        selectedModel: updated.selectedModel as SelectedModel,
        apiKeys: (updated.apiKeys as Record<string, string>) || {},
        apiEndpoint: updated.apiEndpoint || undefined,
        selectedChatMode: updated.selectedChatMode as 'auto-code' | 'agent' | 'ask' | 'custom',
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update settings: ${error?.message || String(error)}`);
    }
  }

  /**
   * Update API key for a specific provider
   */
  async updateApiKey(userId: string = 'default',providerId: string, apiKey: string): Promise<UserSettings> {
    try {
      const currentSettings = await this.getSettings(userId);
      const updatedKeys = Object.entries(currentSettings.apiKeys).reduce((encryptedKeys, [provider, key]) => {
        encryptedKeys[provider] = encryptApiKey(key);
        return encryptedKeys;
      }, {} as Record<string, string>);

      updatedKeys[providerId] = encryptApiKey(apiKey);
      const result = await this.updateSettings({ apiKeys: updatedKeys }, userId);
      const aiService = AIService.instance;
      aiService.clearCache();
      return result;
      
    } catch (error: any) {
      throw new AppError(500, `Failed to update API key: ${error?.message || String(error)}`);
    }
  }
  /**
   * Delete API key for a specific provider name 
   */
  async deleteApiKey(providerId: string, userId: string = 'default'): Promise<UserSettings> {
    try {
      const currentSettings = await this.getSettings(userId);

      const updatedKeys = Object.entries(currentSettings.apiKeys).reduce((encryptedKeys, [provider, key]) => {
        encryptedKeys[provider] = encryptApiKey(key);
        return encryptedKeys;
      }, {} as Record<string, string>);

      delete updatedKeys[providerId];

      console.log('Updated Keys after deletion:', updatedKeys);

      const result = await this.updateSettings({ apiKeys: updatedKeys }, userId);
      const aiService = AIService.instance;
      aiService.clearCache();
      return result;
    } catch (error: any) {
      throw new AppError(500, `Failed to delete API key: ${error?.message || String(error)}`);
    }
  }

  /**
   * Get list of available AI models by provider
   */
  
 async getAvailableModels() {
    try {
      const providers = await db.select().from(languageModelProviders);
      const models = await db.select().from(languageModels);

      const result: Record<string, Array<{ id: string; name: string }>> = {};

      for (const provider of providers) {
        result[provider.name] = models
          .filter(m => m.customProviderId === provider.id)
          .map(m => ({
            id: m.apiName,
          name: m.displayName,
          description: m.description,
          maxOutputTokens: m.maxOutputTokens,
          contextWindow: m.contextWindow,
          builtinProviderId: m.builtinProviderId,
          customProviderId: m.customProviderId,
          approved: m.approved,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          }));
      }

      return result;
    } catch (err: any) {
      throw new AppError(500, `Failed to fetch models: ${err?.message || String(err)}`);
    }
  }
}


