import { db } from '../db';
import { settings, languageModelProviders,
  languageModels,} from '../db/schema';
import { eq, ilike } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler';
import { SettingsService } from '../services/settings_service';
const settingsService = new SettingsService();
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
  selectedChatMode: 'auto-code' | 'agent' | 'ask' | 'custom';
  smartContextEnabled: boolean;
  turboEditsV2Enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProvidersService {
 
 /**
   * Create  provider
   */
async createProvider(data: {
  name: string;
  apiBaseUrl: string;
  envVarName?: string;
}) {
  try {
    const cleanedName = data.name.trim();

    // Case-insensitive check
    const exists = await db
      .select()
      .from(languageModelProviders)
      .where(ilike(languageModelProviders.name, cleanedName));

    if (exists.length > 0) {
      return {
        success: true,
        message: `Provider '${cleanedName}' already exists`,
        provider: exists[0],
        isNew: false,
      };
    }

    // Create new provider
    const [provider] = await db
      .insert(languageModelProviders)
      .values({
        name: cleanedName,
        apiBaseUrl: data.apiBaseUrl,
        envVarName: data.envVarName ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      message: `Provider '${cleanedName}' created successfully`,
      provider,
      isNew: true,
    };

  } catch (err: any) {
    throw new AppError(
      500,
      `Failed to create provider: ${err?.message || String(err)}`
    );
  }
}

  /**
   * Create  model
   */
  async createModel(providerId: number, data: {
  displayName: string;
  apiName: string;
  description?: string;
  maxOutputTokens?: number;
  contextWindow?: number;
  approved?: boolean;
}) {
  try {
    // Check if model exists
    const exists = await db
      .select()
      .from(languageModels)
      .where(eq(languageModels.apiName, data.apiName));

    if (exists.length > 0) {
      return {
        message: "Model already exists",
        model: exists[0],
      };
    }

    // Insert new model
    const [model] = await db
      .insert(languageModels)
      .values({
        displayName: data.displayName,
        apiName: data.apiName,
        description: data.description ?? null,
        maxOutputTokens: data.maxOutputTokens ?? null,
        contextWindow: data.contextWindow ?? null,
        approved: data.approved ?? true,
        customProviderId: providerId,
        builtinProviderId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      message: "Model created successfully",
      model,
    };
  } catch (err: any) {
    throw new AppError(
      500,
      `Failed to create model: ${err?.message || String(err)}`
    );
  }
}

async updateModel(id: number, data: any) {
  try {
    // Find existing model
    const [existing] = await db
      .select()
      .from(languageModels)
      .where(eq(languageModels.id, id));

    if (!existing) {
      throw new AppError(404, "Model not found");
    }

    // Validate providerId if updating provider
    let newProviderId = existing.customProviderId;

    if (data.customProviderId !== undefined) {
      const providerExists = await db
        .select()
        .from(languageModelProviders)
        .where(eq(languageModelProviders.id, data.customProviderId));

      if (providerExists.length === 0) {
        throw new AppError(
          400,
          `Provider with id ${data.customProviderId} does not exist`
        );
      }

      newProviderId = data.customProviderId; // valid ID
    }

    const [updated] = await db
      .update(languageModels)
      .set({
        displayName: data.displayName ?? existing.displayName,
        apiName: data.apiName ?? existing.apiName,
        description: data.description ?? existing.description,
        maxOutputTokens: data.maxOutputTokens ?? existing.maxOutputTokens,
        contextWindow: data.contextWindow ?? existing.contextWindow,
        builtinProviderId: data.builtinProviderId ?? existing.builtinProviderId,
        customProviderId: newProviderId, // SAFE
        approved: data.approved ?? existing.approved,
        updatedAt: new Date()
      })
      .where(eq(languageModels.id, id))
      .returning();

    return updated;
  } catch (err: any) {
    throw new AppError(
      500,
      `Failed to update model: ${err?.message || String(err)}`
    );
  }
}


  /**
   * Delete available AI models by provider
   */
async deleteProviderOrModel(data: { providerId?: number; modelId?: number }) {
  try {
    // If providerId is given → delete provider + models
    if (data.providerId) {
      const providerId = data.providerId;

      // Check provider exists
      const [provider] = await db
        .select()
        .from(languageModelProviders)
        .where(eq(languageModelProviders.id, providerId));

      if (!provider) {
        throw new AppError(404, `Provider with id ${providerId} not found`);
      }

      // Delete all models for this provider
      await db
        .delete(languageModels)
        .where(eq(languageModels.customProviderId, providerId));

      //delete api key from setting for the provider 
      await settingsService.deleteApiKey( provider.name);

      // Delete provider
      const [deletedProvider] = await db
        .delete(languageModelProviders)
        .where(eq(languageModelProviders.id, providerId))
        .returning();

      return {
        provider: deletedProvider,
        modelsDeleted: true,
      };
    }

    // If only modelId is given → delete model
    if (data.modelId) {
      const modelId = data.modelId;

      const [model] = await db
        .select()
        .from(languageModels)
        .where(eq(languageModels.id, modelId));

      if (!model) {
        throw new AppError(404, `Model with id ${modelId} not found`);
      }

      const [deletedModel] = await db
        .delete(languageModels)
        .where(eq(languageModels.id, modelId))
        .returning();

      return {
        model: deletedModel,
      };
    }

    throw new AppError(400, "providerId or modelId is required");
  } catch (err: any) {
    throw new AppError(500, `Failed to delete: ${err?.message || String(err)}`);
  }
}


  /**
   * Get list of available AI models by provider
   */
 async getAvailableModels() {
  try {
    const providers = await db.select().from(languageModelProviders);
    const models = await db.select().from(languageModels);

    const result: Record<string, any> = {};

    for (const provider of providers) {
      result[provider.name] = {
        id: provider.id,
        name: provider.name,
        apiBaseUrl: provider.apiBaseUrl,
        envVarName: provider.envVarName,
        models: models
          .filter(m => m.customProviderId === provider.id)
          .map(m => ({
            id: m.id,                       // <-- numeric DB ID
            apiName: m.apiName,             // keep API name
            displayName: m.displayName,            // display label
            description: m.description,
            maxOutputTokens: m.maxOutputTokens,
            contextWindow: m.contextWindow,
            builtinProviderId: m.builtinProviderId,
            customProviderId: m.customProviderId,
            approved: m.approved,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          })),
      };
    }

    return result;
  } catch (err: any) {
    throw new AppError(500, `Failed to fetch models: ${err?.message || String(err)}`);
  }
}

  async getAllProviders() {
  try {
    const providers = await db
      .select()
      .from(languageModelProviders);

    return providers;
  } catch (err: any) {
    throw new AppError(
      500,
      `Failed to fetch providers: ${err?.message || String(err)}`
    );
  }
}

  async getModelsByProviderId(providerId: number) {
  try {
    // Check if provider exists
    const provider = await db
      .select()
      .from(languageModelProviders)
      .where(eq(languageModelProviders.id, providerId));

    if (provider.length === 0) {
      throw new AppError(404, "Provider not found");
    }

    // Fetch models for this provider
    const models = await db
      .select()
      .from(languageModels)
      .where(eq(languageModels.customProviderId, providerId));

    return {
      provider: provider[0],
      models,
    };
  } catch (err: any) {
    throw new AppError(
      500,
      `Failed to fetch models: ${err?.message || String(err)}`
    );
  }
}

async getAllModels() {
  try {
    const models = await db
      .select()
      .from(languageModels);

    return models;
  } catch (err: any) {
    throw new AppError(
      500,
      `Failed to fetch models: ${err?.message || String(err)}`
    );
  }
}

async updateProvider(id: number, data: any) {
  try {
    // Check if provider exists
    const [existing] = await db
      .select()
      .from(languageModelProviders)
      .where(eq(languageModelProviders.id, id));

    if (!existing) {
      throw new AppError(404, "Provider not found");
    }

    // Update provider
    const [updated] = await db
      .update(languageModelProviders)
      .set({
        name: data.name ?? existing.name,
        apiBaseUrl: data.apiBaseUrl ?? existing.apiBaseUrl,
        envVarName: data.envVarName ?? existing.envVarName,
        updatedAt: new Date(),
      })
      .where(eq(languageModelProviders.id, id))
      .returning();

    return updated;
  } catch (err: any) {
    throw new AppError(
      500,
      `Failed to update provider: ${err?.message || String(err)}`
    );
  }
}


}