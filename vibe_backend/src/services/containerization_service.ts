/**
 * Containerization Service
 * Facade service that provides a unified interface for container operations
 * Handles enabled/disabled state and delegates to the appropriate container engine
 */

import { ContainerFactory } from '../containerization/ContainerFactory';
import { loadContainerizationConfig } from '../config/containerization.config';
import {
  ContainerStatus,
  RunContainerOptions,
  SyncFilesOptions,
  ContainerOperationResult,
  IContainerEngine,
} from '../containerization/types';
import { logger } from '../utils/logger';
import { ContainerLifecycleService } from './container_lifecycle_service';

export class ContainerizationService {
  private static instance: ContainerizationService;
  private readonly factory: ContainerFactory;
  private readonly enabled: boolean;

  private constructor() {
    const config = loadContainerizationConfig();
    this.factory = ContainerFactory.getInstance(config);
    this.enabled = config.enabled;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ContainerizationService {
    if (!ContainerizationService.instance) {
      ContainerizationService.instance = new ContainerizationService();
    }
    return ContainerizationService.instance;
  }

  /**
   * Reset instance (useful for testing)
   */
  static resetInstance(): void {
    ContainerizationService.instance = null as any;
    ContainerFactory.resetInstance();
  }

  /**
   * Check if containerization is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the current container engine handler
   */
  private getHandler(): IContainerEngine {
    if (!this.enabled) {
      throw new Error('Containerization is disabled. Set CONTAINERIZATION_ENABLED=true to enable.');
    }
    return this.factory.getCurrentHandler();
  }

  /**
   * Initialize the containerization service
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      logger.warn('Containerization is disabled', { service: 'containerization' });
      return;
    }

    try {
      await this.factory.initialize();
      const engineType = this.factory.getEngineType();
      const handler = this.getHandler();
      const version = await handler.getVersion();
      logger.info('Containerization enabled', { 
        service: 'containerization', 
        engine: engineType, 
        version 
      });
    } catch (error: any) {
      logger.error('Failed to initialize containerization', error, { service: 'containerization' });
      throw error;
    }
  }

  /**
   * Check if the container engine is available
   */
  async isEngineAvailable(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      return await this.factory.isCurrentEngineAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Run a container for an application
   */
  async runContainer(options: RunContainerOptions): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
        error: 'Set CONTAINERIZATION_ENABLED=true to enable containerization',
      };
    }

    try {
      const handler = this.getHandler();
      const result = await handler.runContainer(options);
      
      // Record activity if container started successfully
      if (result.success) {
        const lifecycleService = ContainerLifecycleService.getInstance();
        lifecycleService.recordActivity(options.appId);
        logger.info('Container started successfully, activity recorded', {
          service: 'containerization',
          appId: options.appId
        });
      }
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to run container',
        error: error.message,
      };
    }
  }

  /**
   * Stop a running container
   */
  async stopContainer(appId: string): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      return await handler.stopContainer(appId);
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to stop container',
        error: error.message,
      };
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus(appId: string): Promise<ContainerStatus> {
    if (!this.enabled) {
      return {
        appId,
        isRunning: false,
        isReady: false,
        hasDependenciesInstalled: false,
        containerName: null,
        port: null,
        status: 'stopped',
        error: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      const status = await handler.getContainerStatus(appId);
      
      // Record activity if container is running
      if (status.isRunning) {
        const lifecycleService = ContainerLifecycleService.getInstance();
        lifecycleService.recordActivity(appId);
      }
      
      return status;
    } catch (error: any) {
      return {
        appId,
        isRunning: false,
        isReady: false,
        hasDependenciesInstalled: false,
        containerName: null,
        port: null,
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Check if a container exists
   */
  async containerExists(appId: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const handler = this.getHandler();
      return await handler.containerExists(appId);
    } catch {
      return false;
    }
  }

  /**
   * Check if a container is running
   */
  async isContainerRunning(appId: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const handler = this.getHandler();
      return await handler.isContainerRunning(appId);
    } catch {
      return false;
    }
  }

  /**
   * Check if a container is ready
   */
  async isContainerReady(appId: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const handler = this.getHandler();
      return await handler.isContainerReady(appId);
    } catch {
      return false;
    }
  }

  /**
   * Check if dependencies are installed
   */
  async hasDependenciesInstalled(appId: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const handler = this.getHandler();
      return await handler.hasDependenciesInstalled(appId);
    } catch {
      return false;
    }
  }

  /**
   * Sync files to container
   */
  async syncFilesToContainer(options: SyncFilesOptions): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      return await handler.syncFilesToContainer(options);
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to sync files',
        error: error.message,
      };
    }
  }

  /**
   * Execute command in container
   */
  async execInContainer(appId: string, command: string[]): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      const result = await handler.execInContainer(appId, command);
      
      // Record activity on successful execution
      if (result.success) {
        const lifecycleService = ContainerLifecycleService.getInstance();
        lifecycleService.recordActivity(appId);
      }
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to execute command',
        error: error.message,
      };
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(appId: string, lines: number = 100): Promise<string> {
    if (!this.enabled) {
      return 'Containerization is disabled';
    }

    try {
      const handler = this.getHandler();
      const logs = await handler.getContainerLogs(appId, lines);
      
      // Record activity when accessing logs
      const lifecycleService = ContainerLifecycleService.getInstance();
      lifecycleService.recordActivity(appId);
      
      return logs;
    } catch (error: any) {
      return `Error getting logs: ${error.message}`;
    }
  }

  /**
   * Remove container
   */
  async removeContainer(appId: string, force: boolean = false): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      return await handler.removeContainer(appId, force);
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to remove container',
        error: error.message,
      };
    }
  }

  /**
   * Cleanup volumes
   */
  async cleanupVolumes(appId: string): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      return await handler.cleanupVolumes(appId);
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to cleanup volumes',
        error: error.message,
      };
    }
  }

  /**
   * Get engine information
   */
  async getEngineInfo(): Promise<any> {
    if (!this.enabled) {
      return {
        enabled: false,
        message: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      const info = await handler.getEngineInfo();
      return {
        enabled: true,
        engine: this.factory.getEngineType(),
        ...info,
      };
    } catch (error: any) {
      return {
        enabled: true,
        engine: this.factory.getEngineType(),
        error: error.message,
      };
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{
    enabled: boolean;
    engine: string | null;
    available: boolean;
    version: string | null;
  }> {
    if (!this.enabled) {
      return {
        enabled: false,
        engine: null,
        available: false,
        version: null,
      };
    }

    try {
      const handler = this.getHandler();
      const available = await handler.isAvailable();
      const version = available ? await handler.getVersion() : null;

      return {
        enabled: true,
        engine: this.factory.getEngineType(),
        available,
        version,
      };
    } catch (error: any) {
      return {
        enabled: true,
        engine: this.factory.getEngineType(),
        available: false,
        version: null,
      };
    }
  }

  /**
   * Quick start container (optimized for fast startup)
   */
  async quickStartContainer(
    appId: string,
    appPath: string,
    port: number,
    skipInstall: boolean = false
  ): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
      };
    }

    return this.runContainer({
      appId,
      appPath,
      port,
      skipInstall,
      forceRecreate: false,
    });
  }

  /**
   * Get container name for an app
   */
  getContainerName(appId: string): string {
    if (!this.enabled) {
      return '';
    }

    const handler = this.getHandler();
    return handler.getContainerName(appId);
  }

  /**
   * Remove volumes for an app
   */
  async removeVolumes(appId: string): Promise<ContainerOperationResult> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Containerization is disabled',
      };
    }

    try {
      const handler = this.getHandler();
      return await handler.cleanupVolumes(appId);
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to remove volumes',
        error: error.message,
      };
    }
  }

  /**
   * Get configuration
   */
  getConfiguration(): any {
    return loadContainerizationConfig();
  }

  /**
   * Get engine type
   */
  getEngineType(): string {
    return this.factory.getEngineType();
  }

  /**
   * Get running containers
   * Note: This is a simplified implementation that would need enhancement
   * for production use (e.g., tracking appIds or querying all containers)
   */
  async getRunningContainers(): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }

    // For now, return empty array. In production, this would:
    // 1. Query the container engine for all containers with our prefix
    // 2. Extract appIds from container names
    // 3. Return the list of running appIds
    return [];
  }

  /**
   * Stream container logs
   */
  async streamLogs(options: {
    appId: string;
    follow?: boolean;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<AsyncIterable<string>> {
    if (!this.enabled) {
      throw new Error('Containerization is disabled');
    }

    const handler = this.getHandler();
    return await handler.streamLogs(options);
  }

  /**
   * Get historical logs
   */
  async getLogs(options: {
    appId: string;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<string> {
    if (!this.enabled) {
      return '';
    }

    try {
      const handler = this.getHandler();
      return await handler.getLogs(options);
    } catch (error: any) {
      logger.error('Failed to get logs', error, { service: 'containerization', appId: options.appId });
      return '';
    }
  }

  /**
   * Get container lifecycle events
   */
  async getEvents(appId: string): Promise<any[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const handler = this.getHandler();
      return await handler.getEvents(appId);
    } catch (error: any) {
      logger.error('Failed to get events', error, { service: 'containerization', appId });
      return [];
    }
  }
}

// Export singleton instance
export const containerizationService = ContainerizationService.getInstance();
