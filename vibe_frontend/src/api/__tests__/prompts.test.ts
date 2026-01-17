import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promptsApi, Prompt, CreatePromptParams, UpdatePromptParams } from '../endpoints/prompts';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('promptsApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockPrompt = (overrides?: Partial<Prompt>): Prompt => ({
    id: 1,
    userId: 1,
    title: 'Test Prompt',
    description: 'A test prompt',
    content: 'This is a test prompt content',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('list()', () => {
    it('should fetch all prompts for current user', async () => {
      const mockPrompts: Prompt[] = [
        createMockPrompt({ id: 1, title: 'Prompt 1' }),
        createMockPrompt({ id: 2, title: 'Prompt 2' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ prompts: mockPrompts });

      const result = await promptsApi.list();

      expect(mockApiClient.get).toHaveBeenCalledWith('/prompts');
      expect(result.prompts).toHaveLength(2);
    });

    it('should return empty prompts list', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ prompts: [] });

      const result = await promptsApi.list();

      expect(result.prompts).toEqual([]);
    });
  });

  describe('get()', () => {
    it('should fetch a prompt by id', async () => {
      const mockPrompt = createMockPrompt({ id: 5 });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockPrompt);

      const result = await promptsApi.get(5);

      expect(mockApiClient.get).toHaveBeenCalledWith('/prompts/5');
      expect(result.id).toBe(5);
    });

    it('should throw error when prompt not found', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValueOnce(new Error('Not found'));

      await expect(promptsApi.get(999)).rejects.toThrow('Not found');
    });
  });

  describe('create()', () => {
    it('should create a new prompt', async () => {
      const params: CreatePromptParams = {
        title: 'New Prompt',
        description: 'A new prompt',
        content: 'New content',
      };

      const mockPrompt = createMockPrompt({ id: 10, ...params });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockPrompt);

      const result = await promptsApi.create(params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/prompts', params);
      expect(result.title).toBe('New Prompt');
    });

    it('should create prompt with minimal params', async () => {
      const params: CreatePromptParams = {
        title: 'Minimal',
        content: 'Content',
      };

      const mockPrompt = createMockPrompt({ id: 11, ...params });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockPrompt);

      const result = await promptsApi.create(params);

      expect(result.title).toBe('Minimal');
    });
  });

  describe('update()', () => {
    it('should update prompt title', async () => {
      const params: UpdatePromptParams = { title: 'Updated Title' };
      const mockPrompt = createMockPrompt({ id: 1, title: 'Updated Title' });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockPrompt);

      const result = await promptsApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/prompts/1', params);
      expect(result.title).toBe('Updated Title');
    });

    it('should update prompt content', async () => {
      const params: UpdatePromptParams = { content: 'New content' };
      const mockPrompt = createMockPrompt({ id: 1, content: 'New content' });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockPrompt);

      const result = await promptsApi.update(1, params);

      expect(result.content).toBe('New content');
    });

    it('should update multiple fields', async () => {
      const params: UpdatePromptParams = {
        title: 'Updated',
        description: 'New desc',
        content: 'New content',
      };

      const mockPrompt = createMockPrompt({ id: 1, ...params });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockPrompt);

      const result = await promptsApi.update(1, params);

      expect(result.title).toBe('Updated');
      expect(result.description).toBe('New desc');
    });
  });

  describe('delete()', () => {
    it('should delete a prompt', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({ message: 'Deleted' });

      const result = await promptsApi.delete(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/prompts/1');
      expect(result.message).toBe('Deleted');
    });
  });

  describe('Integration scenarios', () => {
    it('should create → update → delete prompt', async () => {
      const createParams: CreatePromptParams = {
        title: 'New Prompt',
        content: 'Content',
      };

      const updateParams: UpdatePromptParams = {
        title: 'Updated Prompt',
      };

      const createdPrompt = createMockPrompt({ id: 20, ...createParams });
      const updatedPrompt = createMockPrompt({ id: 20, title: 'Updated Prompt' });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(createdPrompt);
      vi.mocked(mockApiClient.put).mockResolvedValueOnce(updatedPrompt);
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({ message: 'Deleted' });

      const created = await promptsApi.create(createParams);
      expect(created.title).toBe('New Prompt');

      const updated = await promptsApi.update(created.id, updateParams);
      expect(updated.title).toBe('Updated Prompt');

      const deleted = await promptsApi.delete(updated.id);
      expect(deleted.message).toBe('Deleted');
    });
  });
});
