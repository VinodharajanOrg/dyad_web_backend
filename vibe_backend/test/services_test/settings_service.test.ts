import { SettingsService, UserSettings, SelectedModel } from "../../src/services/settings_service";
import { settings } from "../../src/db/schema";
import { AppError } from "../../src/middleware/errorHandler";

jest.mock("../../src/db");
jest.mock("../../src/utils/crypto", () => ({
  encryptApiKey: jest.fn((key: string) => `encrypted:${key}:tag`),
  decryptApiKey: jest.fn((encrypted: string) => {
    // Mock decryption - just return the plain key part for testing
    if (encrypted.includes(':')) {
      const parts = encrypted.split(':');
      if (parts.length === 3) {
        // GCM format: return mocked decrypted value
        return 'decrypted_' + parts[1];
      }
    }
    return encrypted; // Fallback for plain text in old tests
  }),
}));

import { db } from "../../src/db";

describe("SettingsService", () => {
  let service: SettingsService;

  const mockSelectedModel: SelectedModel = {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    providerId: "google",
  };

  const mockUserSettings: UserSettings = {
    id: 1,
    userId: "user123",
    selectedModel: mockSelectedModel,
    apiKeys: { google: "decrypted_google_key" },
    apiEndpoint: undefined,
    selectedChatMode: "auto-code",
    smartContextEnabled: false,
    turboEditsV2Enabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettingsService();

    // Setup default mock implementations
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
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

    (db.select as jest.Mock).mockReturnValue(mockSelect);
    (db.insert as jest.Mock).mockReturnValue(mockInsert);
    (db.update as jest.Mock).mockReturnValue(mockUpdate);
  });

  //
  // -------------------------------------------------------
  // GET SETTINGS
  // -------------------------------------------------------
  //
  describe("getSettings()", () => {
    it("should return existing settings for user", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getSettings("user123");

      expect(result).toEqual(mockUserSettings);
      expect(result.userId).toBe("user123");
      expect(result.selectedModel).toEqual(mockSelectedModel);
      expect(mockSelect.from).toHaveBeenCalledWith(settings);
    });

    it("should use default userId when not provided", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await service.getSettings();

      expect(mockSelect.where).toHaveBeenCalled();
    });

    it("should create default settings if none exist", async () => {
      const defaultSettings = {
        id: 1,
        userId: "default",
        selectedModel: mockSelectedModel,
        apiKeys: {},
        selectedChatMode: "auto-code",
        smartContextEnabled: false,
        turboEditsV2Enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([defaultSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.getSettings("default");

      expect(result.selectedChatMode).toBe("auto-code");
      expect(result.apiKeys).toEqual({});
      expect(db.insert).toHaveBeenCalledWith(settings);
    });

    it("should return default settings with gemini model when created", async () => {
      const newSettings = {
        id: 2,
        userId: "newuser",
        selectedModel: {
          id: "gemini-2.5-pro",
          name: "Gemini 2.5 Pro",
          providerId: "google",
        },
        apiKeys: {},
        selectedChatMode: "auto-code",
        smartContextEnabled: false,
        turboEditsV2Enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([newSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.getSettings("newuser");

      expect(result.selectedModel.id).toBe("gemini-2.5-pro");
      expect(result.selectedModel.name).toBe("Gemini 2.5 Pro");
      expect(result.selectedModel.providerId).toBe("google");
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("Connection failed");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getSettings("user123")).rejects.toThrow("Failed to get settings: Connection failed");
    });
  });

  //
  // -------------------------------------------------------
  // UPDATE SETTINGS
  // -------------------------------------------------------
  //
  describe("updateSettings()", () => {
    it("should update selected model", async () => {
      const newModel: SelectedModel = {
        id: "gpt-4",
        name: "GPT-4",
        providerId: "openai",
      };

      const updatedSettings = {
        ...mockUserSettings,
        selectedModel: newModel,
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateSettings({ selectedModel: newModel }, "user123");

      expect(result.selectedModel).toEqual(newModel);
      expect(db.update).toHaveBeenCalledWith(settings);
    });

    it("should update chat mode", async () => {
      const updatedSettings = {
        ...mockUserSettings,
        selectedChatMode: "agent" as const,
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateSettings({ selectedChatMode: "agent" }, "user123");

      expect(result.selectedChatMode).toBe("agent");
    });

    it("should update smart context setting", async () => {
      const updatedSettings = {
        ...mockUserSettings,
        smartContextEnabled: true,
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateSettings({ smartContextEnabled: true }, "user123");

      expect(result.smartContextEnabled).toBe(true);
    });

    it("should update turbo edits v2 setting", async () => {
      const updatedSettings = {
        ...mockUserSettings,
        turboEditsV2Enabled: true,
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateSettings({ turboEditsV2Enabled: true }, "user123");

      expect(result.turboEditsV2Enabled).toBe(true);
    });

    it("should update multiple settings at once", async () => {
      const newModel: SelectedModel = {
        id: "gpt-4",
        name: "GPT-4",
        providerId: "openai",
      };

      const updatedSettings = {
        ...mockUserSettings,
        selectedModel: newModel,
        smartContextEnabled: true,
        turboEditsV2Enabled: false,
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateSettings(
        {
          selectedModel: newModel,
          smartContextEnabled: true,
        },
        "user123"
      );

      expect(result.selectedModel).toEqual(newModel);
      expect(result.smartContextEnabled).toBe(true);
    });

    it("should update apiKeys field", async () => {
      const newApiKeys = { google: "newkey123", openai: "openaikey" };

      const updatedSettings = {
        ...mockUserSettings,
        apiKeys: newApiKeys,
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateSettings({ apiKeys: newApiKeys }, "user123");

      expect(result.apiKeys).toEqual(newApiKeys);
    });

    it("should use default userId when not provided", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await service.updateSettings({ smartContextEnabled: true });

      expect(mockUpdate.where).toHaveBeenCalled();
    });

    it("should throw error if settings not found after update", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.updateSettings({ smartContextEnabled: true }, "user123")).rejects.toThrow(
        "Settings not found"
      );
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("DB write failed");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.updateSettings({ smartContextEnabled: true }, "user123")).rejects.toThrow(
        "Failed to update settings: DB write failed"
      );
    });
  });

  //
  // -------------------------------------------------------
  // UPDATE API KEY
  // -------------------------------------------------------
  //
  describe("updateApiKey()", () => {
    it("should add new API key for provider", async () => {
      const settingsWithNewKey = {
        ...mockUserSettings,
        apiKeys: { google: "key123", openai: "newkey456" },
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsWithNewKey]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateApiKey("openai", "newkey456", "user123");

      expect(result.apiKeys.openai).toBe("newkey456");
      expect(result.apiKeys.google).toBe("key123");
    });

    it("should update existing API key for provider", async () => {
      const settingsWithUpdatedKey = {
        ...mockUserSettings,
        apiKeys: { google: "updatedkey" },
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsWithUpdatedKey]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateApiKey("google", "updatedkey", "user123");

      expect(result.apiKeys.google).toBe("updatedkey");
    });

    it("should use default userId when not provided", async () => {
      const settingsWithNewKey = {
        ...mockUserSettings,
        apiKeys: { google: "key123", anthropic: "newkey" },
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsWithNewKey]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateApiKey("default", "anthropic", "newkey");

      expect(result.apiKeys.anthropic).toBe("newkey");
    });

    it("should handle empty apiKeys when adding first key", async () => {
      const settingsWithEmptyKeys = {
        ...mockUserSettings,
        apiKeys: {},
      };

      const settingsWithFirstKey = {
        ...mockUserSettings,
        apiKeys: { azure: "azurekey" },
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([settingsWithEmptyKeys]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsWithFirstKey]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateApiKey("azure", "azurekey", "user123");

      expect(result.apiKeys.azure).toBe("azurekey");
    });

    it("should throw error on getSettings failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("Connection lost");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.updateApiKey("google", "newkey", "user123")).rejects.toThrow(
        "Failed to update API key: Failed to get settings: Connection lost"
      );
    });

    it("should throw error on updateSettings failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.updateApiKey("google", "newkey", "user123")).rejects.toThrow(
        "Failed to update API key: Failed to update settings: DB error"
      );
    });
  });

  //
  // -------------------------------------------------------
  // DELETE API KEY
  // -------------------------------------------------------
  //
  describe("deleteApiKey()", () => {
    it("should delete API key for provider", async () => {
      const settingsWithoutKey = {
        ...mockUserSettings,
        apiKeys: {},
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsWithoutKey]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.deleteApiKey("google", "user123");

      expect(result.apiKeys.google).toBeUndefined();
    });

    it("should keep other API keys when deleting one", async () => {
      const settingsWithMultipleKeys = {
        ...mockUserSettings,
        apiKeys: { google: "key1", openai: "key2", anthropic: "key3" },
      };

      const settingsAfterDelete = {
        ...settingsWithMultipleKeys,
        apiKeys: { openai: "key2", anthropic: "key3" },
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([settingsWithMultipleKeys]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsAfterDelete]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.deleteApiKey("google", "user123");

      expect(result.apiKeys.openai).toBe("key2");
      expect(result.apiKeys.anthropic).toBe("key3");
      expect(result.apiKeys.google).toBeUndefined();
    });

    it("should use default userId when not provided", async () => {
      const settingsWithoutKey = {
        ...mockUserSettings,
        apiKeys: {},
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsWithoutKey]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.deleteApiKey("google");

      expect(result.apiKeys.google).toBeUndefined();
    });

    it("should handle deleting non-existent key gracefully", async () => {
      const settingsUnchanged = {
        ...mockUserSettings,
        apiKeys: { google: "key123" },
        updatedAt: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([settingsUnchanged]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.deleteApiKey("nonexistent", "user123");

      // Still returns settings, just without the key that didn't exist
      expect(result.apiKeys.google).toBe("key123");
    });

    it("should throw error on getSettings failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("Connection lost");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.deleteApiKey("google", "user123")).rejects.toThrow(
        "Failed to delete API key: Failed to get settings: Connection lost"
      );
    });

    it("should throw error on updateSettings failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUserSettings]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("DB error");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.deleteApiKey("google", "user123")).rejects.toThrow(
        "Failed to delete API key: Failed to update settings: DB error"
      );
    });
  });
});
