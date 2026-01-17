import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appsApi, App, CreateAppParams, UpdateAppParams, CopyAppParams } from '../endpoints/apps';
import * as apiClientModule from '../client';

// Mock the apiClient module
vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

/**
 * Unit tests for appsApi
 * Tests all endpoints: list, get, create, update, delete, copy, toggleFavorite, search
 * Uses vitest with mocking for api client calls
 */
describe('appsApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock app data
  const createMockApp = (overrides?: Partial<App>): App => ({
    id: 1,
    userId: 1,
    name: 'Test App',
    path: '/path/to/app',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    githubOrg: null,
    githubRepo: null,
    githubBranch: null,
    supabaseProjectId: null,
    supabaseParentProjectId: null,
    neonProjectId: null,
    neonDevelopmentBranchId: null,
    neonPreviewBranchId: null,
    vercelProjectId: null,
    vercelProjectName: null,
    vercelDeploymentUrl: null,
    installCommand: null,
    startCommand: null,
    isFavorite: false,
    ...overrides,
  });

  describe('list() - Fetch all apps', () => {
    it('should successfully fetch all apps', async () => {
      const mockApps = [
        createMockApp({ id: 1, name: 'App 1' }),
        createMockApp({ id: 2, name: 'App 2' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ apps: mockApps });

      const result = await appsApi.list();

      expect(mockApiClient.get).toHaveBeenCalledOnce();
      expect(mockApiClient.get).toHaveBeenCalledWith('/apps');
      expect(result.apps).toHaveLength(2);
      expect(result.apps[0].name).toBe('App 1');
      expect(result.apps[1].name).toBe('App 2');
    });

    it('should return empty apps array when no apps exist', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ apps: [] });

      const result = await appsApi.list();

      expect(result.apps).toEqual([]);
    });

    it('should throw error on network failure', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValueOnce(new Error('Network error'));

      await expect(appsApi.list()).rejects.toThrow('Network error');
    });
  });

  describe('get() - Fetch single app', () => {
    it('should fetch app by id', async () => {
      const mockApp = createMockApp({ id: 5 });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockApp);

      const result = await appsApi.get(5);

      expect(mockApiClient.get).toHaveBeenCalledWith('/apps/5');
      expect(result.id).toBe(5);
    });

    it('should fetch app with all fields populated', async () => {
      const mockApp = createMockApp({
        id: 10,
        githubOrg: 'myorg',
        githubRepo: 'myrepo',
        githubBranch: 'main',
        supabaseProjectId: 'sup-123',
        vercelProjectId: 'vercel-123',
        vercelProjectName: 'My Project',
        installCommand: 'npm install',
        startCommand: 'npm start',
        isFavorite: true,
      });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockApp);

      const result = await appsApi.get(10);

      expect(result.githubOrg).toBe('myorg');
      expect(result.vercelProjectName).toBe('My Project');
      expect(result.isFavorite).toBe(true);
    });

    it('should throw error when app not found', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValueOnce(new Error('Not found'));

      await expect(appsApi.get(999)).rejects.toThrow('Not found');
    });
  });

  describe('create() - Create new app', () => {
    it('should create app with minimal params', async () => {
      const params: CreateAppParams = { name: 'New App' };
      const mockApp = createMockApp({ id: 20, name: 'New App' });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockApp);

      const result = await appsApi.create(params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps', params);
      expect(result.name).toBe('New App');
      expect(result.id).toBe(20);
    });

    it('should create app with all github params', async () => {
      const params: CreateAppParams = {
        name: 'GitHub App',
        path: '/path/to/github-app',
        githubOrg: 'dyad-sh',
        githubRepo: 'dyad',
        githubBranch: 'develop',
        installCommand: 'npm install',
        startCommand: 'npm start',
      };

      const mockApp = createMockApp({
        id: 21,
        ...params,
      });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockApp);

      const result = await appsApi.create(params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps', params);
      expect(result.githubOrg).toBe('dyad-sh');
      expect(result.githubBranch).toBe('develop');
    });

    it('should handle validation errors on creation', async () => {
      const params: CreateAppParams = { name: '' };

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(new Error('Invalid name'));

      await expect(appsApi.create(params)).rejects.toThrow('Invalid name');
    });
  });

  describe('update() - Update app', () => {
    it('should update app name only', async () => {
      const params: UpdateAppParams = { name: 'Updated Name' };
      const mockApp = createMockApp({ id: 1, name: 'Updated Name' });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockApp);

      const result = await appsApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/apps/1', params);
      expect(result.name).toBe('Updated Name');
    });

    it('should update app with rename folder flag', async () => {
      const params: UpdateAppParams = {
        path: '/new/path',
        renameFolder: true,
      };
      const mockApp = createMockApp({ id: 1, path: '/new/path' });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockApp);

      const result = await appsApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/apps/1', params);
      expect(result.path).toBe('/new/path');
    });

    it('should update app favorite status', async () => {
      const params: UpdateAppParams = { isFavorite: true };
      const mockApp = createMockApp({ id: 1, isFavorite: true });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockApp);

      const result = await appsApi.update(1, params);

      expect(result.isFavorite).toBe(true);
    });

    it('should update app with chat context', async () => {
      const chatContext = { conversationId: 'abc123', messages: [] };
      const params: UpdateAppParams = { chatContext };
      const mockApp = createMockApp({ id: 1, chatContext });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockApp);

      const result = await appsApi.update(1, params);

      expect(result.chatContext).toEqual(chatContext);
    });

    it('should throw error on update failure', async () => {
      const params: UpdateAppParams = { name: 'New Name' };

      vi.mocked(mockApiClient.put).mockRejectedValueOnce(new Error('Update failed'));

      await expect(appsApi.update(1, params)).rejects.toThrow('Update failed');
    });
  });

  describe('delete() - Delete app', () => {
    it('should delete app successfully', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({
        message: 'App deleted successfully',
      });

      const result = await appsApi.delete(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/apps/1');
      expect(result.message).toBe('App deleted successfully');
    });

    it('should throw error when app not found for deletion', async () => {
      vi.mocked(mockApiClient.delete).mockRejectedValueOnce(new Error('Not found'));

      await expect(appsApi.delete(999)).rejects.toThrow('Not found');
    });
  });

  describe('copy() - Copy app', () => {
    it('should copy app with default name', async () => {
      const params: CopyAppParams = {};
      const mockApp = createMockApp({ id: 30, name: 'Test App (Copy)' });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockApp);

      const result = await appsApi.copy(1, params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/copy', params);
      expect(result.id).toBe(30);
      expect(result.name).toContain('Copy');
    });

    it('should copy app with custom name', async () => {
      const params: CopyAppParams = { name: 'My Copy' };
      const mockApp = createMockApp({ id: 31, name: 'My Copy' });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockApp);

      const result = await appsApi.copy(1, params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/copy', params);
      expect(result.name).toBe('My Copy');
    });

    it('should throw error when copy fails', async () => {
      vi.mocked(mockApiClient.post).mockRejectedValueOnce(new Error('Copy failed'));

      await expect(appsApi.copy(1, {})).rejects.toThrow('Copy failed');
    });
  });

  describe('toggleFavorite() - Toggle favorite status', () => {
    it('should toggle favorite to true', async () => {
      const mockApp = createMockApp({ id: 1, isFavorite: true });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockApp);

      const result = await appsApi.toggleFavorite(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/apps/1/favorite');
      expect(result.isFavorite).toBe(true);
    });

    it('should toggle favorite to false', async () => {
      const mockApp = createMockApp({ id: 1, isFavorite: false });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockApp);

      const result = await appsApi.toggleFavorite(1);

      expect(result.isFavorite).toBe(false);
    });

    it('should throw error on toggle failure', async () => {
      vi.mocked(mockApiClient.post).mockRejectedValueOnce(new Error('Toggle failed'));

      await expect(appsApi.toggleFavorite(1)).rejects.toThrow('Toggle failed');
    });
  });

  describe('search() - Search apps by name', () => {
    it('should search and return matching apps', async () => {
      const mockApps = [
        createMockApp({ id: 1, name: 'TestApp' }),
        createMockApp({ id: 2, name: 'Test Project' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockApps);

      const result = await appsApi.search('Test');

      expect(mockApiClient.get).toHaveBeenCalledWith('/apps/search', {
        params: { name: 'Test' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValueOnce([]);

      const result = await appsApi.search('NonExistent');

      expect(result).toEqual([]);
    });

    it('should handle case-insensitive search', async () => {
      const mockApp = createMockApp({ name: 'MyApp' });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce([mockApp]);

      await appsApi.search('myapp');

      expect(mockApiClient.get).toHaveBeenCalledWith('/apps/search', {
        params: { name: 'myapp' },
      });
    });

    it('should throw error when search fails', async () => {
      vi.mocked(mockApiClient.get).mockRejectedValueOnce(
        new Error('Search service error'),
      );

      await expect(appsApi.search('test')).rejects.toThrow('Search service error');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle sequence: create -> update -> toggleFavorite', async () => {
      const createParams: CreateAppParams = { name: 'My App' };
      const updateParams: UpdateAppParams = { name: 'My Updated App' };

      const createdApp = createMockApp({ id: 40, name: 'My App' });
      const updatedApp = createMockApp({ id: 40, name: 'My Updated App' });
      const favoritedApp = createMockApp({ id: 40, name: 'My Updated App', isFavorite: true });

      vi.mocked(mockApiClient.post)
        .mockResolvedValueOnce(createdApp)
        .mockResolvedValueOnce(favoritedApp);

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(updatedApp);

      const created = await appsApi.create(createParams);
      expect(created.name).toBe('My App');

      const updated = await appsApi.update(created.id, updateParams);
      expect(updated.name).toBe('My Updated App');

      const favorited = await appsApi.toggleFavorite(updated.id);
      expect(favorited.isFavorite).toBe(true);
    });

    it('should handle sequence: list -> get -> copy', async () => {
      const mockApps = [createMockApp({ id: 1 })];
      const singleApp = createMockApp({ id: 1 });
      const copiedApp = createMockApp({ id: 50, name: 'Test App (Copy)' });

      vi.mocked(mockApiClient.get)
        .mockResolvedValueOnce({ apps: mockApps })
        .mockResolvedValueOnce(singleApp);

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(copiedApp);

      const listed = await appsApi.list();
      expect(listed.apps).toHaveLength(1);

      const fetched = await appsApi.get(listed.apps[0].id);
      expect(fetched.id).toBe(1);

      const copied = await appsApi.copy(fetched.id, {});
      expect(copied.id).toBe(50);
    });
  });
});
