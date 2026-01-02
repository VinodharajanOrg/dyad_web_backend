/**
 * Podman container engine handler
 * Implements Podman-specific container operations
 */

import * as path from 'node:path';
import { logger } from '../../utils/logger';
import { AbstractContainerHandler } from './AbstractContainerHandler';
import {
  ContainerStatus,
  RunContainerOptions,
  SyncFilesOptions,
  ContainerOperationResult,
} from '../types';

export class PodmanHandler extends AbstractContainerHandler {
  private readonly podmanImage: string;
  private readonly defaultPort: number;
  private readonly socketPath?: string;

  constructor(image: string = 'node:22-alpine', defaultPort: number = 32100, socketPath?: string) {
    super('podman');
    this.podmanImage = image;
    this.defaultPort = defaultPort;
    this.socketPath = socketPath;
    logger.debug('PodmanHandler initialized', { engine: 'podman', image, defaultPort, socketPath });
  }

  /**
   * Execute a podman command with socket path if configured
   * On macOS, Podman uses SSH connections by default, so we skip the socket URL
   */
  protected async execute(command: string): Promise<string> {
    // On macOS, ensure Podman machine is running before executing commands
    if (process.platform === 'darwin') {
      await this.ensureMachineRunning();
    }
    
    // On macOS, Podman uses SSH connections managed by podman system connections
    // We should not override with socket path as it interferes with the SSH tunnel
    // Only use socket path if explicitly needed for Linux environments
    if (this.socketPath && process.platform === 'linux') {
      const socketUrl = `unix://${this.socketPath}`;
      if (command.startsWith('podman ')) {
        command = command.replace('podman ', `podman --url ${socketUrl} `);
      }
    }
    return super.execute(command);
  }

  /**
   * Ensure Podman machine is running on macOS
   */
  private async ensureMachineRunning(): Promise<void> {
    try {
      // First, try a simple podman info to check if connection works
      try {
        await super.execute('podman info');
        return; // Connection works, machine is running
      } catch (infoError) {
        logger.debug('Podman connection failed, checking machine status', { 
          error: String(infoError) 
        });
      }

      // Check if any machine exists and its state
      const machines = await super.execute('podman machine list --format "{{.Name}} {{.Running}}"').catch(() => '');
      
      if (!machines.trim()) {
        logger.warn('No Podman machines found', { engine: 'podman' });
        return;
      }

      const lines = machines.trim().split('\n');
      let machineToStart: string | null = null;
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const name = parts[0].replace('*', ''); // Remove asterisk from default machine
          const running = parts[1];
          
          if (running === 'true' || running === 'running') {
            // Machine claims to be running but connection failed - restart it
            machineToStart = name;
            logger.info('Podman machine running but connection stale, restarting', { 
              engine: 'podman', 
              machine: name 
            });
            break;
          } else {
            // Machine is stopped
            machineToStart = name;
            logger.info('Podman machine is stopped, starting', { 
              engine: 'podman', 
              machine: name 
            });
            break;
          }
        }
      }
      
      if (machineToStart) {
        // Try to stop first (in case it's in a bad state)
        await super.execute(`podman machine stop ${machineToStart}`).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start the machine
        await super.execute(`podman machine start ${machineToStart}`);
        
        // Wait for machine to be fully ready
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify connection works
        await super.execute('podman info');
        logger.info('Podman machine started successfully', { 
          engine: 'podman', 
          machine: machineToStart 
        });
      }
    } catch (error) {
      // If we can't ensure the machine is running, log but let the command fail with proper error
      logger.warn('Could not ensure Podman machine is running', { 
        engine: 'podman',
        error: String(error) 
      });
    }
  }
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Podman already initialized', { engine: 'podman' });
      return;
    }

    logger.info('Initializing Podman engine', { engine: 'podman' });
    const available = await this.isAvailable();
    if (!available) {
      logger.error('Podman is not available', undefined, { engine: 'podman' });
      throw new Error('Podman is not available. Please install and start Podman.');
    }

    this.initialized = true;
    logger.info('Podman engine initialized successfully', { engine: 'podman' });
  }

  /**
   * Check if Podman is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const hasPodman = await this.commandExists('podman');
      if (!hasPodman) return false;

      await this.execute('podman info');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Podman version
   */
  async getVersion(): Promise<string> {
    return await this.execute('podman --version');
  }

  /**
   * Run a container for an application
   */
  async runContainer(options: RunContainerOptions): Promise<ContainerOperationResult> {
    try {
      const containerName = this.getContainerName(options.appId);
      const volumeName = this.getVolumeName(options.appId);
      const port = options.port || this.defaultPort;

      logger.info('Starting container', { 
        engine: 'podman', 
        appId: options.appId, 
        containerName, 
        port,
        image: this.podmanImage 
      });

      // Clean up existing containers and free the port if AUTO_KILL_PORT is enabled
      const autoKillPort = process.env.AUTO_KILL_PORT !== 'false'; // Default to true
      
      if (autoKillPort) {
        try {
          logger.debug('AUTO_KILL_PORT enabled, cleaning up existing container', { 
            engine: 'podman',
            appId: options.appId,
            containerName,
            port 
          });
          
          // First, remove container by name if it exists
          const exists = await this.containerExists(options.appId);
          if (exists) {
            logger.info('Removing existing container by name', { 
              engine: 'podman', 
              appId: options.appId, 
              containerName 
            });
            await this.execute(`podman stop ${containerName}`).catch(() => {});
            await this.execute(`podman rm -f ${containerName}`).catch(() => {});
          }

          // Then check for any other containers using this port
          const allContainers = await this.execute(
            `podman ps -a --format "{{.Names}}|||{{.Ports}}"`
          ).catch(() => '');
          
          if (allContainers.trim()) {
            const lines = allContainers.trim().split('\n');
            for (const line of lines) {
              const [name, ports] = line.split('|||');
              if (name && ports && ports.includes(`:${port}->`)) {
                logger.info('Removing container occupying port', { 
                  engine: 'podman', 
                  container: name, 
                  port 
                });
                await this.execute(`podman stop ${name}`).catch(() => {});
                await this.execute(`podman rm -f ${name}`).catch(() => {});
              }
            }
          }

          // Wait a moment for Podman to clean up port forwarding
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.warn('Cleanup warning', { 
            engine: 'podman', 
            appId: options.appId, 
            port 
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
      await this.execute(`podman volume create ${volumeName}`).catch(() => {});

      // Build podman run command using base class helpers
      const envFlags = this.buildEnvFlags(port, options.environmentVariables);
      const volumeFlags = this.buildVolumeFlags(
        options.appPath,
        volumeName,
        options.volumeMounts,
        true // Enable SELinux context for Podman
      );
      const startupScript = this.buildStartupScript(options.appPath, port, options.skipInstall);
      
      // Escape the script properly for shell execution
      const escapedScript = startupScript.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');

      // Get resource limits from options or environment variables
      const cpuLimit = options.cpuLimit || process.env.CONTAINER_CPU_LIMIT || '1';
      const memoryLimit = options.memoryLimit || process.env.CONTAINER_MEMORY_LIMIT || '1g';

      const runCommand = `podman run -d --name ${containerName} -p ${port}:${port} --cpus="${cpuLimit}" --memory="${memoryLimit}" ${envFlags} ${volumeFlags} -w /app ${this.podmanImage} sh -c "${escapedScript}"`;

      logger.debug('Executing podman run command', {
        engine: 'podman',
        appId: options.appId,
        command: runCommand
      });

      await this.execute(runCommand);

      // Container started successfully - it will install dependencies in background
      logger.info('Container started, installing dependencies in background', { 
        engine: 'podman', 
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
          engine: 'podman',
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
        engine: 'podman',
        appId: options.appId,
        containerName: this.getContainerName(options.appId),
        port: options.port || this.defaultPort,
        image: this.podmanImage,
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

      logger.info('Stopping container', { engine: 'podman', appId, containerName });

      if (!isRunning) {
        logger.debug('Container is not running', { engine: 'podman', appId, containerName });
        return this.success('Container is not running');
      }

      await this.execute(`podman stop ${containerName}`);
      logger.info('Container stopped successfully', { engine: 'podman', appId, containerName });
      return this.success('Container stopped successfully');
    } catch (error: any) {
      logger.error('Failed to stop container', error, { engine: 'podman', appId });
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
      const inspectOutput = await this.execute(
        `podman inspect ${containerName} --format '{{json .NetworkSettings.Ports}}'`
      );
      const ports = this.parseJSON<any>(inspectOutput);
      if (ports) {
        const portKeys = Object.keys(ports);
        if (portKeys.length > 0) {
          const hostBindings = ports[portKeys[0]];
          if (hostBindings && hostBindings[0]) {
            port = Number.parseInt(hostBindings[0].HostPort, 10);
          }
        }
      }
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
      await this.execute(`podman inspect ${containerName}`);
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
        `podman inspect -f '{{.State.Running}}' ${containerName}`
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
      const logs = await this.execute(`podman logs ${containerName}`);

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
        `podman exec ${containerName} sh -c "[ -d '/app/node_modules' ] && echo 'exists' || echo 'missing'"`
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
        engine: 'podman',
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
            await this.execute(`podman exec ${containerName} touch /app/${normalizedPath}`);
            logger.debug('Touched file in container', {
              engine: 'podman',
              appId: options.appId,
              filePath: normalizedPath
            });
          } catch (error) {
            logger.warn('Failed to touch file in container', {
              engine: 'podman',
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
      const output = await this.execute(`podman exec ${containerName} sh -c ${cmdString}`);
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
      return await this.execute(`podman logs --tail ${lines} ${containerName}`);
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
      await this.execute(`podman rm ${forceFlag} ${containerName}`);
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
      await this.execute(`podman volume rm ${volumeName}`).catch(() => {});

      return this.success('Volumes cleaned up');
    } catch (error: any) {
      return this.failure('Failed to cleanup volumes', error.message);
    }
  }

  /**
   * Get Podman engine info
   */
  async getEngineInfo(): Promise<any> {
    try {
      const info = await this.execute('podman info --format json');
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
    const args = ['podman', 'logs'];
    
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
      const args = ['podman', 'logs'];
      
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
        engine: 'podman', 
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
        `podman events --filter container=${containerName} --since ${since} --until ${until} --format json`
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
        engine: 'podman', 
        appId 
      });
      return [];
    }
  }
}
