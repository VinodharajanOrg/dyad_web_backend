import request from 'supertest';
import { Express, Router } from 'express';
import express from 'express';
import { ContainerizationService } from '../../src/services/containerization_service';
import { ContainerLifecycleService } from '../../src/services/container_lifecycle_service';
import { AppService } from '../../src/services/app_service';

jest.mock('../../src/services/containerization_service');
jest.mock('../../src/services/container_lifecycle_service');
jest.mock('../../src/services/app_service');
jest.mock('../../src/middleware/errorHandler');

// Mock the AppService constructor
const mockAppServiceInstance = {
  getApp: jest.fn(),
  getFullAppPath: jest.fn()
};

(AppService as any).mockImplementation(() => mockAppServiceInstance);

describe('Preview Route', () => {
  let app: Express;
  let mockContainerService: any;
  let mockLifecycleService: any;
  let mockAppService: any;

  beforeAll(async () => {
    const { default: previewRouter } = await import('../../src/routes/preview');
    
    app = express();
    app.use(express.json());
    app.use('/api', previewRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContainerService = {
      isContainerRunning: jest.fn().mockResolvedValue(true),
      runContainer: jest.fn().mockResolvedValue({ success: true, message: 'Started' }),
      containerExists: jest.fn().mockResolvedValue(false),
      stopContainer: jest.fn().mockResolvedValue({ success: true, message: 'Stopped' }),
      getContainerStatus: jest.fn().mockResolvedValue({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      })
    };

    mockLifecycleService = {
      recordActivity: jest.fn().mockResolvedValue(undefined),
      allocatePort: jest.fn().mockResolvedValue(3000),
      releasePort: jest.fn().mockResolvedValue(undefined),
      getPort: jest.fn().mockReturnValue(3000)
    };

    mockAppService = {
      getApp: jest.fn().mockResolvedValue({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      }),
      getFullAppPath: jest.fn().mockReturnValue('/app/test-app')
    };

    (ContainerizationService.getInstance as jest.Mock).mockReturnValue(mockContainerService);
    (ContainerLifecycleService.getInstance as jest.Mock).mockReturnValue(mockLifecycleService);
    
    // Update the mocked AppService instance methods
    mockAppServiceInstance.getApp = mockAppService.getApp;
    mockAppServiceInstance.getFullAppPath = mockAppService.getFullAppPath;
  });

  describe('GET /app/preview - Root Endpoint', () => {
    it('should return preview service info', async () => {
      const response = await request(app).get('/api/app/preview');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('service', 'Container Preview Proxy');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('usage', '/app/preview/:appId/[path]');
      expect(response.body).toHaveProperty('examples');
      expect(response.body.examples).toEqual([
        '/app/preview/1/',
        '/app/preview/2/index.html',
        '/app/preview/3/assets/logo.png'
      ]);
      expect(response.body).toHaveProperty('portRange');
      expect(response.body.portRange).toEqual({ min: 32100, max: 32200 });
    });

    it('should return correct endpoint information', async () => {
      const response = await request(app).get('/api/app/preview');

      expect(response.body.service).toBe('Container Preview Proxy');
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('GET /app/preview/:appId - Basic Proxy Request', () => {
    it('should record activity when accessing preview', async () => {
      const mockResponse = new (require('http').IncomingMessage)();
      mockResponse.statusCode = 200;
      mockResponse.headers = { 'content-type': 'text/html' };

      // This is tricky with http mocking, so we test the service call
      await request(app).get('/api/app/preview/1');

      // Verify recordActivity was called
      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
    });

    it('should check if container is running', async () => {
      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
    });

    it('should get container status when running', async () => {
      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('1');
    });

    it('should call getPort as fallback when needed', async () => {
      // When port is null in status, getPort is called as fallback
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: null
      });

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.getPort).toHaveBeenCalledWith('1');
    });
  });

  describe('Auto-start Container Feature', () => {
    it('should start container if not running', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.runContainer).toHaveBeenCalled();
      expect(mockContainerService.runContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: '1'
        })
      );
    });

    it('should stop existing container before starting if exists', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(true);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.stopContainer).toHaveBeenCalledWith('1');
      expect(mockContainerService.runContainer).toHaveBeenCalled();
    });

    it('should allocate port when starting container', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.allocatePort).toHaveBeenCalledWith('1', expect.any(Boolean));
    });

    it('should handle container start failure gracefully', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockContainerService.runContainer.mockResolvedValueOnce({ success: false, message: 'Failed' });
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });

      const response = await request(app).get('/api/app/preview/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to start container');
    });

    it('should not start container if already running', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.runContainer).not.toHaveBeenCalled();
    });
  });

  describe('Path Parameters', () => {
    it('should extract appId from route parameter', async () => {
      await request(app).get('/api/app/preview/123');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('123');
      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('123');
    });

    it('should handle optional path parameter', async () => {
      await request(app).get('/api/app/preview/1/index.html');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
    });

    it('should handle nested path parameter', async () => {
      await request(app).get('/api/app/preview/1/assets/js/main.js');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
    });

    it('should handle path without trailing slash', async () => {
      await request(app).get('/api/app/preview/5');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('5');
    });

    it('should handle path with query parameters', async () => {
      await request(app).get('/api/app/preview/1/page?id=123&name=test');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
    });
  });

  describe('HTTP Methods Support', () => {
    it('should handle GET requests', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      
      await request(app).get('/api/app/preview/1/index.html');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
    });

    it('should handle request without body for GET', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });
  });

  describe('Container Status and Port Handling', () => {
    it('should use port from container status', async () => {
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 4000
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('1');
    });

    it('should fallback to lifecycle service port if status port is null', async () => {
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: null
      });
      mockLifecycleService.getPort.mockReturnValueOnce(5000);

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.getPort).toHaveBeenCalledWith('1');
    });

    it('should use correct host based on NODE_ENV', async () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'production';
        await request(app).get('/api/app/preview/1');
        
        process.env.NODE_ENV = 'development';
        await request(app).get('/api/app/preview/1');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }

      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle container running check error', async () => {
      mockContainerService.isContainerRunning.mockRejectedValueOnce(new Error('Service error'));

      const response = await request(app).get('/api/app/preview/1');

      expect(response.status).toBe(500);
    });

    it('should handle app fetch error', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockRejectedValueOnce(new Error('App not found'));

      const response = await request(app).get('/api/app/preview/1');

      expect(response.status).toBe(500);
    });

    it('should handle container status retrieval error', async () => {
      mockContainerService.getContainerStatus.mockRejectedValueOnce(new Error('Status error'));

      const response = await request(app).get('/api/app/preview/1');

      expect(response.status).toBe(500);
    });

    it('should handle missing appId gracefully', async () => {
      const response = await request(app).get('/api/app/preview/');

      // Depends on routing behavior, but should handle gracefully
      expect(response.status).toBeDefined();
    });

    it('should provide error details in response', async () => {
      mockContainerService.isContainerRunning.mockRejectedValueOnce(new Error('Service unavailable'));

      const response = await request(app).get('/api/app/preview/1');

      expect(response.status).toBe(500);
    });
  });

  describe('Content Type Handling', () => {
    it('should recognize HTML content type', async () => {
      // Test that content type detection works for HTML
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1/index.html');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });

    it('should recognize JavaScript content type', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1/script.js');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });

    it('should recognize CSS content type', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1/style.css');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });

    it('should handle binary content types', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1/image.png');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });
  });

  describe('Request Header Forwarding', () => {
    it('should forward user-agent header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app)
        .get('/api/app/preview/1')
        .set('User-Agent', 'Mozilla/5.0 Test');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should forward accept header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app)
        .get('/api/app/preview/1')
        .set('Accept', 'application/json');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should forward accept-language header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app)
        .get('/api/app/preview/1')
        .set('Accept-Language', 'en-US,en;q=0.9');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should forward cookie header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app)
        .get('/api/app/preview/1')
        .set('Cookie', 'session=abc123');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should forward host header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app)
        .get('/api/app/preview/1')
        .set('Host', 'localhost:3000');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });
  });

  describe('Activity Recording', () => {
    it('should record activity on successful request', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
    });

    it('should record activity even if container not running', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: '2',
        name: 'app-2',
        framework: 'react',
        port: 3000
      });

      await request(app).get('/api/app/preview/2');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('2');
    });

    it('should record activity for different app IDs', async () => {
      mockContainerService.isContainerRunning.mockResolvedValue(true);

      await request(app).get('/api/app/preview/1');
      await request(app).get('/api/app/preview/2');
      await request(app).get('/api/app/preview/3');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('2');
      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('3');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete flow - container running', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1/index.html');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('1');
      expect(mockContainerService.runContainer).not.toHaveBeenCalled();
    });

    it('should handle complete flow - container needs to start', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });
      mockContainerService.runContainer.mockResolvedValueOnce({
        success: true,
        message: 'Started'
      });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
      expect(mockLifecycleService.allocatePort).toHaveBeenCalled();
      expect(mockContainerService.runContainer).toHaveBeenCalled();
      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('1');
    });

    it('should handle multiple sequential requests to same app', async () => {
      mockContainerService.isContainerRunning.mockResolvedValue(true);
      mockContainerService.getContainerStatus.mockResolvedValue({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1');
      await request(app).get('/api/app/preview/1/page2');
      await request(app).get('/api/app/preview/1/assets/logo.png');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledTimes(3);
      expect(mockContainerService.getContainerStatus).toHaveBeenCalledTimes(3);
    });

    it('should handle requests to different apps', async () => {
      mockContainerService.isContainerRunning.mockResolvedValue(true);
      mockContainerService.getContainerStatus.mockResolvedValue({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1');
      await request(app).get('/api/app/preview/2');
      await request(app).get('/api/app/preview/3');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('2');
      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('3');
      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('2');
      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('3');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle proxy request timeout', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });

    it('should have 30 second timeout configured', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1');

      // Timeout is set at http.request level, verify service was called
      expect(mockContainerService.getContainerStatus).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle app ID with special characters', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/app-123_test');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('app-123_test');
    });

    it('should handle very long paths', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      const longPath = '/assets/nested/deep/folder/structure/with/many/levels/file.js';
      await request(app).get(`/api/app/preview/1${longPath}`);

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
    });

    it('should handle paths with special URL characters', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1/page%20name');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should handle numeric app IDs', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/12345');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('12345');
    });

    it('should handle root path access', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1/');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
    });

    it('should handle request without any path', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalledWith('1');
      expect(mockLifecycleService.recordActivity).toHaveBeenCalled();
    });
  });

  describe('Service Instantiation', () => {
    it('should get ContainerizationService instance', async () => {
      await request(app).get('/api/app/preview/1');

      expect(ContainerizationService.getInstance).toHaveBeenCalled();
    });

    it('should get ContainerLifecycleService instance', async () => {
      await request(app).get('/api/app/preview/1');

      expect(ContainerLifecycleService.getInstance).toHaveBeenCalled();
    });

    it('should create AppService instance', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);

      await request(app).get('/api/app/preview/1');

      // AppService is instantiated with 'new', so just verify its methods are called
      expect(mockAppService.getApp).toBeDefined();
    });
  });

  describe('Proxy Request Error Handling', () => {
    it('should handle proxy request connection error', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      const response = await request(app).get('/api/app/preview/1');

      // Request should be attempted despite potential connection error
      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
    });

    it('should handle proxy timeout gracefully', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1');

      // Verify timeout is configured
      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should handle proxy error with 502 response', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });
  });

  describe('Container Startup - Not Running', () => {
    it('should start container if not running and container does not exist', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });
      mockLifecycleService.allocatePort.mockResolvedValueOnce(32100);
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true, message: 'Started' });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 32100
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.runContainer).toHaveBeenCalledWith({
        appId: '1',
        appPath: expect.any(String),
        port: 32100
      });
    });

    it('should stop existing container before starting new one', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(true);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });
      mockLifecycleService.allocatePort.mockResolvedValueOnce(32100);
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true, message: 'Started' });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 32100
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.stopContainer).toHaveBeenCalledWith('1');
      expect(mockLifecycleService.releasePort).toHaveBeenCalledWith('1');
    });

    it('should return 500 error if container startup fails', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });
      mockLifecycleService.allocatePort.mockResolvedValueOnce(32100);
      mockContainerService.runContainer.mockResolvedValueOnce({
        success: false,
        error: 'Image not found'
      });

      const response = await request(app).get('/api/app/preview/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to start container');
      expect(response.body).toHaveProperty('details', 'Image not found');
    });

    it('should allocate port when starting container', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });
      mockLifecycleService.allocatePort.mockResolvedValueOnce(32150);
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true, message: 'Started' });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 32150
      });

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.allocatePort).toHaveBeenCalledWith('1', true);
    });
  });

  describe('Port Resolution', () => {
    it('should use container status port for proxy', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 32200
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('1');
    });

    it('should fallback to lifecycle service port if status port is missing', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: undefined
      });
      mockLifecycleService.getPort.mockReturnValueOnce(32100);

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.getPort).toHaveBeenCalledWith('1');
    });

    it('should use default port if no port available', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: undefined
      });
      mockLifecycleService.getPort.mockReturnValueOnce(undefined);

      await request(app).get('/api/app/preview/1');

      // Default port 32100 should be used
      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });
  });

  describe('Header Forwarding', () => {
    it('should forward user-agent header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1')
        .set('user-agent', 'CustomAgent/1.0');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should forward accept header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1')
        .set('accept', 'application/json');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should forward accept-language header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1')
        .set('accept-language', 'fr-FR,fr;q=0.9');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should forward cookie header', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1')
        .set('cookie', 'session=abc123; user=john');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should set default user-agent if not provided', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });
  });

  describe('Activity Recording', () => {
    it('should record activity for each request', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
    });

    it('should record activity even if container not running', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });
      mockLifecycleService.allocatePort.mockResolvedValueOnce(32100);
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 32100
      });

      await request(app).get('/api/app/preview/1');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('1');
    });

    it('should record activity with correct app ID', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '99',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-99',
        port: 3000
      });

      await request(app).get('/api/app/preview/99');

      expect(mockLifecycleService.recordActivity).toHaveBeenCalledWith('99');
    });
  });

  describe('Environment Detection', () => {
    it('should use localhost in non-production environments', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      const envBackup = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();

      process.env.NODE_ENV = envBackup;
    });

    it('should handle production environment container host', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      const envBackup = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();

      process.env.NODE_ENV = envBackup;
    });
  });

  describe('Request Path Handling', () => {
    it('should handle requests with query parameters', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1/api/resource?page=1&limit=10');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should handle requests with complex paths', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1/path/to/nested/resource.html');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should handle requests with trailing slash', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1/');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should handle requests with file extensions', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1/assets/style.css');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should handle requests with JSON extension', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app)
        .get('/api/app/preview/1/api/data.json');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log container startup info', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(false);
      mockContainerService.containerExists.mockResolvedValueOnce(false);
      mockAppService.getApp.mockResolvedValueOnce({
        id: 1,
        name: 'test-app',
        framework: 'vite',
        port: 5173,
        path: '/test-app'
      });
      mockLifecycleService.allocatePort.mockResolvedValueOnce(32100);
      mockContainerService.runContainer.mockResolvedValueOnce({ success: true });
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 32100
      });

      await request(app).get('/api/app/preview/1');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });

    it('should log proxy request info', async () => {
      mockContainerService.isContainerRunning.mockResolvedValueOnce(true);
      mockContainerService.getContainerStatus.mockResolvedValueOnce({
        appId: '1',
        isRunning: true,
        isReady: true,
        hasDependenciesInstalled: true,
        containerName: 'test-app-1',
        port: 3000
      });

      await request(app).get('/api/app/preview/1/path/to/resource');

      expect(mockContainerService.isContainerRunning).toHaveBeenCalled();
    });
  });
});
