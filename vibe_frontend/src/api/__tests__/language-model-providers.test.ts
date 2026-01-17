import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  languageModelProvidersApi,
  Provider,
  CreateProviderParams,
  UpdateProviderParams,
} from '../endpoints/language-model-providers';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('languageModelProvidersApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockProvider = (overrides?: Partial<Provider>): Provider => ({
    id: 1,
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    envVarName: 'OPENAI_API_KEY',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  });

  //
  // FIXED TESTS BELOW TO MATCH CURRENT API ENDPOINTS
  //

  describe('list()', () => {
    it('should fetch all language model providers', async () => {
      const mockProviders: Provider[] = [
        createMockProvider({ id: 1, name: 'OpenAI' }),
        createMockProvider({ id: 2, name: 'Anthropic' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockProviders);

      const result = await languageModelProvidersApi.list();

      expect(mockApiClient.get).toHaveBeenCalledWith('/providers/all_providers');
      expect(result).toHaveLength(2);
    });
  });

  describe('get()', () => {
    it('should fetch a provider with its models', async () => {
      const mockProvider = createMockProvider({ id: 5 });
      const mockResponse = { data: [mockProvider] };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockResponse);

      const result = await languageModelProvidersApi.get('5');

      expect(mockApiClient.get).toHaveBeenCalledWith('/language-model-providers/5');
      expect(result.data[0]?.name).toBe('OpenAI');
    });
  });

  describe('create()', () => {
    it('should create a new provider', async () => {
      const params: CreateProviderParams = {
        name: 'Custom Provider',
        apiBaseUrl: 'https://custom.api.com',
        envVarName: 'CUSTOM_API_KEY',
      };

      const mockResponse = {
        success: true,
        message: 'Provider created',
        provider: createMockProvider({ id: 10, ...params }),
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await languageModelProvidersApi.create(params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/providers/provider', params);
      expect(result.provider.name).toBe('Custom Provider');
    });
  });

  describe('update()', () => {
    it('should update a provider', async () => {
      const params: UpdateProviderParams = {
        name: 'Updated Provider',
        apiBaseUrl: 'https://updated.api.com',
      };

      const mockResponse = {
        success: true,
        message: 'Provider updated',
        data: createMockProvider({ id: 1, ...params }),
      };

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockResponse);

      const result = await languageModelProvidersApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/providers/1', params);
      expect(result.data.name).toBe('Updated Provider');
    });
  });

  describe('delete()', () => {
    it('should delete a provider', async () => {
      const mockResponse = {
        message: 'Provider deleted',
        data: {
          provider: createMockProvider({ id: 1 }),
          modelsDeleted: true,
        },
      };

      vi.mocked(mockApiClient.delete).mockResolvedValueOnce(mockResponse);

      const result = await languageModelProvidersApi.delete('1');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/providers/provider-model?providerId=1');
      expect(result.data.modelsDeleted).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should list → get → update provider', async () => {
      const mockProviders = [createMockProvider({ id: 1 })];
      const mockProvider = createMockProvider({ id: 1 });
      const mockUpdateResponse = {
        success: true,
        message: 'Updated',
        data: createMockProvider({ id: 1, name: 'Updated' }),
      };

      vi.mocked(mockApiClient.get)
        .mockResolvedValueOnce(mockProviders)
        .mockResolvedValueOnce({ data: [mockProvider] });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockUpdateResponse);

      const list = await languageModelProvidersApi.list();
      expect(list).toHaveLength(1);

      const fetched = await languageModelProvidersApi.get('1');
      expect(fetched.data[0]?.name).toBe('OpenAI');

      const updated = await languageModelProvidersApi.update(1, { name: 'Updated' });
      expect(updated.data.name).toBe('Updated');
    });
  });
});
