import { ProvidersService } from "../../src/services/providers_service";
import { languageModelProviders, languageModels } from "../../src/db/schema";
import { AppError } from "../../src/middleware/errorHandler";

jest.mock("../../src/db");

import { db } from "../../src/db";

describe("ProvidersService", () => {
  let service: ProvidersService;

  const mockProvider = {
    id: 1,
    name: "OpenAI",
    apiBaseUrl: "https://api.openai.com/v1",
    envVarName: "OPENAI_API_KEY",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockModel = {
    id: 1,
    displayName: "GPT-4",
    apiName: "gpt-4",
    description: "OpenAI's GPT-4 model",
    maxOutputTokens: 8192,
    contextWindow: 8192,
    approved: true,
    customProviderId: 1,
    builtinProviderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProvidersService();

    // Setup default mock implementations
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    const mockInsert = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    const mockUpdate = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    const mockDelete = {
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    (db.select as jest.Mock).mockReturnValue(mockSelect);
    (db.insert as jest.Mock).mockReturnValue(mockInsert);
    (db.update as jest.Mock).mockReturnValue(mockUpdate);
    (db.delete as jest.Mock).mockReturnValue(mockDelete);
  });

  //
  // -------------------------------------------------------
  // CREATE PROVIDER
  // -------------------------------------------------------
  //
  describe("createProvider()", () => {
    it("should create new provider successfully", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockProvider]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createProvider({
        name: "OpenAI",
        apiBaseUrl: "https://api.openai.com/v1",
        envVarName: "OPENAI_API_KEY",
      });

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(result.provider).toEqual(mockProvider);
      expect(db.insert).toHaveBeenCalledWith(languageModelProviders);
    });

    it("should trim provider name", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockProvider, name: "OpenAI" }]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      await service.createProvider({
        name: "  OpenAI  ",
        apiBaseUrl: "https://api.openai.com/v1",
      });

      expect(mockInsert.values).toHaveBeenCalled();
      const callArgs = (mockInsert.values as jest.Mock).mock.calls[0][0];
      expect(callArgs.name).toBe("OpenAI");
    });

    it("should return existing provider if already exists (case-insensitive)", async () => {
      const existingProvider = { ...mockProvider };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([existingProvider]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.createProvider({
        name: "openai",
        apiBaseUrl: "https://api.openai.com/v1",
      });

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
      expect(result.provider).toEqual(existingProvider);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("should set envVarName to null if not provided", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockProvider, envVarName: null }]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      await service.createProvider({
        name: "CustomProvider",
        apiBaseUrl: "https://custom.api/v1",
      });

      const callArgs = (mockInsert.values as jest.Mock).mock.calls[0][0];
      expect(callArgs.envVarName).toBe(null);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("DB connection failed");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(
        service.createProvider({
          name: "OpenAI",
          apiBaseUrl: "https://api.openai.com/v1",
        })
      ).rejects.toThrow("Failed to create provider: DB connection failed");
    });
  });

  //
  // -------------------------------------------------------
  // CREATE MODEL
  // -------------------------------------------------------
  //
  describe("createModel()", () => {
    it("should create new model successfully", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createModel(1, {
        displayName: "GPT-4",
        apiName: "gpt-4",
        description: "OpenAI's GPT-4 model",
        maxOutputTokens: 8192,
        contextWindow: 8192,
      });

      expect(result.message).toBe("Model created successfully");
      expect(result.model).toEqual(mockModel);
      expect(db.insert).toHaveBeenCalledWith(languageModels);
    });

    it("should return existing model if already exists", async () => {
      const existingModel = { ...mockModel };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([existingModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.createModel(1, {
        displayName: "GPT-4",
        apiName: "gpt-4",
      });

      expect(result.message).toBe("Model already exists");
      expect(result.model).toEqual(existingModel);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("should set approved to true by default", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      await service.createModel(1, {
        displayName: "GPT-4",
        apiName: "gpt-4",
      });

      const callArgs = (mockInsert.values as jest.Mock).mock.calls[0][0];
      expect(callArgs.approved).toBe(true);
    });

    it("should set optional fields to null when not provided", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      await service.createModel(1, {
        displayName: "GPT-4",
        apiName: "gpt-4",
      });

      const callArgs = (mockInsert.values as jest.Mock).mock.calls[0][0];
      expect(callArgs.description).toBe(null);
      expect(callArgs.maxOutputTokens).toBe(null);
      expect(callArgs.contextWindow).toBe(null);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(
        service.createModel(1, {
          displayName: "GPT-4",
          apiName: "gpt-4",
        })
      ).rejects.toThrow("Failed to create model: DB error");
    });
  });

  //
  // -------------------------------------------------------
  // UPDATE MODEL
  // -------------------------------------------------------
  //
  describe("updateModel()", () => {
    it("should update model successfully", async () => {
      const updatedModel = { ...mockModel, displayName: "GPT-4 Turbo" };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockModel]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateModel(1, {
        displayName: "GPT-4 Turbo",
      });

      expect(result).toEqual(updatedModel);
      expect(db.update).toHaveBeenCalledWith(languageModels);
    });

    it("should throw 404 if model not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.updateModel(999, { displayName: "GPT-4" })).rejects.toThrow("Model not found");
    });

    it("should preserve existing values when not updating all fields", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockModel]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await service.updateModel(1, { displayName: "New Name" });

      const setCall = (mockUpdate.set as jest.Mock).mock.calls[0][0];
      expect(setCall.displayName).toBe("New Name");
      expect(setCall.apiName).toBe(mockModel.apiName);
    });

    it("should validate provider exists when updating customProviderId", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn()
          .mockResolvedValueOnce([mockModel]) // first call: get existing model
          .mockResolvedValueOnce([]), // second call: check if provider exists
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.updateModel(1, { customProviderId: 999 })).rejects.toThrow(
        "Provider with id 999 does not exist"
      );
    });

    it("should allow updating customProviderId if provider exists", async () => {
      const newProvider = { ...mockProvider, id: 2 };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn()
          .mockResolvedValueOnce([mockModel]) // first call: get existing model
          .mockResolvedValueOnce([newProvider]), // second call: check if provider exists
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockModel, customProviderId: 2 }]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateModel(1, { customProviderId: 2 });

      expect(result.customProviderId).toBe(2);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.updateModel(1, { displayName: "New Name" })).rejects.toThrow(
        "Failed to update model: DB error"
      );
    });
  });

  //
  // -------------------------------------------------------
  // DELETE PROVIDER OR MODEL
  // -------------------------------------------------------
  //
  describe("deleteProviderOrModel()", () => {
    it("should delete provider and cascade delete models", async () => {
      const mockSelectProvider = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockDeleteModels = {
        where: jest.fn().mockResolvedValue([mockModel]),
      };

      const mockDeleteProvider = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockProvider]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelectProvider);
      (db.delete as jest.Mock)
        .mockReturnValueOnce(mockDeleteModels)
        .mockReturnValueOnce(mockDeleteProvider);

      const result = await service.deleteProviderOrModel({ providerId: 1 });

      expect(result.provider).toEqual(mockProvider);
      expect(result.modelsDeleted).toBe(true);
    });

    it("should throw 404 if provider not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.deleteProviderOrModel({ providerId: 999 })).rejects.toThrow(
        "Provider with id 999 not found"
      );
    });

    it("should delete model by modelId", async () => {
      const mockSelectModel = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockModel]),
      };

      const mockDeleteModel = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelectModel);
      (db.delete as jest.Mock).mockReturnValue(mockDeleteModel);

      const result = await service.deleteProviderOrModel({ modelId: 1 });

      expect(result.model).toEqual(mockModel);
      expect(result.modelsDeleted).toBeUndefined();
    });

    it("should throw 404 if model not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.deleteProviderOrModel({ modelId: 999 })).rejects.toThrow(
        "Model with id 999 not found"
      );
    });

    it("should throw error if neither providerId nor modelId provided", async () => {
      await expect(service.deleteProviderOrModel({})).rejects.toThrow(
        "providerId or modelId is required"
      );
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.deleteProviderOrModel({ providerId: 1 })).rejects.toThrow(
        "Failed to delete: DB error"
      );
    });
  });

  //
  // -------------------------------------------------------
  // GET AVAILABLE MODELS
  // -------------------------------------------------------
  //
  describe("getAvailableModels()", () => {
    it("should return models grouped by provider", async () => {
      const mockSelectProviders = {
        from: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockSelectModels = {
        from: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockSelectProviders)
        .mockReturnValueOnce(mockSelectModels);

      const result = await service.getAvailableModels();

      expect(result.OpenAI).toBeDefined();
      expect(result.OpenAI.id).toBe(1);
      expect(result.OpenAI.models.length).toBe(1);
      expect(result.OpenAI.models[0].apiName).toBe("gpt-4");
      expect(result.OpenAI.models[0].name).toBe("GPT-4");
    });

    it("should handle multiple models per provider", async () => {
      const model2 = { ...mockModel, id: 2, displayName: "GPT-3.5", apiName: "gpt-3.5-turbo" };

      const mockSelectProviders = {
        from: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockSelectModels = {
        from: jest.fn().mockResolvedValue([mockModel, model2]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockSelectProviders)
        .mockReturnValueOnce(mockSelectModels);

      const result = await service.getAvailableModels();

      expect(result.OpenAI.models.length).toBe(2);
    });

    it("should handle multiple providers", async () => {
      const provider2 = { ...mockProvider, id: 2, name: "Anthropic" };
      const model2 = { ...mockModel, id: 2, customProviderId: 2, apiName: "claude-3" };

      const mockSelectProviders = {
        from: jest.fn().mockResolvedValue([mockProvider, provider2]),
      };

      const mockSelectModels = {
        from: jest.fn().mockResolvedValue([mockModel, model2]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockSelectProviders)
        .mockReturnValueOnce(mockSelectModels);

      const result = await service.getAvailableModels();

      expect(result.OpenAI).toBeDefined();
      expect(result.Anthropic).toBeDefined();
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getAvailableModels()).rejects.toThrow("Failed to fetch models: DB error");
    });
  });

  //
  // -------------------------------------------------------
  // GET ALL PROVIDERS
  // -------------------------------------------------------
  //
  describe("getAllProviders()", () => {
    it("should return all providers", async () => {
      const mockSelect = {
        from: jest.fn().mockResolvedValue([mockProvider]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getAllProviders();

      expect(result).toEqual([mockProvider]);
      expect(db.select).toHaveBeenCalledWith();
    });

    it("should return empty array when no providers exist", async () => {
      const mockSelect = {
        from: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getAllProviders();

      expect(result).toEqual([]);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getAllProviders()).rejects.toThrow("Failed to fetch providers: DB error");
    });
  });

  //
  // -------------------------------------------------------
  // GET MODELS BY PROVIDER ID
  // -------------------------------------------------------
  //
  describe("getModelsByProviderId()", () => {
    it("should return models for a specific provider", async () => {
      const mockSelectProvider = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockSelectModels = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockSelectProvider)
        .mockReturnValueOnce(mockSelectModels);

      const result = await service.getModelsByProviderId(1);

      expect(result.provider).toEqual(mockProvider);
      expect(result.models).toEqual([mockModel]);
    });

    it("should throw 404 if provider not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getModelsByProviderId(999)).rejects.toThrow("Provider not found");
    });

    it("should return empty models array if provider has no models", async () => {
      const mockSelectProvider = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockSelectModels = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockSelectProvider)
        .mockReturnValueOnce(mockSelectModels);

      const result = await service.getModelsByProviderId(1);

      expect(result.provider).toEqual(mockProvider);
      expect(result.models).toEqual([]);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getModelsByProviderId(1)).rejects.toThrow("Failed to fetch models: DB error");
    });
  });

  //
  // -------------------------------------------------------
  // GET ALL MODELS
  // -------------------------------------------------------
  //
  describe("getAllModels()", () => {
    it("should return all models", async () => {
      const mockSelect = {
        from: jest.fn().mockResolvedValue([mockModel]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getAllModels();

      expect(result).toEqual([mockModel]);
    });

    it("should return empty array when no models exist", async () => {
      const mockSelect = {
        from: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getAllModels();

      expect(result).toEqual([]);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getAllModels()).rejects.toThrow("Failed to fetch models: DB error");
    });
  });

  //
  // -------------------------------------------------------
  // UPDATE PROVIDER
  // -------------------------------------------------------
  //
  describe("updateProvider()", () => {
    it("should update provider successfully", async () => {
      const updatedProvider = { ...mockProvider, name: "OpenAI Updated" };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedProvider]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateProvider(1, { name: "OpenAI Updated" });

      expect(result).toEqual(updatedProvider);
      expect(db.update).toHaveBeenCalledWith(languageModelProviders);
    });

    it("should throw 404 if provider not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.updateProvider(999, { name: "New Name" })).rejects.toThrow("Provider not found");
    });

    it("should preserve existing values when not updating all fields", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockProvider]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await service.updateProvider(1, { name: "New Name" });

      const setCall = (mockUpdate.set as jest.Mock).mock.calls[0][0];
      expect(setCall.name).toBe("New Name");
      expect(setCall.apiBaseUrl).toBe(mockProvider.apiBaseUrl);
    });

    it("should update envVarName to existing value if not provided", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockProvider]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockProvider]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await service.updateProvider(1, { name: "Updated" });

      const setCall = (mockUpdate.set as jest.Mock).mock.calls[0][0];
      expect(setCall.envVarName).toBe(mockProvider.envVarName);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.updateProvider(1, { name: "New Name" })).rejects.toThrow(
        "Failed to update provider: DB error"
      );
    });
  });
});
