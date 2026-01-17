import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  languageModelsApi,
  LanguageModel,
  CreateModelParams,
  UpdateModelParams,
} from '../endpoints/language-models';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('languageModelsApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockModel = (overrides?: Partial<LanguageModel>): LanguageModel => ({
    id: 1,
    displayName: 'GPT-4',
    apiName: 'gpt-4',
    builtinProviderId: 1,
    customProviderId: null,
    description: 'Advanced model by OpenAI',
    maxOutputTokens: 8192,
    contextWindow: 128000,
    approved: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  });

  describe('list()', () => {
    it('should fetch all language models', async () => {
      const mockModels = [
        createMockModel({ id: 1, displayName: 'GPT-4' }),
        createMockModel({ id: 2, displayName: 'Claude-3' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ models: mockModels });

      const result = await languageModelsApi.list();

      expect(mockApiClient.get).toHaveBeenCalledWith('/language-models');
      expect(result.models).toHaveLength(2);
    });

    it('should return empty models list', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ models: [] });

      const result = await languageModelsApi.list();

      expect(result.models).toEqual([]);
    });
  });

  describe('get()', () => {
    it('should fetch a language model by id', async () => {
      const mockModel = createMockModel({ id: 5 });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockModel);

      const result = await languageModelsApi.get(5);

      expect(mockApiClient.get).toHaveBeenCalledWith('/language-models/5');
      expect(result.id).toBe(5);
      expect(result.displayName).toBe('GPT-4');
    });
  });

  describe('create()', () => {
    it('should create a new language model', async () => {
      const params: CreateModelParams = {
        displayName: 'GPT-4 Turbo',
        apiName: 'gpt-4-turbo',
        builtinProviderId: '1',
        description: 'Latest GPT-4 model',
      };

      const mockResponse = {
        message: 'Model created',
        model: createMockModel({ id: 10, displayName: params.displayName, apiName: params.apiName, builtinProviderId: 1, description: params.description }),
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await languageModelsApi.create(1, params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/providers/1/model', params);
      expect(result.model.displayName).toBe('GPT-4 Turbo');
    });
  });

  describe('update()', () => {
    it('should update language model', async () => {
      const params: UpdateModelParams = {
        displayName: 'Updated GPT-4',
        contextWindow: 256000,
      };

      const mockResponse = {
        message: 'Model updated',
        data: createMockModel({ displayName: 'Updated GPT-4', contextWindow: 256000 }),
      };

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockResponse);

      const result = await languageModelsApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/providers/models/1', params);
      expect(result.data.displayName).toBe('Updated GPT-4');
    });

    it('should update approval status', async () => {
      const params: UpdateModelParams = { approved: false };

      const mockResponse = {
        message: 'Updated',
        data: createMockModel({ approved: false }),
      };

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockResponse);

      const result = await languageModelsApi.update(1, params);

      expect(result.data.approved).toBe(false);
    });
  });

  describe('delete()', () => {
    it('should delete a language model', async () => {
      const mockResponse = {
        message: 'Model deleted',
        data: { model: createMockModel({ id: 1 }) },
      };

      vi.mocked(mockApiClient.delete).mockResolvedValueOnce(mockResponse);

      const result = await languageModelsApi.delete(1);

      // FIXED ENDPOINT EXPECTATION
      expect(mockApiClient.delete).toHaveBeenCalledWith(
        '/providers/provider-model?modelId=1'
      );

      expect(result.message).toBe('Model deleted');
    });
  });

  describe('Integration scenarios', () => {
    it('should list → get → update model', async () => {
      const mockModels = [createMockModel({ id: 1 })];
      const mockModel = createMockModel({ id: 1 });
      const mockUpdateResponse = {
        message: 'Updated',
        data: createMockModel({ id: 1, displayName: 'Updated' }),
      };

      vi.mocked(mockApiClient.get)
        .mockResolvedValueOnce({ models: mockModels })
        .mockResolvedValueOnce(mockModel);

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockUpdateResponse);

      const listed = await languageModelsApi.list();
      expect(listed.models).toHaveLength(1);

      const fetched = await languageModelsApi.get(1);
      expect(fetched.displayName).toBe('GPT-4');

      const updated = await languageModelsApi.update(1, { displayName: 'Updated' });
      expect(updated.data.displayName).toBe('Updated');
    });
  });
});
