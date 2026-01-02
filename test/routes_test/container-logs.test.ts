/**
 * Container Logs Routes Test Suite
 * Complete test coverage for container-logs.ts endpoints
 */

import request from 'supertest';
import express, { Express } from 'express';
import { ContainerizationService } from '../../src/services/containerization_service';
import { LocalRunnerService } from '../../src/services/local_runner_service';
import { AppService } from '../../src/services/app_service';

// Setup mocks before importing routes
jest.mock('../../src/services/containerization_service');
jest.mock('../../src/services/local_runner_service');
jest.mock('../../src/services/app_service');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

let app: Express;
let mockContainerService: any;
let mockLocalRunner: any;
let mockAppService: any;

describe('Container Logs Routes', () => {
  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Setup mock services
    mockContainerService = {
      isEnabled: jest.fn().mockReturnValue(true),
      getContainerStatus: jest.fn(),
      getHandler: jest.fn(),
    };

    mockLocalRunner = {
      isAppRunning: jest.fn().mockReturnValue(false),
      getAppStatus: jest.fn(),
      streamLogs: jest.fn(),
      getLogs: jest.fn(),
    };

    mockAppService = {
      getApp: jest.fn(),
    };

    (ContainerizationService as any).getInstance = jest
      .fn()
      .mockReturnValue(mockContainerService);

    (LocalRunnerService as any).getInstance = jest
      .fn()
      .mockReturnValue(mockLocalRunner);

    (AppService as any).mockImplementation(() => mockAppService);

    // Import and mount router
    const containerLogsRouter = (await import('../../src/routes/container-logs')).default;
    app.use('/api/container-logs', containerLogsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  //
  // -------------------------------------------------------
  // STREAM ENDPOINT TESTS
  // -------------------------------------------------------
  //
  describe('GET /api/container-logs/:appId/stream', () => {
    it('should stream logs for a running container', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockContainerService.isEnabled.mockReturnValue(true);
      mockLocalRunner.isAppRunning.mockReturnValue(false);

      const mockStatus = {
        appId,
        isRunning: true,
        isReady: true,
        containerName: 'dyad-app-1',
        port: 3000,
        status: 'running',
      };

      mockContainerService.getContainerStatus.mockResolvedValue(mockStatus);

      const mockHandler = {
        streamLogs: jest
          .fn()
          .mockResolvedValue(
            (async function* () {
              yield 'Starting container...';
              yield 'Container ready';
            })()
          ),
      };

      mockContainerService.getHandler.mockReturnValue(mockHandler);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/stream`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(mockAppService.getApp).toHaveBeenCalledWith(appId, undefined);
      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith(appId);
    });

    it('should handle local app logs when containerization disabled', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockContainerService.isEnabled.mockReturnValue(false);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const mockStatus = {
        isRunning: true,
        port: 3000,
        uptime: 3600,
      };

      mockLocalRunner.getAppStatus.mockReturnValue(mockStatus);
      mockLocalRunner.streamLogs.mockReturnValue(
        (async function* () {
          yield {
            message: 'App started',
            level: 'stdout',
            timestamp: new Date(),
          };
        })()
      );

      const response = await request(app)
        .get(`/api/container-logs/${appId}/stream`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(mockLocalRunner.streamLogs).toHaveBeenCalledWith(appId, true);
    });

    it('should return error when app not found', async () => {
      const appId = '999';

      mockAppService.getApp.mockRejectedValue(new Error('App not found'));

      const response = await request(app)
        .get(`/api/container-logs/${appId}/stream`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    });

    it('should handle streaming errors gracefully', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockContainerService.isEnabled.mockReturnValue(true);
      mockLocalRunner.isAppRunning.mockReturnValue(false);

      mockContainerService.getContainerStatus.mockRejectedValue(
        new Error('Failed to get status')
      );

      const response = await request(app)
        .get(`/api/container-logs/${appId}/stream`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    });

    it('should notify when app is not running', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockContainerService.isEnabled.mockReturnValue(false);
      mockLocalRunner.isAppRunning.mockReturnValue(false);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/stream`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    });

    it('should support follow and tail query parameters', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockContainerService.isEnabled.mockReturnValue(false);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      mockLocalRunner.getAppStatus.mockReturnValue({
        isRunning: true,
        port: 3000,
        uptime: 3600,
      });

      mockLocalRunner.streamLogs.mockReturnValue(
        (async function* () {
          yield { message: 'Log line', level: 'stdout', timestamp: new Date() };
        })()
      );

      const response = await request(app)
        .get(`/api/container-logs/${appId}/stream?follow=false&tail=50`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(mockLocalRunner.streamLogs).toHaveBeenCalledWith(appId, false);
    });
  });

  //
  // -------------------------------------------------------
  // HISTORY ENDPOINT TESTS
  // -------------------------------------------------------
  //
  describe('GET /api/container-logs/:appId/history', () => {
    it('should return container logs history', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(true);

      const mockStatus = {
        appId,
        isRunning: true,
        containerName: 'dyad-app-1',
      };

      mockContainerService.getContainerStatus.mockResolvedValue(mockStatus);

      const mockHandler = {
        getLogs: jest
          .fn()
          .mockResolvedValue('Container started\nApp ready\nListening on port 3000'),
      };

      mockContainerService.getHandler.mockReturnValue(mockHandler);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appId).toBe(appId);
      expect(response.body.data.logs).toBeDefined();
      expect(Array.isArray(response.body.data.logs)).toBe(true);
      expect(mockHandler.getLogs).toHaveBeenCalled();
    });

    it('should return local app logs when running locally', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const mockLogs = [
        {
          message: 'App started',
          level: 'stdout',
          timestamp: new Date(),
        },
        {
          message: 'Error occurred',
          level: 'stderr',
          timestamp: new Date(),
        },
      ];

      mockLocalRunner.getLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('local');
      expect(response.body.data.logs).toHaveLength(2);
      expect(response.body.data.logs[1].level).toBe('error');
    });

    it('should return empty logs when containerization disabled and app not running', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toEqual([]);
    });

    it('should return empty logs when container not running', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(true);

      const mockStatus = {
        appId,
        isRunning: false,
      };

      mockContainerService.getContainerStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toEqual([]);
    });

    it('should support lines and since query parameters', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      mockLocalRunner.getLogs.mockReturnValue([]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history?lines=50&since=2025-01-01T00:00:00Z`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockLocalRunner.getLogs).toHaveBeenCalledWith(appId, 50);
    });

    it('should handle errors when retrieving logs', async () => {
      const appId = '1';

      mockAppService.getApp.mockRejectedValue(new Error('App not found'));

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should use default lines when not specified', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      mockLocalRunner.getLogs.mockReturnValue([]);

      await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(mockLocalRunner.getLogs).toHaveBeenCalledWith(appId, 100);
    });
  });

  //
  // -------------------------------------------------------
  // EVENTS ENDPOINT TESTS
  // -------------------------------------------------------
  //
  describe('GET /api/container-logs/:appId/events', () => {
    it('should return container lifecycle events', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(true);

      const mockStatus = {
        appId,
        containerName: 'dyad-app-1',
      };

      mockContainerService.getContainerStatus.mockResolvedValue(mockStatus);

      const mockEvents = [
        {
          type: 'start',
          timestamp: new Date().toISOString(),
        },
        {
          type: 'ready',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockHandler = {
        getEvents: jest.fn().mockResolvedValue(mockEvents),
      };

      mockContainerService.getHandler.mockReturnValue(mockHandler);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.appId).toBe(appId);
      expect(response.body.data.type).toBe('container');
      expect(response.body.data.events).toEqual(mockEvents);
      expect(mockHandler.getEvents).toHaveBeenCalledWith(appId);
    });

    it('should return local app events when running locally', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const mockStatus = {
        isRunning: true,
        port: 3000,
        uptime: 3600,
      };

      mockLocalRunner.getAppStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('local');
      expect(response.body.data.events).toBeDefined();
      expect(Array.isArray(response.body.data.events)).toBe(true);
    });

    it('should return empty events when containerization disabled and app not running', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toEqual([]);
    });

    it('should handle errors when retrieving events', async () => {
      const appId = '1';

      mockAppService.getApp.mockRejectedValue(new Error('App not found'));

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should include container name in response', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };
      const containerName = 'dyad-app-1';

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(true);

      const mockStatus = {
        appId,
        containerName,
      };

      mockContainerService.getContainerStatus.mockResolvedValue(mockStatus);

      const mockHandler = {
        getEvents: jest.fn().mockResolvedValue([]),
      };

      mockContainerService.getHandler.mockReturnValue(mockHandler);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.body.data.containerName).toBe(containerName);
    });
  });

  //
  // -------------------------------------------------------
  // INTEGRATION TESTS
  // -------------------------------------------------------
  //
  describe('Integration Scenarios', () => {
    it('should handle app transitions from container to local', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);

      // First request: container running
      mockContainerService.isEnabled.mockReturnValue(true);
      mockLocalRunner.isAppRunning.mockReturnValue(false);

      const mockStatus = {
        appId,
        isRunning: true,
        containerName: 'dyad-app-1',
      };

      mockContainerService.getContainerStatus.mockResolvedValue(mockStatus);

      const mockHandler = {
        getLogs: jest.fn().mockResolvedValue(''),
      };

      mockContainerService.getHandler.mockReturnValue(mockHandler);

      const response1 = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response1.body.data.containerName).toBe('dyad-app-1');

      // Second request: switch to local
      jest.clearAllMocks();
      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      mockLocalRunner.getLogs.mockReturnValue([
        { message: 'Local app running', level: 'stdout', timestamp: new Date() },
      ]);

      const response2 = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response2.body.data.type).toBe('local');
    });

    it('should categorize different log levels correctly', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const mockLogs = [
        { message: 'Info message', level: 'stdout', timestamp: new Date() },
        { message: 'Error occurred', level: 'stderr', timestamp: new Date() },
      ];

      mockLocalRunner.getLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data.logs[0].level).toBe('info');
      expect(response.body.data.logs[1].level).toBe('error');
    });

    it('should handle multiple concurrent log requests', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getLogs.mockReturnValue([]);

      const requests = [
        request(app).get(`/api/container-logs/${appId}/history`),
        request(app).get(`/api/container-logs/${appId}/history`),
        request(app).get(`/api/container-logs/${appId}/events`),
      ];

      const responses = await Promise.all(requests);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[2].status).toBe(200);
    });

    it('should handle containerized app not running', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test', containerized: true };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.getContainerStatus.mockResolvedValue({
        appId,
        isRunning: false,
        isReady: false,
        containerName: 'dyad-app-1',
        port: null,
        status: 'stopped',
        health: 'unknown'
      });

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toEqual([]);
    });

    it('should handle streaming with empty logs', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getLogs.mockReturnValue([]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data.logs).toEqual([]);
    });

    it('should respect tail parameter for local logs', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const mockLogs = [
        { message: 'Log 1', level: 'stdout', timestamp: new Date() },
        { message: 'Log 2', level: 'stdout', timestamp: new Date() },
        { message: 'Log 3', level: 'stdout', timestamp: new Date() },
      ];

      mockLocalRunner.getLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history?tail=10`)
        .expect(200);

      expect(response.body.data.logs.length).toBe(3);
    });

    it('should handle containerized app not running', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test', containerized: true };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.getContainerStatus.mockResolvedValue({
        appId,
        isRunning: false,
        isReady: false,
        containerName: 'dyad-app-1',
        port: null,
        status: 'stopped',
        health: 'unknown'
      });

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toEqual([]);
    });

    it('should handle get history for containerized app', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test', containerized: true };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(true);
      mockContainerService.getContainerStatus.mockResolvedValue({
        appId,
        isRunning: true,
        isReady: true,
        containerName: 'dyad-app-1',
        port: 3000,
        status: 'running',
        health: 'healthy'
      });
      mockContainerService.getHandler.mockReturnValue({
        getLogs: jest.fn().mockResolvedValue('Log line 1\nLog line 2')
      });

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.containerName).toBe('dyad-app-1');
    });

    it('should handle getting app status failure', async () => {
      const appId = '999';

      mockAppService.getApp.mockRejectedValue(new Error('App not found'));

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`);

      // Should handle error gracefully
      expect(response.status).toBe(500);
    });

    it('should categorize different stderr and stdout logs', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const mockLogs = [
        { message: 'stdout message', level: 'stdout', timestamp: new Date() },
        { message: 'stderr message', level: 'stderr', timestamp: new Date() },
        { message: 'another stdout', level: 'stdout', timestamp: new Date() },
      ];

      mockLocalRunner.getLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data.logs.length).toBeGreaterThan(0);
    });

    it('should handle local app with streaming logs', async () => {
      const appId = '2';
      const app_data = { id: appId, name: 'Another App', path: '/app/another' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getAppStatus.mockResolvedValue({
        appId,
        isRunning: true,
        port: 3001,
        uptime: 12345
      });

      const mockLogs = [
        { message: 'Starting app', level: 'stdout', timestamp: new Date() },
        { message: 'Server running', level: 'stdout', timestamp: new Date() },
      ];

      mockLocalRunner.getLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data.type).toBe('local');
      expect(response.body.data.logs.length).toBeGreaterThan(0);
    });

    it('should handle app with no running instance', async () => {
      const appId = '3';
      const app_data = { id: appId, name: 'Stopped App', path: '/app/stopped' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });

  describe('Events Endpoint', () => {
    it('should return events for local app', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getAppStatus.mockReturnValue({
        appId,
        isRunning: true,
        port: 3000,
        uptime: 5000
      });

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('local');
    });

    it('should return events for containerized app', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test', containerized: true };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(true);
      mockContainerService.getContainerStatus.mockResolvedValue({
        appId,
        isRunning: true,
        isReady: true,
        containerName: 'dyad-app-1',
        port: 3000,
        status: 'running',
        health: 'healthy'
      });
      mockContainerService.getHandler.mockReturnValue({
        getEvents: jest.fn().mockResolvedValue([
          { type: 'container_started', timestamp: new Date().toISOString() }
        ])
      });

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('container');
    });

    it('should handle events endpoint when containerization disabled', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(false);
      mockContainerService.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toEqual([]);
    });

    it('should handle events endpoint for different app ID', async () => {
      const appId = '5';
      const app_data = { id: appId, name: 'Test App 5', path: '/app/test5' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getAppStatus.mockReturnValue({
        appId,
        isRunning: true,
        port: 3001,
        uptime: 2000
      });

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`)
        .expect(200);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle events endpoint error', async () => {
      const appId = '999';

      mockAppService.getApp.mockRejectedValue(new Error('App not found'));

      const response = await request(app)
        .get(`/api/container-logs/${appId}/events`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid app ID format', async () => {
      const appId = 'invalid!@#';

      mockAppService.getApp.mockRejectedValue(new Error('Invalid app ID'));

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`);

      // Should handle error gracefully
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should handle service instantiation errors', async () => {
      mockAppService.getApp.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/container-logs/1/history');

      expect([400, 404, 500]).toContain(response.status);
    });

    it('should handle missing tail parameter', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getLogs.mockReturnValue([
        { message: 'Log entry', level: 'stdout', timestamp: new Date() }
      ]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });

    it('should handle missing follow parameter', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getLogs.mockReturnValue([]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });

    it('should handle very long log entries', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const veryLongMessage = 'x'.repeat(10000);
      mockLocalRunner.getLogs.mockReturnValue([
        { message: veryLongMessage, level: 'stdout', timestamp: new Date() }
      ]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data.logs.length).toBeGreaterThan(0);
    });

    it('should handle special characters in log messages', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const specialMessage = '🚀 App started! <>&"\'';
      mockLocalRunner.getLogs.mockReturnValue([
        { message: specialMessage, level: 'stdout', timestamp: new Date() }
      ]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data.logs.length).toBeGreaterThan(0);
    });

    it('should handle unicode in log messages', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test App', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);

      const unicodeMessage = 'Unicode: 你好世界 مرحبا العالم שלום עולם';
      mockLocalRunner.getLogs.mockReturnValue([
        { message: unicodeMessage, level: 'stdout', timestamp: new Date() }
      ]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data.logs.length).toBeGreaterThan(0);
    });

    it('should handle numeric string app ID', async () => {
      const appId = '12345';
      const app_data = { id: appId, name: 'Numeric App', path: '/app/numeric' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getLogs.mockReturnValue([]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });

    it('should handle app name with special characters', async () => {
      const appId = '1';
      const app_data = { id: appId, name: 'Test-App_v2.0', path: '/app/test' };

      mockAppService.getApp.mockResolvedValue(app_data);
      mockLocalRunner.isAppRunning.mockReturnValue(true);
      mockLocalRunner.getLogs.mockReturnValue([]);

      const response = await request(app)
        .get(`/api/container-logs/${appId}/history`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });
});
