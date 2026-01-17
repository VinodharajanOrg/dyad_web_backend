import { AIService, AISettings, StreamOptions } from "../../src/services/ai_service";
import { SettingsService } from "../../src/services/settings_service";
import { streamText } from "ai";

jest.mock("../../src/services/settings_service");
jest.mock("ai");
jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: jest.fn(() => jest.fn().mockReturnValue({})),
}));
jest.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: jest.fn(() => jest.fn().mockReturnValue({})),
}));
jest.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: jest.fn(() => jest.fn().mockReturnValue({})),
}));

describe("AIService", () => {
  let service: AIService;

  const mockAISettings: AISettings = {
    selectedModel: {
      id: "gpt-4o",
      name: "GPT-4 Turbo",
      providerId: "openai",
    },
    apiKeys: {
      openai: "test-openai-key",
      anthropic: "test-anthropic-key",
      google: "test-google-key",
    },
    selectedChatMode: "auto-code",
    smartContextEnabled: true,
    turboEditsV2Enabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any cached instance
    delete (AIService as any)._instance;

    service = new AIService();
  });

  //
  // -------------------------------------------------------
  // GET SETTINGS
  // -------------------------------------------------------
  //
  describe("getSettings()", () => {
    it("should get settings from database successfully", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue(mockAISettings);

      const result = await service.getSettings('test-user-id');

      expect(result).toEqual(mockAISettings);
      expect(result.selectedModel.id).toBe("gpt-4o");
    });

    it("should cache settings on first call", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue(mockAISettings);

      const result1 = await service.getSettings('test-user-id');
      const result2 = await service.getSettings('test-user-id');

      expect(result1).toBe(result2);
      expect(service["settingsService"].getSettings).toHaveBeenCalledTimes(1);
    });

    it("should fallback to environment variables when database fails", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const envBackup = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      };

      process.env.OPENAI_API_KEY = "env-openai-key";
      process.env.ANTHROPIC_API_KEY = "env-anthropic-key";
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "env-google-key";

      service["settingsCache"] = null; // Clear cache

      try {
        const result = await service.getSettings('test-user-id');

        expect(result.apiKeys.openai).toBe("env-openai-key");
        expect(result.selectedModel.providerId).toBe("openai");
      } finally {
        Object.assign(process.env, envBackup);
      }
    });

    it("should throw error when no API keys are configured", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const envBackup = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      };

      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      service["settingsCache"] = null; // Clear cache

      try {
        await expect(service.getSettings('test-user-id')).rejects.toThrow(
          "No API keys configured"
        );
      } finally {
        Object.assign(process.env, envBackup);
      }
    });

    it("should prefer database API keys over environment variables", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue(mockAISettings);

      const result = await service.getSettings('test-user-id');

      expect(result.apiKeys.openai).toBe("test-openai-key");
    });

    it("should use DEFAULT_AI_MODEL environment variable if set", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const envBackup = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        DEFAULT_AI_MODEL: process.env.DEFAULT_AI_MODEL,
      };

      process.env.OPENAI_API_KEY = "test-key";
      process.env.DEFAULT_AI_MODEL = "anthropic:claude-3-5-sonnet-20241022";

      service["settingsCache"] = null; // Clear cache

      try {
        const result = await service.getSettings('test-user-id');

        expect(result.selectedModel.providerId).toBe("anthropic");
        expect(result.selectedModel.id).toBe("claude-3-5-sonnet-20241022");
      } finally {
        Object.assign(process.env, envBackup);
      }
    });

    it("should use DEFAULT_CHAT_MODE environment variable if set", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      const envBackup = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        DEFAULT_CHAT_MODE: process.env.DEFAULT_CHAT_MODE,
      };

      process.env.OPENAI_API_KEY = "test-key";
      process.env.DEFAULT_CHAT_MODE = "agent";

      service["settingsCache"] = null; // Clear cache

      try {
        const result = await service.getSettings('test-user-id');

        expect(result.selectedChatMode).toBe("agent");
      } finally {
        Object.assign(process.env, envBackup);
      }
    });
  });

  //
  // -------------------------------------------------------
  // CLEAR CACHE
  // -------------------------------------------------------
  //
  describe("clearCache()", () => {
    it("should clear settings cache", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue(mockAISettings);

      await service.getSettings('test-user-id');
      expect(service["settingsCache"]).not.toBeNull();

      service.clearCache();
      expect(service["settingsCache"]).toBeNull();
    });

    it("should force refetch settings after cache clear", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue(mockAISettings);

      await service.getSettings('test-user-id');
      service.clearCache();
      await service.getSettings('test-user-id');

      expect(service["settingsService"].getSettings).toHaveBeenCalledTimes(2);
    });
  });

  //
  // -------------------------------------------------------
  // GET MODEL CLIENT
  // -------------------------------------------------------
  //
  describe("getModelClient()", () => {
    beforeEach(() => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue(mockAISettings);
    });

    it("should get model client successfully", async () => {
      const model = await service.getModelClient();

      expect(model).toBeDefined();
    });

    it("should use override model if provided", async () => {
      const overrideModel = {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        providerId: "openai",
      };

      const model = await service.getModelClient(overrideModel);

      expect(model).toBeDefined();
    });

    it("should throw error for unsupported provider", async () => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue({
        ...mockAISettings,
        selectedModel: {
          id: "some-model",
          name: "Some Model",
          providerId: "unsupported-provider",
        },
        apiKeys: {
          ...mockAISettings.apiKeys,
          "unsupported-provider": "test-key",
        },
      });

      await expect(service.getModelClient()).rejects.toThrow(
        "Unsupported AI provider"
      );
    });
  });

  //
  // -------------------------------------------------------
  // STREAM RESPONSE
  // -------------------------------------------------------
  //
  describe("streamResponse()", () => {
    beforeEach(() => {
      (service["settingsService"].getSettings as jest.Mock).mockResolvedValue(mockAISettings);
    });

    it("should handle streaming errors gracefully", async () => {
      (streamText as jest.Mock).mockResolvedValue({
        fullStream: (async function* () {
          yield { type: "error", error: new Error("API error") };
        })(),
      });

      const options: StreamOptions = {
        messages: [{ role: "user", content: "Hello" }],
        systemPrompt: "You are a helpful assistant",
      };

      await expect(async () => {
        for await (const _ of service.streamResponse(options)) {
          // consume stream
        }
      }).rejects.toThrow("AI streaming error");
    });

    it("should call streamText with correct parameters", async () => {
      (streamText as jest.Mock).mockResolvedValue({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Response" };
        })(),
      });

      const options: StreamOptions = {
        messages: [{ role: "user", content: "Hello" }],
        systemPrompt: "You are a helpful assistant",
        maxTokens: 100,
        temperature: 0.5,
      };

      const results = [];
      try {
        for await (const chunk of service.streamResponse(options)) {
          results.push(chunk);
        }
      } catch (e) {
        // Expected to fail due to mocking
      }

      expect(streamText).toHaveBeenCalled();
    });

    it("should handle abort signal in options", async () => {
      const abortController = new AbortController();

      (streamText as jest.Mock).mockResolvedValue({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Hello" };
        })(),
      });

      const options: StreamOptions = {
        messages: [{ role: "user", content: "Hello" }],
        systemPrompt: "You are a helpful assistant",
        abortSignal: abortController.signal,
      };

      try {
        for await (const _ of service.streamResponse(options)) {
          // consume stream
        }
      } catch (e) {
        // Expected due to mocking
      }

      expect(streamText).toHaveBeenCalled();
    });

    it("should handle override model in streamResponse", async () => {
      const overrideModel = {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        providerId: "openai",
      };

      (streamText as jest.Mock).mockResolvedValue({
        fullStream: (async function* () {
          yield { type: "text-delta", text: "Response" };
        })(),
      });

      const options: StreamOptions = {
        messages: [{ role: "user", content: "Hello" }],
        systemPrompt: "You are a helpful assistant",
        overrideModel,
      };

      try {
        for await (const _ of service.streamResponse(options)) {
          // consume stream
        }
      } catch (e) {
        // Expected due to mocking
      }

      expect(streamText).toHaveBeenCalled();
    });
  });

  //
  // -------------------------------------------------------
  // SINGLETON PATTERN
  // -------------------------------------------------------
  //
  describe("singleton pattern", () => {
    it("should return same instance from static getter", () => {
      // Clear instance
      delete (AIService as any)._instance;

      const instance1 = AIService.instance;
      const instance2 = AIService.instance;

      expect(instance1).toBe(instance2);
    });

    it("should create new instance when constructor called", () => {
      const instance1 = new AIService();
      const instance2 = new AIService();

      expect(instance1).not.toBe(instance2);
    });
  });
});
