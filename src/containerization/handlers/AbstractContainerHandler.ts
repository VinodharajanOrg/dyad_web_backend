/**
 * Abstract base class for container engine handlers
 * Provides common functionality and defines the contract for all handlers
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  IContainerEngine,
  ContainerStatus,
  RunContainerOptions,
  SyncFilesOptions,
  ContainerOperationResult,
  ContainerEngineType,
} from '../types';
import { getContainerStartupScript } from '../../utils/app_commands';

const execAsync = promisify(exec);

export abstract class AbstractContainerHandler implements IContainerEngine {
  protected engineType: ContainerEngineType;
  protected initialized = false;

  constructor(engineType: ContainerEngineType) {
    this.engineType = engineType;
  }

  /**
   * Get the container name for an app
   */
  getContainerName(appId: string): string {
    return `dyad-app-${appId}`;
  }

  /**
   * Get the volume name for an app
   */
  protected getVolumeName(appId: string): string {
    return `dyad-app-${appId}-pnpm-store`;
  }

  /**
   * Execute a shell command
   */
  protected async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execAsync(command);
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}\nCommand: ${command}`);
    }
  }

  /**
   * Execute a command and return just the output
   */
  protected async execute(command: string): Promise<string> {
    const { stdout } = await this.executeCommand(command);
    return stdout.trim();
  }

  /**
   * Check if command exists in system
   */
  protected async commandExists(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse JSON output safely
   */
  protected parseJSON<T>(output: string): T | null {
    try {
      return JSON.parse(output) as T;
    } catch {
      return null;
    }
  }

  /**
   * Wait for a condition with timeout
   */
  protected async waitForCondition(
    condition: () => Promise<boolean>,
    timeoutMs: number = 30000,
    intervalMs: number = 500
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return true;
      }
      await this.sleep(intervalMs);
    }
    return false;
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a success result
   */
  protected success(message: string, data?: any): ContainerOperationResult {
    return {
      success: true,
      message,
      data,
    };
  }

  /**
   * Create an error result
   */
  protected failure(message: string, error?: string): ContainerOperationResult {
    return {
      success: false,
      message,
      error,
    };
  }

  /**
   * Build the common container startup script
   * This script sets up the environment and starts the application
   * Uses the centralized app_commands utility for consistency
   */
  protected buildStartupScript(appPath: string, port: number, skipInstall: boolean = false): string {
    // Use the common utility that detects package manager and builds appropriate commands
    return getContainerStartupScript(appPath, port);
  }

  /**
   * Build environment variable flags for container run command
   */
  protected buildEnvFlags(port: number, customEnv?: Record<string, string>): string {
    const envVars = {
      PORT: port.toString(),
      VITE_PORT: port.toString(),
      PNPM_STORE_PATH: '/app/.pnpm-store',
      ...customEnv,
    };

    return Object.entries(envVars)
      .map(([key, value]) => `-e ${key}="${value}"`)
      .join(' ');
  }

  /**
   * Build volume mount flags for container run command
   * @param selinuxContext - Whether to add SELinux context (for Podman)
   */
  protected buildVolumeFlags(
    appPath: string,
    volumeName: string,
    customMounts?: Array<{ host: string; container: string; readOnly?: boolean }>,
    selinuxContext: boolean = false
  ): string {
    const contextFlag = selinuxContext ? ':Z' : '';
    const roFlag = (readOnly: boolean) => (readOnly ? ':ro' : contextFlag);

    const volumes = [
      `-v "${appPath}:/app${contextFlag}"`,
      `-v ${volumeName}:/app/.pnpm-store${contextFlag}`,
      ...(customMounts || []).map(
        v => `-v "${v.host}:${v.container}${roFlag(v.readOnly || false)}"`
      ),
    ];

    return volumes.join(' ');
  }

  // Abstract methods that must be implemented by concrete handlers
  abstract initialize(): Promise<void>;
  abstract isAvailable(): Promise<boolean>;
  abstract getVersion(): Promise<string>;
  abstract runContainer(options: RunContainerOptions): Promise<ContainerOperationResult>;
  abstract stopContainer(appId: string): Promise<ContainerOperationResult>;
  abstract getContainerStatus(appId: string): Promise<ContainerStatus>;
  abstract containerExists(appId: string): Promise<boolean>;
  abstract isContainerRunning(appId: string): Promise<boolean>;
  abstract isContainerReady(appId: string): Promise<boolean>;
  abstract hasDependenciesInstalled(appId: string): Promise<boolean>;
  abstract syncFilesToContainer(options: SyncFilesOptions): Promise<ContainerOperationResult>;
  abstract execInContainer(appId: string, command: string[]): Promise<ContainerOperationResult>;
  abstract getContainerLogs(appId: string, lines?: number): Promise<string>;
  abstract removeContainer(appId: string, force?: boolean): Promise<ContainerOperationResult>;
  abstract cleanupVolumes(appId: string): Promise<ContainerOperationResult>;
  abstract getEngineInfo(): Promise<any>;
  abstract streamLogs(options: {
    appId: string;
    follow?: boolean;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<AsyncIterable<string>>;
  abstract getLogs(options: {
    appId: string;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<string>;
  abstract getEvents(appId: string): Promise<any[]>;
}
