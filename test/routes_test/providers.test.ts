import request from 'supertest';
import { Express } from 'express';
import express from 'express';

// Mock errorHandler middleware FIRST
jest.mock('../../src/middleware/errorHandler', () => {
  const errorHandler = (err: any, req: any, res: any, next: any) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  };

  const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  class AppError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return {
    errorHandler,
    asyncHandler,
    AppError
  };
});

// Mock the ProvidersService
const mockCreateProvider = jest.fn();
const mockCreateModel = jest.fn();
const mockUpdateModel = jest.fn();
const mockUpdateProvider = jest.fn();
const mockDeleteProviderOrModel = jest.fn();
const mockGetAllProviders = jest.fn();
const mockGetAllModels = jest.fn();
const mockGetAvailableModels = jest.fn();
const mockGetModelsByProviderId = jest.fn();

jest.mock('../../src/services/providers_service', () => {
  return {
    ProvidersService: jest.fn().mockImplementation(() => ({
      createProvider: mockCreateProvider,
      createModel: mockCreateModel,
      updateModel: mockUpdateModel,
      updateProvider: mockUpdateProvider,
      deleteProviderOrModel: mockDeleteProviderOrModel,
      getAllProviders: mockGetAllProviders,
      getAllModels: mockGetAllModels,
      getAvailableModels: mockGetAvailableModels,
      getModelsByProviderId: mockGetModelsByProviderId
    }))
  };
});

describe('Providers Route', () => {
  let app: Express;

  beforeAll(async () => {
    const { default: providersRouter } = await import('../../src/routes/providers');
    const { errorHandler } = await import('../../src/middleware/errorHandler');
    
    app = express();
    app.use(express.json());
    app.use('/api/providers', providersRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockCreateProvider.mockResolvedValue({
      message: 'Provider created successfully',
      provider: { id: 1, name: 'OpenAI', apiBaseUrl: 'https://api.openai.com/v1' }
    });
    mockCreateModel.mockResolvedValue({
      message: 'Model created successfully',
      model: { id: 1, displayName: 'GPT-4', apiName: 'gpt-4' }
    });
    mockUpdateModel.mockResolvedValue({ id: 1, displayName: 'GPT-4 Updated' });
    mockUpdateProvider.mockResolvedValue({ id: 1, name: 'OpenAI Updated' });
    mockDeleteProviderOrModel.mockResolvedValue({ success: true });
    mockGetAllProviders.mockResolvedValue([
      { id: 1, name: 'OpenAI', apiBaseUrl: 'https://api.openai.com/v1' },
      { id: 2, name: 'Anthropic', apiBaseUrl: 'https://api.anthropic.com' }
    ]);
    mockGetAllModels.mockResolvedValue([
      { id: 1, displayName: 'GPT-4', apiName: 'gpt-4', customProviderId: 1 }
    ]);
    mockGetAvailableModels.mockResolvedValue({
      openai: {
        id: 1,
        name: 'OpenAI',
        apiBaseUrl: 'https://api.openai.com/v1',
        models: [{ id: 1, displayName: 'GPT-4', apiName: 'gpt-4' }]
      }
    });
    mockGetModelsByProviderId.mockResolvedValue({
      provider: { id: 1, name: 'OpenAI' },
      models: [{ id: 1, displayName: 'GPT-4', apiName: 'gpt-4' }]
    });
  });

  describe('POST /api/providers/provider - Create Provider', () => {
    it('should create a new provider successfully', async () => {
      const response = await request(app)
        .post('/api/providers/provider')
        .send({
          name: 'OpenAI',
          apiBaseUrl: 'https://api.openai.com/v1',
          envVarName: 'OPENAI_API_KEY'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('provider');
    });

    it('should validate required field: name', async () => {
      const response = await request(app)
        .post('/api/providers/provider')
        .send({ apiBaseUrl: 'https://api.openai.com/v1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should validate required field: apiBaseUrl', async () => {
      const response = await request(app)
        .post('/api/providers/provider')
        .send({ name: 'OpenAI' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('apiBaseUrl');
    });

    it('should accept optional envVarName', async () => {
      await request(app)
        .post('/api/providers/provider')
        .send({
          name: 'OpenAI',
          apiBaseUrl: 'https://api.openai.com/v1',
          envVarName: 'OPENAI_API_KEY'
        });

      expect(mockCreateProvider).toHaveBeenCalled();
    });

    it('should handle service error', async () => {
      mockCreateProvider.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/providers/provider')
        .send({
          name: 'OpenAI',
          apiBaseUrl: 'https://api.openai.com/v1'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/providers/:providerId/model - Create Model', () => {
    it('should create a new model for provider', async () => {
      const response = await request(app)
        .post('/api/providers/1/model')
        .send({
          displayName: 'GPT-4',
          apiName: 'gpt-4',
          approved: true
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('model');
    });

    it('should validate required displayName', async () => {
      const response = await request(app)
        .post('/api/providers/1/model')
        .send({ apiName: 'gpt-4' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('displayName');
    });

    it('should validate required apiName', async () => {
      const response = await request(app)
        .post('/api/providers/1/model')
        .send({ displayName: 'GPT-4' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('apiName');
    });

    it('should pass correct providerId to service', async () => {
      await request(app)
        .post('/api/providers/5/model')
        .send({
          displayName: 'GPT-4',
          apiName: 'gpt-4'
        });

      expect(mockCreateModel).toHaveBeenCalledWith(
        5,
        expect.any(Object)
      );
    });

    it('should handle service error', async () => {
      mockCreateModel.mockRejectedValueOnce(new Error('Provider not found'));

      const response = await request(app)
        .post('/api/providers/999/model')
        .send({
          displayName: 'GPT-4',
          apiName: 'gpt-4'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/providers/models/:id - Update Model', () => {
    it('should update model successfully', async () => {
      const response = await request(app)
        .put('/api/providers/models/1')
        .send({
          displayName: 'GPT-4 Turbo',
          apiName: 'gpt-4-turbo'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated');
    });

    it('should validate model ID format', async () => {
      const response = await request(app)
        .put('/api/providers/models/invalid')
        .send({ displayName: 'GPT-4' });

      expect(response.status).toBe(400);
    });

    it('should reject zero model ID', async () => {
      const response = await request(app)
        .put('/api/providers/models/0')
        .send({ displayName: 'GPT-4' });

      expect(response.status).toBe(400);
    });

    it('should pass correct ID to service', async () => {
      await request(app)
        .put('/api/providers/models/5')
        .send({ displayName: 'Updated' });

      expect(mockUpdateModel).toHaveBeenCalledWith(5, expect.any(Object));
    });

    it('should handle service error', async () => {
      mockUpdateModel.mockRejectedValueOnce(new Error('Model not found'));

      const response = await request(app)
        .put('/api/providers/models/999')
        .send({ displayName: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/providers/provider-model - Delete Provider or Model', () => {
    it('should delete provider with all models', async () => {
      const response = await request(app)
        .delete('/api/providers/provider-model')
        .query({ providerId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Provider');
      expect(mockDeleteProviderOrModel).toHaveBeenCalledWith({
        providerId: 1,
        modelId: undefined
      });
    });

    it('should delete single model', async () => {
      const response = await request(app)
        .delete('/api/providers/provider-model')
        .query({ modelId: 5 });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Model');
      expect(mockDeleteProviderOrModel).toHaveBeenCalledWith({
        providerId: undefined,
        modelId: 5
      });
    });

    it('should reject if neither providerId nor modelId provided', async () => {
      const response = await request(app)
        .delete('/api/providers/provider-model');

      expect(response.status).toBe(400);
    });

    it('should handle service error', async () => {
      mockDeleteProviderOrModel.mockRejectedValueOnce(new Error('Delete failed'));

      const response = await request(app)
        .delete('/api/providers/provider-model?providerId=1');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/providers/all_providers - Get All Providers', () => {
    it('should retrieve all providers', async () => {
      const response = await request(app).get('/api/providers/all_providers');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should handle empty provider list', async () => {
      mockGetAllProviders.mockResolvedValueOnce([]);

      const response = await request(app).get('/api/providers/all_providers');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should handle service error', async () => {
      mockGetAllProviders.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/api/providers/all_providers');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/providers/provider-model - Get Providers with Models', () => {
    it('should retrieve providers with their models', async () => {
      const response = await request(app).get('/api/providers/provider-model');

      expect(response.status).toBe(200);
      expect(typeof response.body.data).toBe('object');
    });

    it('should include models in response', async () => {
      const response = await request(app).get('/api/providers/provider-model');

      expect(response.body.data.openai).toHaveProperty('models');
      expect(Array.isArray(response.body.data.openai.models)).toBe(true);
    });

    it('should handle service error', async () => {
      mockGetAvailableModels.mockRejectedValueOnce(new Error('Query failed'));

      const response = await request(app).get('/api/providers/provider-model');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/providers/:providerId/models - Get Models by Provider', () => {
    it('should retrieve models for specific provider', async () => {
      const response = await request(app).get('/api/providers/1/models');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('provider');
      expect(response.body).toHaveProperty('models');
      expect(Array.isArray(response.body.models)).toBe(true);
    });

    it('should validate providerId format', async () => {
      const response = await request(app).get('/api/providers/invalid/models');

      expect(response.status).toBe(400);
    });

    it('should reject zero providerId', async () => {
      const response = await request(app).get('/api/providers/0/models');

      expect(response.status).toBe(400);
    });

    it('should pass correct providerId to service', async () => {
      await request(app).get('/api/providers/5/models');

      expect(mockGetModelsByProviderId).toHaveBeenCalledWith(5);
    });

    it('should handle provider not found error', async () => {
      mockGetModelsByProviderId.mockRejectedValueOnce(new Error('Not found'));

      const response = await request(app).get('/api/providers/999/models');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/providers/models - Get All Models', () => {
    it('should retrieve all models', async () => {
      const response = await request(app).get('/api/providers/models');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should include model properties', async () => {
      const response = await request(app).get('/api/providers/models');

      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('displayName');
      expect(response.body.data[0]).toHaveProperty('apiName');
    });

    it('should handle service error', async () => {
      mockGetAllModels.mockRejectedValueOnce(new Error('Query failed'));

      const response = await request(app).get('/api/providers/models');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/providers/:id - Update Provider', () => {
    it('should update provider successfully', async () => {
      const response = await request(app)
        .put('/api/providers/1')
        .send({
          name: 'OpenAI Updated',
          apiBaseUrl: 'https://api.openai.com/v2'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated');
    });

    it('should validate provider ID format', async () => {
      const response = await request(app)
        .put('/api/providers/invalid')
        .send({ name: 'Updated' });

      expect(response.status).toBe(400);
    });

    it('should reject zero provider ID', async () => {
      const response = await request(app)
        .put('/api/providers/0')
        .send({ name: 'Updated' });

      expect(response.status).toBe(400);
    });

    it('should accept name update', async () => {
      await request(app)
        .put('/api/providers/1')
        .send({ name: 'OpenAI New' });

      expect(mockUpdateProvider).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('should accept apiBaseUrl update', async () => {
      await request(app)
        .put('/api/providers/1')
        .send({ apiBaseUrl: 'https://api.new.com' });

      expect(mockUpdateProvider).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('should pass correct provider ID to service', async () => {
      await request(app)
        .put('/api/providers/5')
        .send({ name: 'Updated' });

      expect(mockUpdateProvider).toHaveBeenCalledWith(5, expect.any(Object));
    });

    it('should handle provider not found error', async () => {
      mockUpdateProvider.mockRejectedValueOnce(new Error('Not found'));

      const response = await request(app)
        .put('/api/providers/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });

    it('should return updated provider data', async () => {
      const response = await request(app)
        .put('/api/providers/1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle create provider and model flow', async () => {
      const providerRes = await request(app)
        .post('/api/providers/provider')
        .send({ name: 'Test', apiBaseUrl: 'https://test.com' });

      expect(providerRes.status).toBe(201);

      const modelRes = await request(app)
        .post('/api/providers/1/model')
        .send({ displayName: 'Test Model', apiName: 'test-model' });

      expect(modelRes.status).toBe(201);
    });

    it('should handle get all and update flows', async () => {
      const getAllRes = await request(app).get('/api/providers/all_providers');
      expect(getAllRes.status).toBe(200);

      const updateRes = await request(app)
        .put('/api/providers/1')
        .send({ name: 'Updated' });

      expect(updateRes.status).toBe(200);
    });

    it('should handle create, update and delete flows', async () => {
      const createRes = await request(app)
        .post('/api/providers/1/model')
        .send({ displayName: 'Test', apiName: 'test' });

      expect(createRes.status).toBe(201);

      const updateRes = await request(app)
        .put('/api/providers/models/1')
        .send({ displayName: 'Updated' });

      expect(updateRes.status).toBe(200);

      const deleteRes = await request(app)
        .delete('/api/providers/provider-model?modelId=1');

      expect(deleteRes.status).toBe(200);
    });
  });

  describe('HTTP Status Codes', () => {
    it('POST /provider returns 201', async () => {
      const res = await request(app)
        .post('/api/providers/provider')
        .send({ name: 'Test', apiBaseUrl: 'https://test.com' });
      expect(res.status).toBe(201);
    });

    it('POST /:providerId/model returns 201', async () => {
      const res = await request(app)
        .post('/api/providers/1/model')
        .send({ displayName: 'Test', apiName: 'test' });
      expect(res.status).toBe(201);
    });

    it('PUT /models/:id returns 200', async () => {
      const res = await request(app)
        .put('/api/providers/models/1')
        .send({ displayName: 'Updated' });
      expect(res.status).toBe(200);
    });

    it('PUT /:id returns 200', async () => {
      const res = await request(app)
        .put('/api/providers/1')
        .send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });

    it('DELETE /provider-model returns 200', async () => {
      const res = await request(app)
        .delete('/api/providers/provider-model?providerId=1');
      expect(res.status).toBe(200);
    });

    it('GET endpoints return 200', async () => {
      expect((await request(app).get('/api/providers/all_providers')).status).toBe(200);
      expect((await request(app).get('/api/providers/models')).status).toBe(200);
      expect((await request(app).get('/api/providers/1/models')).status).toBe(200);
      expect((await request(app).get('/api/providers/provider-model')).status).toBe(200);
    });
  });
});
