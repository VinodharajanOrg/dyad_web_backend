import { containerizationService } from './containerization_service';
import { ContainerStatus, RunContainerOptions } from '../containerization/types';
import { logger } from '../utils/logger';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

interface DockerConfig {
  enabled: boolean;
  port: number;
  nodeImage: string;
}

/**
 * DockerService - Legacy wrapper around ContainerizationService
 * This maintains backward compatibility while using the new factory pattern
 * 
 * @deprecated Use containerizationService directly for new code
 */
export class DockerService {
  private readonly config: DockerConfig;
  private readonly runningContainers: Map<number, any> = new Map();

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
    try {
      await new Promise<void>((resolve, reject) => {
        const checkDocker = spawn('docker', ['--version'], { stdio: 'pipe' });
        checkDocker.on('close', (code: any) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error('Docker is not available'));
          }
        });
        checkDocker.on('error', () => {
          reject(new Error('Docker is not available'));
        });
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stop and remove a Docker container
   */
  private async stopAndRemoveContainer(containerName: string): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        const stopContainer = spawn('docker', ['stop', containerName], {
          stdio: 'pipe',
        });
        stopContainer.on('close', () => {
          const removeContainer = spawn('docker', ['rm', containerName], {
            stdio: 'pipe',
          });
          removeContainer.on('close', () => resolve());
          removeContainer.on('error', () => resolve());
        });
        stopContainer.on('error', () => resolve());
      });
    } catch (error) {
      logger.info('Docker container not found', { service: 'docker', containerName, error: String(error) });
    }
  }

  /**
   * Create Dockerfile for the app if it doesn't exist
   */
  private async ensureDockerfile(appPath: string): Promise<string> {
    const dockerfilePath = path.join(appPath, 'Dockerfile.dyad');
    
    if (!fs.existsSync(dockerfilePath)) {
      const dockerfileContent = `FROM ${this.config.nodeImage}

# Install pnpm
RUN npm install -g pnpm

# Expose the application port
EXPOSE ${this.config.port}
`;

      await fsPromises.writeFile(dockerfilePath, dockerfileContent, 'utf-8');
      logger.info('Created Dockerfile', { service: 'docker', dockerfilePath });
    }

    return dockerfilePath;
  }

  /**
   * Build Docker image for the app
   * Now uses a lightweight base image approach - no rebuild needed for file changes
   */
  private async buildDockerImage(appPath: string, appId: number, forceRebuild: boolean = false): Promise<void> {
    const imageName = `dyad-app-${appId}`;
    
    // Check if image already exists
    if (!forceRebuild) {
      try {
        const exists = await new Promise<boolean>((resolve) => {
          const inspect = spawn('docker', ['image', 'inspect', imageName], { stdio: 'pipe' });
          inspect.on('close', (code: any) => resolve(code === 0));
          inspect.on('error', () => resolve(false));
        });
        
        if (exists) {
          logger.info('Using existing Docker image', { service: 'docker', imageName });
          return;
        }
      } catch (error) {
        // Image doesn't exist, continue with build
      }
    }
    
    const buildArgs = ['build', '-f', 'Dockerfile.dyad', '-t', imageName, '.'];
    
    const buildProcess = spawn('docker', buildArgs, {
      cwd: appPath,
      stdio: 'pipe',
    });

    let buildError = '';
    buildProcess.stderr?.on('data', (data: any) => {
      buildError += data.toString();
    });

    buildProcess.stdout?.on('data', (data: any) => {
      const output = data.toString().trim();
      logger.debug('Docker build output', { service: 'docker', appId: String(appId), output });
    });

    await new Promise<void>((resolve, reject) => {
      buildProcess.on('close', (code: any) => {
        if (code === 0) {
          logger.info('Docker image built successfully', { service: 'docker', imageName });
          resolve();
        } else {
          reject(new Error(`Docker build failed: ${buildError}`));
        }
      });
      buildProcess.on('error', (err: any) => {
        reject(new Error(`Docker build process error: ${err.message}`));
      });
    });
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
    const { appId, appPath, installCommand, startCommand, onOutput, onError, onClose } = params;

    if (!this.config.enabled) {
      throw new Error('Docker execution is disabled. Set DOCKER_ENABLED=true in .env');
    }

    // Check if Docker is available
    const isAvailable = await this.isDockerAvailable();
    if (!isAvailable) {
      throw new Error(
        'Docker is required but not available. Please install Docker Desktop and ensure it\'s running.',
      );
    }

    const containerName = `dyad-app-${appId}`;

    // Stop any existing container
    await this.stopAndRemoveContainer(containerName);

    // Ensure Dockerfile exists
    await this.ensureDockerfile(appPath);

    // Build Docker image
    await this.buildDockerImage(appPath, appId);

    // Determine the command to run
    const command = this.getCommand({ installCommand, startCommand });

    // Run the Docker container
    const process = spawn(
      'docker',
      [
        'run',
        '--rm',
        '--name',
        containerName,
        '-p',
        `${this.config.port}:${this.config.port}`,
        '-v',
        `${appPath}:/app`,
        '-v',
        `dyad-pnpm-${appId}:/app/.pnpm-store`,
        '-e',
        'PNPM_STORE_PATH=/app/.pnpm-store',
        '-e',
        `PORT=${this.config.port}`,
        '-e',
        `VITE_PORT=${this.config.port}`,
        '-w',
        '/app',
        `dyad-app-${appId}`,
        'sh',
        '-c',
        command,
      ],
      {
        stdio: 'pipe',
        detached: false,
      },
    );

    // Check if process spawned correctly
    if (!process.pid) {
      throw new Error(`Failed to spawn Docker container for app ${appId}`);
    }

    logger.info('Docker container started', { service: 'docker', appId: String(appId), containerName });

    // Store running container
    this.runningContainers.set(appId, {
      process,
      containerName,
      appId,
      isReady: false,
      installedDependencies: false,
    });

    // Handle process output
    if (process.stdout) {
      process.stdout.on('data', (data: any) => {
        const output = data.toString();
        logger.debug('App stdout', { service: 'docker', appId: String(appId), output: output.trim() });
        
        // Track container readiness
        const container = this.runningContainers.get(appId);
        if (container) {
          if (output.includes('Local:') || output.includes('ready in') || output.includes('Server running')) {
            container.isReady = true;
            logger.info('Container ready', { service: 'docker', containerName });
          }
          if (output.includes('packages in') || output.includes('Already up to date')) {
            container.installedDependencies = true;
          }
        }
        
        if (onOutput) onOutput(output);
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data: any) => {
        const error = data.toString();
        logger.warn('App stderr', { service: 'docker', appId: String(appId), error: error.trim() });
        if (onError) onError(error);
      });
    }

    process.on('close', (code: any) => {
      logger.info('Docker container exited', { service: 'docker', containerName, exitCode: code });
      this.runningContainers.delete(appId);
      if (onClose) onClose(code);
    });

    process.on('error', (err: any) => {
      logger.error('Docker container error', err, { service: 'docker', appId: String(appId) });
      this.runningContainers.delete(appId);
      if (onError) onError(err.message);
    });
  }

  /**
   * Stop a running Docker container
   */
  async stopApp(appId: number): Promise<void> {
    const container = this.runningContainers.get(appId);
    
    if (!container) {
      console.log(`No running container found for app ${appId}`);
      return;
    }

    console.log(`Stopping Docker container: ${container.containerName}`);
    await this.stopAndRemoveContainer(container.containerName);
    this.runningContainers.delete(appId);
  }

  /**
   * Sync updated files to running container (incremental update)
   * This allows AI-generated changes to be reflected immediately without container restart
   */
  async syncFilesToContainer(appId: number, filePaths?: string[]): Promise<void> {
    const container = this.runningContainers.get(appId);
    
    if (!container) {
      throw new Error(`No running container found for app ${appId}`);
    }

    console.log(`📦 Syncing files to container: ${container.containerName}`);
    
    // Files are already synced via volume mount (-v flag)
    // The volume mount ensures real-time file sync
    // Vite's hot reload will automatically detect changes
    
    // Optional: Touch files to trigger HMR if needed
    if (filePaths && filePaths.length > 0) {
      for (const filePath of filePaths) {
        try {
          await new Promise<void>((resolve, reject) => {
            const touch = spawn('docker', [
              'exec',
              container.containerName,
              'touch',
              `/app/${filePath}`,
            ], { stdio: 'pipe' });
            
            touch.on('close', (code: any) => {
              if (code === 0) {
                console.log(`✓ Touched file in container: ${filePath}`);
                resolve();
              } else {
                reject(new Error(`Failed to touch file: ${filePath}`));
              }
            });
            
            touch.on('error', reject);
          });
        } catch (error) {
          console.warn(`Warning: Could not touch file ${filePath}:`, error);
        }
      }
    }
    
    console.log(`✅ Files synced to container ${container.containerName}`);
  }

  /**
   * Quick start container with base template (optimized for speed)
   * Starts the container immediately with template files, dependencies installed in background
   */
  async quickStartContainer(params: {
    appId: number;
    appPath: string;
    installCommand?: string | null;
    startCommand?: string | null;
    skipInstall?: boolean;
  }): Promise<void> {
    const { appId, appPath, installCommand, startCommand, skipInstall } = params;

    if (!this.config.enabled) {
      throw new Error('Docker execution is disabled. Set DOCKER_ENABLED=true in .env');
    }

    const isAvailable = await this.isDockerAvailable();
    if (!isAvailable) {
      throw new Error('Docker is required but not available.');
    }

    const containerName = `dyad-app-${appId}`;
    await this.stopAndRemoveContainer(containerName);
    await this.ensureDockerfile(appPath);
    await this.buildDockerImage(appPath, appId, false);

    // Quick start command - optionally skip install for faster startup
    let command: string;
    if (skipInstall) {
      // Just start the dev server (assumes dependencies already installed)
      const start = startCommand?.trim() || 'pnpm dev';
      command = `${start} --host 0.0.0.0 --port ${this.config.port}`;
    } else {
      command = this.getCommand({ installCommand, startCommand });
    }

    console.log(`🚀 Quick starting container with command: ${command}`);

    const process = spawn(
      'docker',
      [
        'run',
        '--rm',
        '--name',
        containerName,
        '-p',
        `${this.config.port}:${this.config.port}`,
        '-v',
        `${appPath}:/app`,
        '-v',
        `dyad-pnpm-${appId}:/app/.pnpm-store`,
        '-e',
        'PNPM_STORE_PATH=/app/.pnpm-store',
        '-e',
        `PORT=${this.config.port}`,
        '-e',
        `VITE_PORT=${this.config.port}`,
        '-w',
        '/app',
        `dyad-app-${appId}`,
        'sh',
        '-c',
        command,
      ],
      { stdio: 'pipe', detached: false }
    );

    if (!process.pid) {
      throw new Error(`Failed to spawn Docker container for app ${appId}`);
    }

    console.log(`🐳 Quick start container launched: ${containerName}`);

    this.runningContainers.set(appId, {
      process,
      containerName,
      appId,
      isReady: false,
      installedDependencies: skipInstall || false,
    });

    if (process.stdout) {
      process.stdout.on('data', (data: any) => {
        const output = data.toString();
        console.log(`[App ${appId}] ${output.trim()}`);
        
        const container = this.runningContainers.get(appId);
        if (container) {
          if (output.includes('Local:') || output.includes('ready in')) {
            container.isReady = true;
            console.log(`✅ Container ready and serving at http://localhost:${this.config.port}`);
          }
          if (output.includes('packages in') || output.includes('Already up to date')) {
            container.installedDependencies = true;
          }
        }
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data: any) => {
        console.error(`[App ${appId} ERR] ${data.toString().trim()}`);
      });
    }

    process.on('close', (code: any) => {
      console.log(`Container ${containerName} exited with code: ${code}`);
      this.runningContainers.delete(appId);
    });

    process.on('error', (err: any) => {
      console.error(`Container error for app ${appId}:`, err);
      this.runningContainers.delete(appId);
    });
  }

  /**
   * Check if container is ready to serve requests
   */
  isContainerReady(appId: number): boolean {
    const container = this.runningContainers.get(appId);
    return container?.isReady || false;
  }

  /**
   * Check if dependencies are installed in container
   */
  hasDependenciesInstalled(appId: number): boolean {
    const container = this.runningContainers.get(appId);
    return container?.installedDependencies || false;
  }

  /**
   * Remove Docker volumes for an app
   */
  async removeAppVolumes(appId: number): Promise<void> {
    const pnpmVolume = `dyad-pnpm-${appId}`;
    
    return new Promise<void>((resolve) => {
      const rm = spawn('docker', ['volume', 'rm', '-f', pnpmVolume], {
        stdio: 'pipe',
      });
      rm.on('close', () => {
        console.log(`Removed Docker volume: ${pnpmVolume}`);
        resolve();
      });
      rm.on('error', () => {
        console.log(`Failed to remove Docker volume: ${pnpmVolume}`);
        resolve();
      });
    });
  }

  /**
   * Check if app is running in Docker
   */
  isAppRunning(appId: number): boolean {
    return this.runningContainers.has(appId);
  }

  /**
   * Get all running containers
   */
  getRunningContainers(): number[] {
    return Array.from(this.runningContainers.keys());
  }

  /**
   * Get the command to run in the container
   */
  private getCommand(params: {
    installCommand?: string | null;
    startCommand?: string | null;
  }): string {
    const { installCommand, startCommand } = params;
    const hasCustomCommands = !!installCommand?.trim() && !!startCommand?.trim();
    
    if (hasCustomCommands) {
      // Inject port into custom commands if they don't specify it
      const finalStartCommand = startCommand!.trim();
      
      // Check if port is already specified in the command
      if (!finalStartCommand.includes('--port') && !finalStartCommand.includes('-p ')) {
        // For common dev servers, append the port flag
        if (finalStartCommand.includes('vite') || finalStartCommand.includes('dev')) {
          return `${installCommand!.trim()} && ${finalStartCommand} --host 0.0.0.0 --port ${this.config.port}`;
        } else if (finalStartCommand.includes('next')) {
          return `${installCommand!.trim()} && ${finalStartCommand} -p ${this.config.port}`;
        } else if (finalStartCommand.includes('react-scripts')) {
          return `${installCommand!.trim()} && PORT=${this.config.port} ${finalStartCommand}`;
        }
      }
      
      return `${installCommand!.trim()} && ${finalStartCommand}`;
    }
    
    // Default command (Vite-based projects)
    return `pnpm install && pnpm dev --host 0.0.0.0 --port ${this.config.port}`;
  }

  /**
   * Verify files are visible inside the container after mount
   */
  private async verifyContainerFiles(containerName: string, filePaths: string[]): Promise<void> {
    console.log(`[Docker] Verifying files inside container: ${containerName}`);
    
    for (const filePath of filePaths.slice(0, 3)) { // Check first 3 files
      try {
          const result = await new Promise<string>((resolve, reject) => {
          const exec = spawn('docker', ['exec', containerName, 'ls', '-la', `/app/${filePath}`], {
            stdio: 'pipe',
          });
          
          let output = '';
          exec.stdout?.on('data', (data: any) => {
            output += data.toString();
          });
          
          exec.on('close', (code: any) => {
            if (code === 0) {
              resolve(output);
            } else {
              reject(new Error(`File not found: ${filePath}`));
            }
          });
          
          exec.on('error', (err: any) => {
            reject(err);
          });
        });
        
        console.log(`[Docker] File visible in container: ${filePath}`);
      } catch (err) {
        console.error(`[Docker] File NOT visible in container: ${filePath}`, err);
      }
    }
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
