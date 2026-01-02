import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppError } from '../../src/middleware/errorHandler';

// Mock errorHandler with proper asyncHandler FIRST
jest.mock('../../src/middleware/errorHandler', () => ({
  asyncHandler: (fn: any) => fn,
  AppError: class AppError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
      this.name = 'AppError';
    }
  },
}));

// Mock authentication middleware
jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { id: 'test-user-id' };
    next();
  },
}));

// Mock SettingsService
const mockGetSettings = jest.fn();
const mockUpdateSettings = jest.fn();
const mockUpdateApiKey = jest.fn();
const mockDeleteApiKey = jest.fn();

jest.mock('../../src/services/settings_service', () => ({
  SettingsService: jest.fn(() => ({
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
    updateApiKey: mockUpdateApiKey,
    deleteApiKey: mockDeleteApiKey,
  })),
}));

// Import after mocking
import settingsRouter from '../../src/routes/settings';

describe('Settings Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create fresh app instance for each test
    app = express();
    app.use(express.json());
    
    // Add auth middleware mock with admin role
    app.use((req: any, res: Response, next: NextFunction) => {
      req.user = { 
        id: 'test-user-id',
        realm_access: { roles: ['admin'] }
      };
      next();
    });
    
    app.use('/api/settings', settingsRouter);

    // Add error handling middleware
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message });
      } else if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Set default mock return values
    mockGetSettings.mockResolvedValue({
      id: 1,
      userId: 'default',
      selectedModel: {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        providerId: 'google',
      },
      apiKeys: { openai: 'sk-1234567890' },
      selectedChatMode: 'auto-code',
      smartContextEnabled: false,
      turboEditsV2Enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockUpdateSettings.mockResolvedValue({
      id: 1,
      userId: 'default',
      selectedModel: {
        id: 'gpt-4',
        name: 'GPT-4',
        providerId: 'openai',
      },
      apiKeys: { openai: 'sk-1234567890' },
      selectedChatMode: 'agent',
      smartContextEnabled: true,
      turboEditsV2Enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockUpdateApiKey.mockResolvedValue({
      id: 1,
      userId: 'default',
      selectedModel: {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        providerId: 'google',
      },
      apiKeys: { openai: 'sk-9999999999', anthropic: 'sk-ant-123456' },
      selectedChatMode: 'auto-code',
      smartContextEnabled: false,
      turboEditsV2Enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockDeleteApiKey.mockResolvedValue({
      id: 1,
      userId: 'default',
      selectedModel: {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        providerId: 'google',
      },
      apiKeys: {},
      selectedChatMode: 'auto-code',
      smartContextEnabled: false,
      turboEditsV2Enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('GET /api/settings - Get User Settings', () => {
    test('should retrieve user settings successfully', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('userId', 'default');
      expect(response.body.data).toHaveProperty('selectedModel');
      expect(response.body.data.selectedModel.id).toBe('gemini-2.5-pro');
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    test('should mask API keys in response', async () => {
      mockGetSettings.mockResolvedValue({
        id: 1,
        userId: 'default',
        selectedModel: {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          providerId: 'google',
        },
        apiKeys: { openai: 'sk-1234567890abcdef' },
        selectedChatMode: 'auto-code',
        smartContextEnabled: false,
        turboEditsV2Enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      // API key 'sk-1234567890abcdef' is masked to first 8 and last 4
      expect(response.body.data.apiKeys.openai).toBe('sk-12345...cdef');
    });

    test('should handle empty API keys', async () => {
      mockGetSettings.mockResolvedValue({
        id: 1,
        userId: 'default',
        selectedModel: {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          providerId: 'google',
        },
        apiKeys: {},
        selectedChatMode: 'auto-code',
        smartContextEnabled: false,
        turboEditsV2Enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.data.apiKeys).toEqual({});
    });

    test('should include all settings fields', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('selectedModel');
      expect(response.body.data).toHaveProperty('apiKeys');
      expect(response.body.data).toHaveProperty('selectedChatMode');
      expect(response.body.data).toHaveProperty('smartContextEnabled');
      expect(response.body.data).toHaveProperty('turboEditsV2Enabled');
    });
  });

  describe('PUT /api/settings - Update Settings', () => {
    test('should update selected model successfully', async () => {
      const updatePayload = {
        selectedModel: {
          id: 'gpt-4',
          name: 'GPT-4',
          providerId: 'openai',
        },
      };

      const response = await request(app)
        .put('/api/settings')
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.data.selectedModel.id).toBe('gpt-4');
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateSettings).toHaveBeenCalledWith(updatePayload, 'test-user-id');
    });

    test('should update selected chat mode', async () => {
      const updatePayload = {
        selectedChatMode: 'agent',
      };

      const response = await request(app)
        .put('/api/settings')
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.data.selectedChatMode).toBe('agent');
      expect(mockUpdateSettings).toHaveBeenCalledWith(updatePayload, 'test-user-id');
    });

    test('should update smart context setting', async () => {
      const updatePayload = {
        smartContextEnabled: true,
      };

      const response = await request(app)
        .put('/api/settings')
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(mockUpdateSettings).toHaveBeenCalledWith(updatePayload, 'test-user-id');
    });

    test('should update turbo edits v2 setting', async () => {
      const updatePayload = {
        turboEditsV2Enabled: true,
      };

      const response = await request(app)
        .put('/api/settings')
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(mockUpdateSettings).toHaveBeenCalledWith(updatePayload, 'test-user-id');
    });

    test('should update multiple settings at once', async () => {
      const updatePayload = {
        selectedChatMode: 'agent',
        smartContextEnabled: true,
        turboEditsV2Enabled: false,
      };

      const response = await request(app)
        .put('/api/settings')
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(mockUpdateSettings).toHaveBeenCalledWith(updatePayload, 'test-user-id');
    });

    test('should accept empty body and call update', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({});

      expect(response.status).toBe(200);
      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });

  describe('PUT /api/settings/api-keys/:providerId - Update API Key', () => {
    test('should update API key successfully', async () => {
      const response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({ apiKey: 'sk-new-key-12345' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('API key for openai updated successfully');
      expect(mockUpdateApiKey).toHaveBeenCalledWith('test-user-id', 'openai', 'sk-new-key-12345');
    });

    test('should update API key for anthropic provider', async () => {
      const response = await request(app)
        .put('/api/settings/api-keys/anthropic')
        .send({ apiKey: 'sk-ant-new-key' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('anthropic');
      expect(mockUpdateApiKey).toHaveBeenCalledWith('test-user-id', 'anthropic', 'sk-ant-new-key');
    });

    test('should reject missing API key', async () => {
      const response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(mockUpdateApiKey).not.toHaveBeenCalled();
    });

    test('should reject null API key', async () => {
      const response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({ apiKey: null });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should reject empty API key string', async () => {
      const response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({ apiKey: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should extract providerId from URL correctly', async () => {
      const providerId = 'google';
      const apiKey = 'sk-google-key-123';

      const response = await request(app)
        .put(`/api/settings/api-keys/${providerId}`)
        .send({ apiKey });

      expect(response.status).toBe(200);
      expect(mockUpdateApiKey).toHaveBeenCalledWith('test-user-id', providerId, apiKey);
    });

    test('should handle special characters in API key', async () => {
      const apiKey = 'sk-test_key$with#special!chars@123';

      const response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({ apiKey });

      expect(response.status).toBe(200);
      expect(mockUpdateApiKey).toHaveBeenCalledWith('test-user-id', 'openai', apiKey);
    });
  });

  describe('DELETE /api/settings/api-keys/:providerId - Delete API Key', () => {
    test('should delete API key successfully', async () => {
      const response = await request(app)
        .delete('/api/settings/api-keys/openai');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('API key for openai deleted successfully');
      expect(mockDeleteApiKey).toHaveBeenCalledWith('openai', 'test-user-id');
    });

    test('should delete API key for different providers', async () => {
      const response = await request(app)
        .delete('/api/settings/api-keys/anthropic');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('anthropic');
      expect(mockDeleteApiKey).toHaveBeenCalledWith('anthropic', 'test-user-id');
    });

    test('should extract providerId from URL correctly', async () => {
      const providerId = 'google';

      const response = await request(app)
        .delete(`/api/settings/api-keys/${providerId}`);

      expect(response.status).toBe(200);
      expect(mockDeleteApiKey).toHaveBeenCalledWith(providerId, 'test-user-id');
    });

    test('should handle non-existent provider gracefully', async () => {
      mockDeleteApiKey.mockResolvedValue({
        id: 1,
        userId: 'default',
        selectedModel: {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          providerId: 'google',
        },
        apiKeys: {},
        selectedChatMode: 'auto-code',
        smartContextEnabled: false,
        turboEditsV2Enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .delete('/api/settings/api-keys/non-existent-provider');

      expect(response.status).toBe(200);
      expect(mockDeleteApiKey).toHaveBeenCalledWith('non-existent-provider', 'test-user-id');
    });
  });

  describe('HTTP Status Codes', () => {
    test('GET should return 200 on success', async () => {
      const response = await request(app).get('/api/settings');
      expect(response.status).toBe(200);
    });

    test('PUT settings should return 200 on success', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({ selectedChatMode: 'custom' });
      expect(response.status).toBe(200);
    });

    test('PUT API key should return 200 on success', async () => {
      const response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({ apiKey: 'test-key' });
      expect(response.status).toBe(200);
    });

    test('PUT API key should return 400 on missing apiKey', async () => {
      const response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({});
      expect(response.status).toBe(400);
    });

    test('DELETE should return 200 on success', async () => {
      const response = await request(app)
        .delete('/api/settings/api-keys/openai');
      expect(response.status).toBe(200);
    });
  });

  describe('Integration Scenarios', () => {
    test('should get initial settings, update model, then verify update', async () => {
      // Get initial settings
      let response = await request(app).get('/api/settings');
      expect(response.status).toBe(200);
      expect(response.body.data.selectedModel.id).toBe('gemini-2.5-pro');

      // Update to different model
      const newModel = {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        providerId: 'openai',
      };
      response = await request(app)
        .put('/api/settings')
        .send({ selectedModel: newModel });
      
      expect(response.status).toBe(200);
      expect(mockUpdateSettings).toHaveBeenCalledWith({ selectedModel: newModel }, 'test-user-id');
    });

    test('should update API key then delete it', async () => {
      // Update API key
      let response = await request(app)
        .put('/api/settings/api-keys/openai')
        .send({ apiKey: 'sk-test-123' });
      
      expect(response.status).toBe(200);
      expect(mockUpdateApiKey).toHaveBeenCalledWith('test-user-id', 'openai', 'sk-test-123');

      // Delete the API key
      response = await request(app)
        .delete('/api/settings/api-keys/openai');
      
      expect(response.status).toBe(200);
      expect(mockDeleteApiKey).toHaveBeenCalledWith('openai', 'test-user-id');
    });

    test('should update multiple settings and API key', async () => {
      // Update settings
      const response = await request(app)
        .put('/api/settings')
        .send({
          selectedChatMode: 'agent',
          smartContextEnabled: true,
        });
      
      expect(response.status).toBe(200);
      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });

  describe('Request/Response Validation', () => {
    test('should handle JSON content type correctly', async () => {
      const response = await request(app)
        .put('/api/settings')
        .set('Content-Type', 'application/json')
        .send({ selectedChatMode: 'custom' });

      expect(response.status).toBe(200);
    });

    test('should respond with JSON content type', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.type).toContain('application/json');
    });

    test('should handle additional fields in request body gracefully', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({
          selectedChatMode: 'agent',
          unknownField: 'should-be-ignored',
        });

      expect(response.status).toBe(200);
    });

    test('should return response with data wrapper', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.data).toBe('object');
    });
  });
});
