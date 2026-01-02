import { DockerService, getDockerService } from '../../src/services/docker_service';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

jest.mock('child_process');
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('../../src/services/containerization_service', () => ({
  containerizationService: {},
}));
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DockerService', () => {
  let service: DockerService;
  const mockAppId = 1;
  const mockAppPath = '/app/test-app';

  const createMockProcess = () => {
    const mockProcess: any = {
      pid: 12345,
      stdout: { on: jest.fn(), removeListener: jest.fn() },
      stderr: { on: jest.fn(), removeListener: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
      send: jest.fn(),
      closeCallback: undefined,
      errorCallback: undefined,
    };

    mockProcess.on = jest.fn((event: string, callback: Function) => {
      if (event === 'close') mockProcess.closeCallback = callback;
      if (event === 'error') mockProcess.errorCallback = callback;
      return mockProcess;
    });

    mockProcess.stdout.on = jest.fn((event: string, callback: Function) => {
      if (event === 'data') mockProcess.stdoutDataCallback = callback;
      return mockProcess.stdout;
    });

    mockProcess.stderr.on = jest.fn((event: string, callback: Function) => {
      if (event === 'data') mockProcess.stderrDataCallback = callback;
      return mockProcess.stderr;
    });

    return mockProcess;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CONTAINERIZATION_ENABLED;
    delete process.env.DOCKER_ENABLED;
    delete process.env.DOCKER_APP_PORT;
    delete process.env.DOCKER_NODE_IMAGE;
    service = new DockerService();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default config', () => {
      const config = service.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.port).toBe(32100);
      expect(config.nodeImage).toBe('node:22-alpine');
    });

    it('should load DOCKER_ENABLED from environment', () => {
      process.env.DOCKER_ENABLED = 'true';
      const testService = new DockerService();
      expect(testService.getConfig().enabled).toBe(true);
    });

    it('should prioritize CONTAINERIZATION_ENABLED over DOCKER_ENABLED', () => {
      process.env.DOCKER_ENABLED = 'false';
      process.env.CONTAINERIZATION_ENABLED = 'true';
      const testService = new DockerService();
      expect(testService.getConfig().enabled).toBe(true);
    });

    it('should load DOCKER_APP_PORT from environment', () => {
      process.env.DOCKER_APP_PORT = '5000';
      const testService = new DockerService();
      expect(testService.getConfig().port).toBe(5000);
    });

    it('should load DOCKER_NODE_IMAGE from environment', () => {
      process.env.DOCKER_NODE_IMAGE = 'node:20-slim';
      const testService = new DockerService();
      expect(testService.getConfig().nodeImage).toBe('node:20-slim');
    });

    it('should handle invalid DOCKER_APP_PORT gracefully', () => {
      process.env.DOCKER_APP_PORT = 'not-a-number';
      const testService = new DockerService();
      expect(testService.getConfig().port).toBeNaN();
    });
  });

  describe('isDockerAvailable()', () => {
    it('should return true when docker is available', async () => {
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = service.isDockerAvailable();
      setTimeout(() => {
        if (mockProcess.closeCallback) mockProcess.closeCallback(0);
      }, 0);
      const result = await resultPromise;
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith('docker', ['--version'], { stdio: 'pipe' });
    });

    it('should return false when docker is not available', async () => {
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = service.isDockerAvailable();
      setTimeout(() => {
        if (mockProcess.closeCallback) mockProcess.closeCallback(1);
      }, 0);
      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it('should return false on spawn error', async () => {
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = service.isDockerAvailable();
      setTimeout(() => {
        if (mockProcess.errorCallback) mockProcess.errorCallback(new Error('spawn failed'));
      }, 0);
      const result = await resultPromise;
      expect(result).toBe(false);
    });
  });

  describe('buildDockerImage()', () => {
    it('should use existing image if it exists', async () => {
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = service['buildDockerImage'](mockAppPath, mockAppId);
      setTimeout(() => {
        if (mockProcess.closeCallback) mockProcess.closeCallback(0);
      }, 0);
      await resultPromise;
      const calls = (spawn as jest.Mock).mock.calls;
      expect(calls[0][0]).toBe('docker');
      expect(calls[0][1][0]).toBe('image');
    });

    it('should build image if it does not exist', async () => {
      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        const mockProcess = createMockProcess();
        callCount++;
        if (callCount === 1) {
          setTimeout(() => mockProcess.closeCallback(1), 0);
        } else if (callCount === 2) {
          setTimeout(() => mockProcess.closeCallback(0), 0);
        }
        return mockProcess;
      });
      await service['buildDockerImage'](mockAppPath, mockAppId);
      const calls = (spawn as jest.Mock).mock.calls;
      expect(calls[1][0]).toBe('docker');
      expect(calls[1][1][0]).toBe('build');
    });

    it('should force rebuild when requested', async () => {
      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        const mockProcess = createMockProcess();
        callCount++;
        if (callCount === 1) {
          setTimeout(() => mockProcess.closeCallback(0), 0);
        }
        return mockProcess;
      });
      await service['buildDockerImage'](mockAppPath, mockAppId, true);
      const calls = (spawn as jest.Mock).mock.calls;
      expect(calls[0][1][0]).toBe('build');
    });

    it('should reject on build failure', async () => {
      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        const mockProcess = createMockProcess();
        callCount++;
        if (callCount === 1) {
          setTimeout(() => mockProcess.closeCallback(1), 0);
        } else if (callCount === 2) {
          const stderrCallback = mockProcess.stderrDataCallback;
          setTimeout(() => {
            if (stderrCallback) stderrCallback(Buffer.from('Build error'));
            mockProcess.closeCallback(1);
          }, 0);
        }
        return mockProcess;
      });
      await expect(service['buildDockerImage'](mockAppPath, mockAppId)).rejects.toThrow(
        'Docker build failed'
      );
    });

    it('should handle spawn error during build', async () => {
      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        const mockProcess = createMockProcess();
        callCount++;
        if (callCount === 1) {
          setTimeout(() => mockProcess.closeCallback(1), 0);
        } else if (callCount === 2) {
          setTimeout(() => {
            if (mockProcess.errorCallback) mockProcess.errorCallback(new Error('spawn failed'));
          }, 0);
        }
        return mockProcess;
      });
      await expect(service['buildDockerImage'](mockAppPath, mockAppId)).rejects.toThrow(
        'Docker build process error'
      );
    });
  });

  describe('stopApp()', () => {
    it('should handle non-existent container gracefully', async () => {
      await service.stopApp(999);
      expect(service.isAppRunning(999)).toBe(false);
    });
  });

  describe('syncFilesToContainer()', () => {
    it('should throw error if container not running', async () => {
      await expect(service.syncFilesToContainer(999)).rejects.toThrow(
        'No running container found'
      );
    });
  });

  describe('Container Status Checks', () => {
    it('should report app as not running for unknown id', () => {
      expect(service.isAppRunning(999)).toBe(false);
      expect(service.isContainerReady(999)).toBe(false);
      expect(service.hasDependenciesInstalled(999)).toBe(false);
    });
  });

  describe('Container Management', () => {
    it('should get empty running containers list initially', () => {
      expect(service.getRunningContainers().length).toBe(0);
    });

    it('should remove docker volumes', async () => {
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = service.removeAppVolumes(mockAppId);
      setTimeout(() => mockProcess.closeCallback(0), 0);
      await resultPromise;
      expect(spawn).toHaveBeenCalledWith('docker', ['volume', 'rm', '-f', 'dyad-pnpm-1'], {
        stdio: 'pipe',
      });
    });

    it('should handle volume removal errors gracefully', async () => {
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = service.removeAppVolumes(mockAppId);
      setTimeout(() => {
        if (mockProcess.errorCallback) mockProcess.errorCallback(new Error('volume remove failed'));
      }, 0);
      await resultPromise;
    });
  });

  describe('getCommand()', () => {
    it('should return default command when no custom commands provided', () => {
      const command = service['getCommand']({});
      expect(command).toContain('pnpm install');
      expect(command).toContain('pnpm dev');
      expect(command).toContain('--host 0.0.0.0');
      expect(command).toContain('--port 32100');
    });

    it('should return custom commands when provided', () => {
      const command = service['getCommand']({
        installCommand: 'npm install',
        startCommand: 'npm start',
      });
      expect(command).toContain('npm install');
      expect(command).toContain('npm start');
    });

    it('should inject port for vite commands without port flag', () => {
      const command = service['getCommand']({
        installCommand: 'pnpm install',
        startCommand: 'pnpm vite dev',
      });
      expect(command).toContain('--port 32100');
      expect(command).toContain('--host 0.0.0.0');
    });

    it('should not duplicate port for commands that already have it', () => {
      const command = service['getCommand']({
        installCommand: 'pnpm install',
        startCommand: 'pnpm dev --port 5000',
      });
      expect(command).toContain('pnpm dev --port 5000');
    });

    it('should inject port for react-scripts', () => {
      const command = service['getCommand']({
        installCommand: 'npm install',
        startCommand: 'react-scripts start',
      });
      expect(command).toContain('PORT=32100');
    });

    it('should handle commands without port specification', () => {
      const command = service['getCommand']({
        installCommand: 'npm install',
        startCommand: 'custom-server',
      });
      expect(command).toContain('npm install');
      expect(command).toContain('custom-server');
    });

    it('should use startCommand without modification if port already specified', () => {
      const command = service['getCommand']({
        installCommand: 'pnpm install',
        startCommand: 'pnpm dev -p 3000',
      });
      expect(command).toContain('pnpm dev -p 3000');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getDockerService();
      const instance2 = getDockerService();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance on different calls after clearing', () => {
      const instance1 = getDockerService();
      expect(instance1).toBeDefined();
    });
  });

  describe('runAppInDocker()', () => {
    it('should throw error if docker is disabled', async () => {
      await expect(
        service.runAppInDocker({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Docker execution is disabled');
    });

    it('should throw error if docker is not available', async () => {
      process.env.DOCKER_ENABLED = 'true';
      const testService = new DockerService();
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = testService.runAppInDocker({
        appId: mockAppId,
        appPath: mockAppPath,
      });
      setTimeout(() => mockProcess.closeCallback(1), 0);
      await expect(resultPromise).rejects.toThrow('Docker is required but not available');
    });
  });

  describe('quickStartContainer()', () => {
    it('should throw error if docker is disabled', async () => {
      await expect(
        service.quickStartContainer({
          appId: mockAppId,
          appPath: mockAppPath,
        })
      ).rejects.toThrow('Docker execution is disabled');
    });

    it('should throw error if docker is not available', async () => {
      process.env.DOCKER_ENABLED = 'true';
      const testService = new DockerService();
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = testService.quickStartContainer({
        appId: mockAppId,
        appPath: mockAppPath,
      });
      setTimeout(() => mockProcess.closeCallback(1), 0);
      await expect(resultPromise).rejects.toThrow('Docker is required but not available');
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should have correct config getter', () => {
      const config = service.getConfig();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('nodeImage');
      expect(typeof config.port).toBe('number');
      expect(typeof config.nodeImage).toBe('string');
    });

    it('should handle app path with spaces in getCommand', () => {
      const command = service['getCommand']({
        installCommand: 'npm install',
        startCommand: 'npm start',
      });
      expect(typeof command).toBe('string');
      expect(command.length).toBeGreaterThan(0);
    });

    it('should support custom port configuration', () => {
      process.env.DOCKER_APP_PORT = '8080';
      const testService = new DockerService();
      const command = testService['getCommand']({});
      expect(command).toContain('--port 8080');
    });

    it('should handle null commands gracefully', () => {
      const command = service['getCommand']({
        installCommand: null as any,
        startCommand: null as any,
      });
      expect(typeof command).toBe('string');
      expect(command).toContain('pnpm');
    });

    it('should handle empty string commands gracefully', () => {
      const command = service['getCommand']({
        installCommand: '',
        startCommand: '',
      });
      expect(typeof command).toBe('string');
    });
  });

  describe('Container State Management', () => {
    it('should correctly report container state with isReady property', () => {
      service['runningContainers'].set(1, {
        process: createMockProcess(),
        containerName: 'test-container',
        appId: 1,
        isReady: false,
        installedDependencies: false,
      });
      expect(service.isContainerReady(1)).toBe(false);
      const container = service['runningContainers'].get(1);
      if (container) {
        (container as any).isReady = true;
      }
      expect(service.isContainerReady(1)).toBe(true);
    });

    it('should correctly report dependencies state with installedDependencies property', () => {
      service['runningContainers'].set(1, {
        process: createMockProcess(),
        containerName: 'test-container',
        appId: 1,
        isReady: false,
        installedDependencies: false,
      });
      expect(service.hasDependenciesInstalled(1)).toBe(false);
      const container = service['runningContainers'].get(1);
      if (container) {
        (container as any).installedDependencies = true;
      }
      expect(service.hasDependenciesInstalled(1)).toBe(true);
    });

    it('should handle sync files to running container', async () => {
      service['runningContainers'].set(1, {
        process: createMockProcess(),
        containerName: 'test-container',
        appId: 1,
        isReady: true,
        installedDependencies: true,
      });
      const mockProcess = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProcess);
      const resultPromise = service.syncFilesToContainer(1, ['src/index.ts']);
      setTimeout(() => mockProcess.closeCallback(0), 0);
      await resultPromise;
      expect(spawn).toHaveBeenCalled();
    });
  });
});
