/**
 * Apps Routes Test Suite
 * Complete test coverage for all apps.ts endpoints
 */

import request from 'supertest';
import express, { Express } from 'express';
import { AppService } from '../../src/services/app_service';
import { AppError } from '../../src/middleware/errorHandler';

// Mock auth middleware
jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  },
}));

// Setup mocks before importing routes
jest.mock('../../src/services/app_service');

// Mock containerization services to prevent dynamic import errors
jest.mock('../../src/services/containerization_service', () => ({
  ContainerizationService: {
    getInstance: jest.fn(() => ({
      isEnabled: jest.fn(() => false),
      runContainer: jest.fn().mockResolvedValue({}),
    })),
  },
}));

jest.mock('../../src/services/container_lifecycle_service', () => ({
  ContainerLifecycleService: {
    getInstance: jest.fn(() => ({
      allocatePort: jest.fn().mockResolvedValue(3000),
    })),
  },
}));

let app: Express;
let mockAppService: any;

describe('Apps Routes Tests', () => {
  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Setup mock AppService
    mockAppService = {
      getTemplates: jest.fn(),
      listApps: jest.fn(),
      getApp: jest.fn(),
      createApp: jest.fn(),
      updateApp: jest.fn(),
      deleteApp: jest.fn(),
      searchApps: jest.fn(),
      toggleFavorite: jest.fn(),
      getFullAppPath: jest.fn().mockReturnValue('/full/path'),
    };

    (AppService as jest.MockedClass<typeof AppService>).mockImplementation(() => mockAppService);

    // Import and mount router
    const appsRouter = (await import('../../src/routes/apps')).default;
    app.use('/api/apps', appsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/apps/templates', () => {
    it('should return available templates', async () => {
      const templates = [
        { id: '1', name: 'vite-react-shadcn', description: 'Vite with React and shadcn' },
        { id: '2', name: 'blank', description: 'Blank template' },
      ];

      mockAppService.getTemplates.mockResolvedValue(templates);

      const response = await request(app)
        .get('/api/apps/templates')
        .expect(200);

      expect(response.body.data).toEqual(templates);
      expect(mockAppService.getTemplates).toHaveBeenCalled();
    });

    it('should handle errors when fetching templates', async () => {
      mockAppService.getTemplates.mockRejectedValue(
        new AppError(500, 'Failed to fetch templates')
      );

      await request(app)
        .get('/api/apps/templates')
        .expect(500);
    });
  });

  describe('GET /api/apps', () => {
    it('should return all apps', async () => {
      const apps = [
        {
          id: 1,
          name: 'App 1',
          path: './app1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'App 2',
          path: './app2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];

      mockAppService.listApps.mockResolvedValue(apps);

      const response = await request(app)
        .get('/api/apps')
        .expect(200);

      expect(response.body.data).toEqual(apps);
      expect(mockAppService.listApps).toHaveBeenCalled();
    });

    it('should return empty list when no apps exist', async () => {
      mockAppService.listApps.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/apps')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle errors when fetching apps', async () => {
      mockAppService.listApps.mockRejectedValue(
        new AppError(500, 'Database error')
      );

      await request(app)
        .get('/api/apps')
        .expect(500);
    });
  });

  describe('GET /api/apps/search', () => {
    it('should search apps by name', async () => {
      const searchResults = [
        {
          id: 1,
          name: 'Test App',
          path: './test-app',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];

      mockAppService.searchApps.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/apps/search?name=Test')
        .expect(200);

      expect(response.body.data).toEqual(searchResults);
      expect(mockAppService.searchApps).toHaveBeenCalledWith('Test', 'test-user-id');
    });

    it('should return empty array when search has no matches', async () => {
      mockAppService.searchApps.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/apps/search?name=NonExistent')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should return 400 when name query param is missing', async () => {
      const response = await request(app)
        .get('/api/apps/search')
        .expect(400);

      expect(response.body.error).toContain("Query param 'name' is required");
    });

    it('should return 400 when name query param is empty', async () => {
      const response = await request(app)
        .get('/api/apps/search?name=')
        .expect(400);

      expect(response.body.error).toContain("Query param 'name' is required");
    });

    it('should return 400 when name param is only whitespace', async () => {
      const response = await request(app)
        .get('/api/apps/search?name=%20%20%20')
        .expect(400);

      expect(response.body.error).toContain("Query param 'name' is required");
    });

    it('should handle errors when searching apps', async () => {
      mockAppService.searchApps.mockRejectedValue(
        new AppError(500, 'Search failed')
      );

      await request(app)
        .get('/api/apps/search?name=test')
        .expect(500);
    });
  });

  describe('GET /api/apps/:id', () => {
    it('should retrieve a single app by id', async () => {
      const app_data = {
        id: 1,
        name: 'My App',
        path: './my-app',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockAppService.getApp.mockResolvedValue(app_data);

      const response = await request(app)
        .get('/api/apps/1')
        .expect(200);

      expect(response.body.data).toEqual(app_data);
      expect(mockAppService.getApp).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should return 404 when app not found', async () => {
      mockAppService.getApp.mockRejectedValue(
        new AppError(404, 'App not found: 999')
      );

      await request(app)
        .get('/api/apps/999')
        .expect(404);
    });

    it('should handle errors when retrieving app', async () => {
      mockAppService.getApp.mockRejectedValue(
        new AppError(500, 'Database error')
      );

      await request(app)
        .get('/api/apps/1')
        .expect(500);
    });
  });

  describe('POST /api/apps', () => {
    it('should create a new app', async () => {
      const createPayload = {
        name: 'New App',
        path: './new-app',
        template: 'vite-react-shadcn',
      };

      const createdApp = {
        id: 3,
        ...createPayload,
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.createApp.mockResolvedValue(createdApp);

      const response = await request(app)
        .post('/api/apps')
        .send(createPayload)
        .expect(201);

      expect(response.body.data).toEqual(createdApp);
      expect(mockAppService.createApp).toHaveBeenCalledWith({ ...createPayload, userId: 'test-user-id' });
    });

    it('should create app with minimal required fields', async () => {
      const createPayload = {
        name: 'Minimal App',
        path: './minimal-app',
      };

      const createdApp = {
        id: 4,
        ...createPayload,
        template: 'vite-react-shadcn',
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.createApp.mockResolvedValue(createdApp);

      const response = await request(app)
        .post('/api/apps')
        .send(createPayload)
        .expect(201);

      expect(response.body.data.id).toBe(4);
      expect(response.body.data.name).toBe('Minimal App');
    });

    it('should create app with all optional fields', async () => {
      const createPayload = {
        name: 'Full App',
        path: './full-app',
        template: 'blank',
        githubOrg: 'myorg',
        githubRepo: 'myrepo',
        installCommand: 'npm install',
        startCommand: 'npm start',
      };

      const createdApp = {
        id: 5,
        ...createPayload,
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.createApp.mockResolvedValue(createdApp);

      const response = await request(app)
        .post('/api/apps')
        .send(createPayload)
        .expect(201);

      expect(response.body.data).toEqual(createdApp);
      // Note: githubOrg and githubRepo are not in createAppSchema, so they won't be passed to service
      const expectedPayload = {
        name: 'Full App',
        path: './full-app',
        template: 'blank',
        installCommand: 'npm install',
        startCommand: 'npm start',
        userId: 'test-user-id',
      };
      expect(mockAppService.createApp).toHaveBeenCalledWith(expectedPayload);
    });

    it('should return 400 on invalid app data', async () => {
      mockAppService.createApp.mockRejectedValue(
        new AppError(400, 'Invalid app data')
      );

      await request(app)
        .post('/api/apps')
        .send({ name: '' })
        .expect(400);
    });

    it('should handle server errors during app creation', async () => {
      mockAppService.createApp.mockRejectedValue(
        new AppError(500, 'Failed to create app')
      );

      await request(app)
        .post('/api/apps')
        .send({ name: 'Test', path: './test' })
        .expect(500);
    });
  });

  describe('PUT /api/apps/:id', () => {
    it('should update app name', async () => {
      const updatePayload = { name: 'Updated App' };

      const updatedApp = {
        id: 1,
        name: 'Updated App',
        path: './app1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.updateApp.mockResolvedValue(updatedApp);

      const response = await request(app)
        .put('/api/apps/1')
        .send(updatePayload)
        .expect(200);

      expect(response.body.data).toEqual(updatedApp);
      expect(mockAppService.updateApp).toHaveBeenCalledWith(1, 'test-user-id', updatePayload);
    });

    it('should update app path', async () => {
      const updatePayload = { path: './new-path' };

      const updatedApp = {
        id: 1,
        name: 'App 1',
        path: './new-path',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.updateApp.mockResolvedValue(updatedApp);

      const response = await request(app)
        .put('/api/apps/1')
        .send(updatePayload)
        .expect(200);

      expect(response.body.data.path).toBe('./new-path');
      expect(mockAppService.updateApp).toHaveBeenCalledWith(1, 'test-user-id', updatePayload);
    });

    it('should toggle favorite status', async () => {
      const updatePayload = { isFavorite: true };

      const updatedApp = {
        id: 1,
        name: 'App 1',
        path: './app1',
        isFavorite: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.updateApp.mockResolvedValue(updatedApp);

      const response = await request(app)
        .put('/api/apps/1')
        .send(updatePayload)
        .expect(200);

      expect(response.body.data.isFavorite).toBe(true);
    });

    it('should handle multiple field updates', async () => {
      const updatePayload = {
        name: 'New Name',
        path: './new-path',
        isFavorite: true,
        installCommand: 'npm install',
      };

      const updatedApp = {
        id: 1,
        ...updatePayload,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.updateApp.mockResolvedValue(updatedApp);

      const response = await request(app)
        .put('/api/apps/1')
        .send(updatePayload)
        .expect(200);

      expect(response.body.data).toEqual(updatedApp);
      expect(mockAppService.updateApp).toHaveBeenCalledWith(1, 'test-user-id', updatePayload);
    });

    it('should return 404 when app to update not found', async () => {
      mockAppService.updateApp.mockRejectedValue(
        new AppError(404, 'App not found: 999')
      );

      await request(app)
        .put('/api/apps/999')
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 400 on invalid update data', async () => {
      mockAppService.updateApp.mockRejectedValue(
        new AppError(400, 'Invalid update data')
      );

      await request(app)
        .put('/api/apps/1')
        .send({ name: '' })
        .expect(400);
    });

    it('should handle server errors during update', async () => {
      mockAppService.updateApp.mockRejectedValue(
        new AppError(500, 'Failed to update app')
      );

      await request(app)
        .put('/api/apps/1')
        .send({ name: 'Updated' })
        .expect(500);
    });
  });

  describe('DELETE /api/apps/:id', () => {
    it('should delete an app', async () => {
      const deleteResult = {
        success: true,
        message: 'App deleted successfully',
      };

      mockAppService.deleteApp.mockResolvedValue(deleteResult);

      const response = await request(app)
        .delete('/api/apps/1')
        .expect(200);

      expect(response.body).toEqual(deleteResult);
      expect(mockAppService.deleteApp).toHaveBeenCalledWith(1, 'test-user-id');
    });

    it('should return 404 when app to delete not found', async () => {
      mockAppService.deleteApp.mockRejectedValue(
        new AppError(404, 'App not found: 999')
      );

      await request(app)
        .delete('/api/apps/999')
        .expect(404);
    });

    it('should handle server errors during deletion', async () => {
      mockAppService.deleteApp.mockRejectedValue(
        new AppError(500, 'Failed to delete app')
      );

      await request(app)
        .delete('/api/apps/1')
        .expect(500);
    });
  });

  describe('POST /api/apps/:id/favorite', () => {
    it('should toggle favorite status to true', async () => {
      const favoritedApp = {
        id: 1,
        name: 'App 1',
        path: './app1',
        isFavorite: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.toggleFavorite.mockResolvedValue(favoritedApp);

      const response = await request(app)
        .post('/api/apps/1/favorite')
        .expect(200);

      expect(response.body.data).toEqual(favoritedApp);
      expect(response.body.data.isFavorite).toBe(true);
      expect(mockAppService.toggleFavorite).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should toggle favorite status to false', async () => {
      const unfavoritedApp = {
        id: 1,
        name: 'App 1',
        path: './app1',
        isFavorite: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      mockAppService.toggleFavorite.mockResolvedValue(unfavoritedApp);

      const response = await request(app)
        .post('/api/apps/1/favorite')
        .expect(200);

      expect(response.body.data.isFavorite).toBe(false);
    });

    it('should return 404 when app not found', async () => {
      mockAppService.toggleFavorite.mockRejectedValue(
        new AppError(404, 'App not found: 999')
      );

      await request(app)
        .post('/api/apps/999/favorite')
        .expect(404);
    });

    it('should handle server errors during toggle', async () => {
      mockAppService.toggleFavorite.mockRejectedValue(
        new AppError(500, 'Failed to toggle favorite')
      );

      await request(app)
        .post('/api/apps/1/favorite')
        .expect(500);
    });
  });
});
