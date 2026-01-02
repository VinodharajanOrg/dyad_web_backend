/**
 * Docker container engine handler
 * Implements Docker-specific container operations
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from '../../utils/logger';
import { AbstractContainerHandler } from './AbstractContainerHandler';
import {
  ContainerStatus,
  RunContainerOptions,
  SyncFilesOptions,
  ContainerOperationResult,
} from '../types';

export class DockerHandler extends AbstractContainerHandler {
  private readonly dockerImage: string;
  private readonly defaultPort: number;

  constructor(image: string = 'node:22-alpine', defaultPort: number = 32100) {
    super('docker');
    this.dockerImage = image;
    this.defaultPort = defaultPort;
    logger.debug('DockerHandler initialized', { engine: 'docker', image, defaultPort });
  }

  /**
   * Initialize Docker handler
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Docker already initialized', { engine: 'docker' });
      return;
    }

    logger.info('Initializing Docker engine', { engine: 'docker' });
    const available = await this.isAvailable();
    if (!available) {
      logger.error('Docker is not available', undefined, { engine: 'docker' });
      throw new Error('Docker is not available. Please install and start Docker.');
    }

    this.initialized = true;
    logger.info('Docker engine initialized successfully', { engine: 'docker' });
  }

  /**
   * Check if Docker is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const hasDocker = await this.commandExists('docker');
      if (!hasDocker) return false;

      await this.execute('docker info');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker version
   */
  async getVersion(): Promise<string> {
    return await this.execute('docker --version');
  }

  /**
   * Run a container for an application
   */
  async runContainer(options: RunContainerOptions): Promise<ContainerOperationResult> {
    try {
      const containerName = this.getContainerName(options.appId);
      const volumeName = this.getVolumeName(options.appId);
      const port = options.port || this.defaultPort;

      // Clean up existing containers and free the port if AUTO_KILL_PORT is enabled
      const autoKillPort = process.env.AUTO_KILL_PORT !== 'false'; // Default to true
      
      if (autoKillPort) {
        try {
          logger.debug('AUTO_KILL_PORT enabled, cleaning up existing container', { 
            engine: 'docker',
            appId: options.appId,
            containerName,
            port 
          });
          
          // First, remove container by name if it exists
          const exists = await this.containerExists(options.appId);
          if (exists) {
            logger.info('Removing existing container by name', {
              engine: 'docker',
              appId: options.appId,
              containerName
            });
            await this.execute(`docker stop ${containerName}`).catch(() => {});
            await this.execute(`docker rm -f ${containerName}`).catch(() => {});
          }

          // Then check for any other containers using this port
          const allContainers = await this.execute(
            `docker ps -a --format "{{.Names}}|||{{.Ports}}"`
          ).catch(() => '');
          
          if (allContainers.trim()) {
            const lines = allContainers.trim().split('\n');
            for (const line of lines) {
              const [name, ports] = line.split('|||');
              if (name && ports && ports.includes(`:${port}->`)) {
                logger.info('Removing container occupying port', {
                  engine: 'docker',
                  container: name,
                  port
                });
                await this.execute(`docker stop ${name}`).catch(() => {});
                await this.execute(`docker rm -f ${name}`).catch(() => {});
              }
            }
          }

          // Wait a moment for Docker to clean up
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.warn('Cleanup warning', { 
            engine: 'docker',
            appId: options.appId
          }, { error: String(error) });
          // Continue anyway
        }
      } else {
        // Check if container name already exists
        const exists = await this.containerExists(options.appId);
        if (exists) {
          return this.failure(
            `Container ${containerName} already exists. Set AUTO_KILL_PORT=true in .env to automatically remove it.`,
            `Container name: ${containerName}`
          );
        }
      }

      // Create volume if it doesn't exist
      await this.execute(`docker volume create ${volumeName}`).catch(() => {});

      // Determine the correct app path for volume mounting
      // When running in Docker, we need to use the host path, not the container path
      let mountPath = options.appPath;
      if (process.env.NODE_ENV === 'production' && process.env.HOST_APPS_BASE_DIR && process.env.APPS_BASE_DIR) {
        // Replace container path with host path
        mountPath = options.appPath.replace(process.env.APPS_BASE_DIR, process.env.HOST_APPS_BASE_DIR);
      }

      // Build docker run command using base class helpers
      const envFlags = this.buildEnvFlags(port, options.environmentVariables);
      const volumeFlags = this.buildVolumeFlags(
        mountPath,
        volumeName,
        options.volumeMounts,
        false // No SELinux context for Docker
      );
      const startupScript = this.buildStartupScript(options.appPath, port, options.skipInstall);
      
      // Escape the script properly for shell execution
      const escapedScript = startupScript.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');

      // Get resource limits from options or environment variables
      const cpuLimit = options.cpuLimit || process.env.CONTAINER_CPU_LIMIT || '1';
      const memoryLimit = options.memoryLimit || process.env.CONTAINER_MEMORY_LIMIT || '1g';

      const runCommand = `docker run -d --name ${containerName} -p ${port}:${port} --cpus="${cpuLimit}" --memory="${memoryLimit}" ${envFlags} ${volumeFlags} -w /app ${this.dockerImage} sh -c "${escapedScript}"`;

      logger.debug('Executing docker run command', {
        engine: 'docker',
        appId: options.appId,
        command: runCommand
      });

      await this.execute(runCommand);

      // Container started successfully - it will install dependencies in background
      logger.info('Container started, installing dependencies in background', { 
        engine: 'docker', 
        appId: options.appId, 
        containerName,
        port 
      });

      // Check if container is still running (not crashed immediately)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const stillRunning = await this.isContainerRunning(options.appId);
      
      if (!stillRunning) {
        const logs = await this.getContainerLogs(options.appId, 50);
        logger.error('Container exited immediately after start', undefined, {
          engine: 'docker',
          appId: options.appId,
          containerName,
          logs
        });
        return this.failure('Container exited immediately after start', logs);
      }

      return this.success('Container started successfully (installing dependencies in background)', {
        containerName,
        port,
        appId: options.appId,
        note: 'Dependencies are being installed. The app will be ready in 1-2 minutes.',
      });
    } catch (error: any) {
      logger.error('Failed to run container', error, {
        engine: 'docker',
        appId: options.appId,
        containerName: this.getContainerName(options.appId),
        port: options.port || this.defaultPort,
        image: this.dockerImage,
        errorMessage: error.message,
        errorStack: error.stack
      });
      return this.failure('Failed to run container', error.message);
    }
  }

  /**
   * Stop a running container
   */
  async stopContainer(appId: string): Promise<ContainerOperationResult> {
    try {
      const containerName = this.getContainerName(appId);
      const isRunning = await this.isContainerRunning(appId);

      if (!isRunning) {
        return this.success('Container is not running');
      }

      await this.execute(`docker stop ${containerName}`);
      return this.success('Container stopped successfully');
    } catch (error: any) {
      return this.failure('Failed to stop container', error.message);
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus(appId: string): Promise<ContainerStatus> {
    const containerName = this.getContainerName(appId);
    const exists = await this.containerExists(appId);

    if (!exists) {
      return {
        appId,
        isRunning: false,
        isReady: false,
        hasDependenciesInstalled: false,
        containerName: null,
        port: null,
        status: 'stopped',
      };
    }

    const isRunning = await this.isContainerRunning(appId);
    const isReady = isRunning ? await this.isContainerReady(appId) : false;
    const hasDeps = isRunning ? await this.hasDependenciesInstalled(appId) : false;

    // Get port mapping
    let port: number | null = null;
    try {
      const portOutput = await this.execute(
        `docker port ${containerName} | head -n 1 | awk -F: '{print $2}'`
      );
      port = portOutput ? Number.parseInt(portOutput, 10) : null;
    } catch {}

    return {
      appId,
      isRunning,
      isReady,
      hasDependenciesInstalled: hasDeps,
      containerName,
      port,
      status: isRunning ? 'running' : 'stopped',
    };
  }

  /**
   * Check if container exists
   */
  async containerExists(appId: string): Promise<boolean> {
    try {
      const containerName = this.getContainerName(appId);
      await this.execute(`docker inspect ${containerName}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if container is running
   */
  async isContainerRunning(appId: string): Promise<boolean> {
    try {
      const containerName = this.getContainerName(appId);
      const output = await this.execute(
        `docker inspect -f '{{.State.Running}}' ${containerName}`
      );
      return output === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Check if container is ready
   */
  async isContainerReady(appId: string): Promise<boolean> {
    try {
      const isRunning = await this.isContainerRunning(appId);
      if (!isRunning) return false;

      const containerName = this.getContainerName(appId);
      const logs = await this.execute(`docker logs ${containerName}`);

      // Check for various success indicators (case-insensitive for better matching)
      const logsLower = logs.toLowerCase();
      return (
        logsLower.includes('local:') ||
        logsLower.includes('ready in') ||
        logsLower.includes('application started') ||
        logsLower.includes('server running') ||
        logsLower.includes('vite') ||  // Vite server (matches "VITE v6.4.1" or "> vite")
        logsLower.includes('dev server running') ||
        logsLower.includes('localhost:') ||
        logsLower.includes('network:') // Vite also shows network address
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if dependencies are installed
   */
  async hasDependenciesInstalled(appId: string): Promise<boolean> {
    try {
      const containerName = this.getContainerName(appId);
      const result = await this.execute(
        `docker exec ${containerName} sh -c "[ -d '/app/node_modules' ] && echo 'exists' || echo 'missing'"`
      );
      return result.trim() === 'exists';
    } catch {
      return false;
    }
  }

  /**
   * Sync files to container
   */
  async syncFilesToContainer(options: SyncFilesOptions): Promise<ContainerOperationResult> {
    try {
      const containerName = this.getContainerName(options.appId);
      const isRunning = await this.isContainerRunning(options.appId);

      if (!isRunning) {
        return this.failure('Container is not running');
      }

      logger.info('Syncing files to container', {
        engine: 'docker',
        appId: options.appId,
        containerName,
        fileCount: options.filePaths?.length || 0
      });

      // Files are synced via volume mount, but we need to touch them to trigger HMR
      if (options.filePaths && options.filePaths.length > 0) {
        // Touch files to trigger Vite's HMR (Hot Module Replacement)
        for (const filePath of options.filePaths) {
          try {
            // Normalize path - remove leading slash if present
            const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
            await this.execute(`docker exec ${containerName} touch /app/${normalizedPath}`);
            logger.debug('Touched file in container', {
              engine: 'docker',
              appId: options.appId,
              filePath: normalizedPath
            });
          } catch (error) {
            logger.warn('Failed to touch file in container', {
              engine: 'docker',
              appId: options.appId,
              filePath
            }, { error: String(error) });
          }
        }
        return this.success(`Synced ${options.filePaths.length} file(s) and triggered hot-reload`);
      } else {
        // Files are already synced via volume mount
        return this.success('Files are synced via volume mount');
      }
    } catch (error: any) {
      return this.failure('Failed to sync files', error.message);
    }
  }

  /**
   * Execute command in container
   */
  async execInContainer(appId: string, command: string[]): Promise<ContainerOperationResult> {
    try {
      const containerName = this.getContainerName(appId);
      const cmdString = command.map(c => `"${c}"`).join(' ');
      const output = await this.execute(`docker exec ${containerName} sh -c ${cmdString}`);
      return this.success('Command executed', { output });
    } catch (error: any) {
      return this.failure('Failed to execute command', error.message);
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(appId: string, lines: number = 100): Promise<string> {
    try {
      const containerName = this.getContainerName(appId);
      return await this.execute(`docker logs --tail ${lines} ${containerName}`);
    } catch {
      return '';
    }
  }

  /**
   * Remove container
   */
  async removeContainer(appId: string, force: boolean = false): Promise<ContainerOperationResult> {
    try {
      const containerName = this.getContainerName(appId);
      const exists = await this.containerExists(appId);

      if (!exists) {
        return this.success('Container does not exist');
      }

      const forceFlag = force ? '-f' : '';
      await this.execute(`docker rm ${forceFlag} ${containerName}`);
      return this.success('Container removed');
    } catch (error: any) {
      return this.failure('Failed to remove container', error.message);
    }
  }

  /**
   * Cleanup volumes
   */
  async cleanupVolumes(appId: string): Promise<ContainerOperationResult> {
    try {
      const volumeName = this.getVolumeName(appId);
      
      // Stop and remove container first
      await this.stopContainer(appId);
      await this.removeContainer(appId, true);

      // Remove volume
      await this.execute(`docker volume rm ${volumeName}`).catch(() => {});

      return this.success('Volumes cleaned up');
    } catch (error: any) {
      return this.failure('Failed to cleanup volumes', error.message);
    }
  }

  /**
   * Get Docker engine info
   */
  async getEngineInfo(): Promise<any> {
    try {
      const info = await this.execute('docker info --format json');
      return this.parseJSON(info);
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Stream logs from a container in real-time
   */
  async streamLogs(options: {
    appId: string;
    follow?: boolean;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<AsyncIterable<string>> {
    const containerName = this.getContainerName(options.appId);
    const args = ['docker', 'logs'];
    
    if (options.follow !== false) {
      args.push('--follow');
    }
    
    if (options.tail !== undefined) {
      args.push('--tail', String(options.tail));
    }
    
    if (options.since) {
      args.push('--since', options.since);
    }
    
    if (options.timestamps) {
      args.push('--timestamps');
    }
    
    args.push(containerName);
    
    const { spawn } = require('child_process');
    const process = spawn(args[0], args.slice(1));
    
    // Create an async iterable that yields log lines
    return {
      [Symbol.asyncIterator]: async function* () {
        let buffer = '';
        
        // Handle stdout data
        for await (const chunk of process.stdout) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in buffer
          
          for (const line of lines) {
            if (line) {
              yield line;
            }
          }
        }
        
        // Handle stderr data
        for await (const chunk of process.stderr) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line) {
              yield line;
            }
          }
        }
        
        // Yield any remaining buffer content
        if (buffer) {
          yield buffer;
        }
      }
    };
  }

  /**
   * Get logs with options
   */
  async getLogs(options: {
    appId: string;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<string> {
    try {
      const containerName = this.getContainerName(options.appId);
      const args = ['docker', 'logs'];
      
      if (options.tail !== undefined) {
        args.push('--tail', String(options.tail));
      }
      
      if (options.since) {
        args.push('--since', options.since);
      }
      
      if (options.timestamps) {
        args.push('--timestamps');
      }
      
      args.push(containerName);
      
      return await this.execute(args.join(' '));
    } catch (error: any) {
      logger.error('Failed to get logs', error, { 
        engine: 'docker', 
        appId: options.appId 
      });
      return '';
    }
  }

  /**
   * Get container lifecycle events
   */
  async getEvents(appId: string): Promise<any[]> {
    try {
      const containerName = this.getContainerName(appId);
      
      // Get events for this container from the last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const until = new Date().toISOString();
      
      const eventsOutput = await this.execute(
        `docker events --filter container=${containerName} --since ${since} --until ${until} --format '{{json .}}'`
      );
      
      if (!eventsOutput.trim()) {
        return [];
      }
      
      // Parse each line as a separate JSON object
      const events = eventsOutput
        .trim()
        .split('\n')
        .map(line => {
          try {
            return this.parseJSON(line);
          } catch {
            return null;
          }
        })
        .filter(event => event !== null);
      
      return events;
    } catch (error: any) {
      logger.error('Failed to get events', error, { 
        engine: 'docker', 
        appId 
      });
      return [];
    }
  }
}
