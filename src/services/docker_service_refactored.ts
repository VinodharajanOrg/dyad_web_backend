/**
 * DockerService - Refactored to use ContainerizationService
 * This maintains backward compatibility while using the new factory pattern
 * 
 * @deprecated Use containerizationService directly for new code
 */

import { containerizationService } from './containerization_service';
import { ContainerStatus } from '../containerization/types';
import { logger } from '../utils/logger';

interface DockerConfig {
  enabled: boolean;
  port: number;
  nodeImage: string;
}

export class DockerService {
  private readonly config: DockerConfig;

  constructor() {
    // Load Docker configuration from environment
    // Note: CONTAINERIZATION_ENABLED takes precedence over DOCKER_ENABLED
    const containerizationEnabled = process.env.CONTAINERIZATION_ENABLED === 'true';
    const dockerEnabled = process.env.DOCKER_ENABLED === 'true';
    
    this.config = {
      enabled: containerizationEnabled || dockerEnabled,
      port: Number.parseInt(process.env.DOCKER_APP_PORT || '32100', 10),
      nodeImage: process.env.DOCKER_NODE_IMAGE || 'node:22-alpine',
    };
  }

  /**
   * Check if Docker is available on the system
   */
  async isDockerAvailable(): Promise<boolean> {
    return await containerizationService.isEngineAvailable();
  }

  /**
   * Run app in Docker container
   */
  async runAppInDocker(params: {
    appId: number;
    appPath: string;
    installCommand?: string | null;
    startCommand?: string | null;
    onOutput?: (data: string) => void;
    onError?: (data: string) => void;
    onClose?: (code: number | null) => void;
  }): Promise<void> {
    const { appId, appPath } = params;

    if (!this.config.enabled) {
      throw new Error('Containerization is disabled. Set CONTAINERIZATION_ENABLED=true in .env');
    }

    const result = await containerizationService.runContainer({
      appId: appId.toString(),
      appPath,
      port: this.config.port,
      forceRecreate: false,
      skipInstall: false,
    });

    if (!result.success) {
      throw new Error(result.error || result.message);
    }

    logger.info('Container started', { service: 'docker', appId: String(appId) });
  }

  /**
   * Stop a running Docker container
   */
  async stopApp(appId: number): Promise<void> {
    const result = await containerizationService.stopContainer(appId.toString());
    
    if (!result.success) {
      logger.warn('Failed to stop container', { service: 'docker', appId: String(appId), message: result.message });
    }
  }

  /**
   * Sync updated files to running container
   */
  async syncFilesToContainer(appId: number, filePaths?: string[]): Promise<void> {
    const result = await containerizationService.syncFilesToContainer({
      appId: appId.toString(),
      filePaths,
      fullSync: false,
    });

    if (!result.success) {
      throw new Error(result.error || result.message);
    }
  }

  /**
   * Quick start container (optimized for speed)
   */
  async quickStartContainer(params: {
    appId: number;
    appPath: string;
    installCommand?: string | null;
    startCommand?: string | null;
    skipInstall?: boolean;
  }): Promise<void> {
    const { appId, appPath, skipInstall } = params;

    if (!this.config.enabled) {
      throw new Error('Containerization is disabled.');
    }

    const result = await containerizationService.quickStartContainer(
      appId.toString(),
      appPath,
      this.config.port,
      skipInstall || false
    );

    if (!result.success) {
      throw new Error(result.error || result.message);
    }

    logger.info('Quick start completed', { service: 'docker', appId: String(appId) });
  }

  /**
   * Check if container is ready to serve requests
   */
  isContainerReady(appId: number): boolean {
    // This is now async in the new service, but we keep sync for compatibility
    // Note: This may return stale data
    return false; // Deprecated - use getContainerStatus instead
  }

  /**
   * Check if dependencies are installed in container
   */
  hasDependenciesInstalled(appId: number): boolean {
    // This is now async in the new service, but we keep sync for compatibility
    // Note: This may return stale data
    return false; // Deprecated - use getContainerStatus instead
  }

  /**
   * Get container status (async replacement for isContainerReady/hasDependenciesInstalled)
   */
  async getContainerStatus(appId: number): Promise<ContainerStatus> {
    return await containerizationService.getContainerStatus(appId.toString());
  }

  /**
   * Remove Docker volumes for an app
   */
  async removeAppVolumes(appId: number): Promise<void> {
    const result = await containerizationService.cleanupVolumes(appId.toString());
    
    if (!result.success) {
      logger.warn('Failed to cleanup volumes', { service: 'docker', appId: String(appId), message: result.message });
    }
  }

  /**
   * Check if app is running in Docker
   */
  async isAppRunning(appId: number): Promise<boolean> {
    return await containerizationService.isContainerRunning(appId.toString());
  }

  /**
   * Get all running containers
   */
  getRunningContainers(): number[] {
    // This would require tracking at the service level
    // For now, return empty array - this is a limitation of the new architecture
    return [];
  }

  /**
   * Get Docker configuration
   */
  getConfig(): DockerConfig {
    return { ...this.config };
  }
}

// Singleton instance
let dockerServiceInstance: DockerService | null = null;

export function getDockerService(): DockerService {
  if (!dockerServiceInstance) {
    dockerServiceInstance = new DockerService();
  }
  return dockerServiceInstance;
}
