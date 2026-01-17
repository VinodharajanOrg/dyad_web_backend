import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { settingsApi, UserSettingsResponse, UpdateApiKeyParams } from '../endpoints/settings';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('settingsApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockSettings = (overrides?: Partial<UserSettingsResponse>): UserSettingsResponse => ({
    id: 1,
    userId: 'user123',
    selectedModel: {
      id: 'gpt-4',
      name: 'GPT-4',
      providerId: 'openai',
    },
    apiKeys: {
      openai: 'sk-123abc',
      anthropic: 'sk-789xyz',
    },
    selectedChatMode: 'standard',
    smartContextEnabled: true,
    turboEditsV2Enabled: false,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  });

  describe('getSettings()', () => {
    it('should fetch current user settings', async () => {
      const mockSettings = createMockSettings();

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockSettings);

      const result = await settingsApi.getSettings();

      expect(mockApiClient.get).toHaveBeenCalledWith('/settings');
      expect(result.userId).toBe('user123');
      expect(result.selectedModel.name).toBe('GPT-4');
    });

    it('should include all configured API keys', async () => {
      const mockSettings = createMockSettings({
        apiKeys: {
          openai: 'sk-123',
          anthropic: 'sk-456',
          cohere: 'sk-789',
        },
      });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockSettings);

      const result = await settingsApi.getSettings();

      expect(Object.keys(result.apiKeys)).toHaveLength(3);
      expect(result.apiKeys.openai).toBe('sk-123');
    });
  });

  describe('updateApiKey()', () => {
    it('should update API key for a provider', async () => {
      const params: UpdateApiKeyParams = { apiKey: 'new-key-123' };

      vi.mocked(mockApiClient.put).mockResolvedValueOnce({
        message: 'API key updated',
      });

      const result = await settingsApi.updateApiKey('openai', params);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/settings/api-keys/openai',
        params
      );
      expect(result.message).toBe('API key updated');
    });

    it('should update API key for different providers', async () => {
      const params: UpdateApiKeyParams = { apiKey: 'anthropic-key' };

      vi.mocked(mockApiClient.put).mockResolvedValueOnce({
        message: 'API key updated',
      });

      await settingsApi.updateApiKey('anthropic', params);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/settings/api-keys/anthropic',
        params
      );
    });
  });

  describe('deleteApiKey()', () => {
    it('should delete API key for a provider', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({
        message: 'API key deleted',
      });

      const result = await settingsApi.deleteApiKey('openai');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/settings/api-keys/openai');
      expect(result.message).toBe('API key deleted');
    });

    it('should handle deletion for various providers', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({
        message: 'Deleted',
      });

      await settingsApi.deleteApiKey('cohere');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/settings/api-keys/cohere');
    });
  });

  describe('Integration scenarios', () => {
    it('should get settings → update key → get settings', async () => {
      const initialSettings = createMockSettings();
      const updatedSettings = createMockSettings({
        apiKeys: { openai: 'new-key' },
      });

      vi.mocked(mockApiClient.get)
        .mockResolvedValueOnce(initialSettings)
        .mockResolvedValueOnce(updatedSettings);

      vi.mocked(mockApiClient.put).mockResolvedValueOnce({
        message: 'Updated',
      });

      const settings1 = await settingsApi.getSettings();
      expect(settings1.apiKeys.openai).toBe('sk-123abc');

      await settingsApi.updateApiKey('openai', { apiKey: 'new-key' });

      const settings2 = await settingsApi.getSettings();
      expect(settings2.apiKeys.openai).toBe('new-key');
    });
  });
});
