/**
 * Core types and interfaces for the containerization factory pattern
 */

/**
 * Supported container engine types
 */
export type ContainerEngineType = 'docker' | 'podman' | 'tanzu' | 'kubernetes';

/**
 * Container status information
 */
export interface ContainerStatus {
  appId: string;
  isRunning: boolean;
  isReady: boolean;
  hasDependenciesInstalled: boolean;
  containerName: string | null;
  port: number | null;
  status?: string; // 'running' | 'stopped' | 'starting' | 'error'
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  uptime?: number;
  error?: string;
}

/**
 * Container configuration
 */
export interface ContainerConfig {
  enabled: boolean;
  engine: ContainerEngineType;
  port: number;
  image: string;
  resourceLimits?: {
    memory?: string;
    cpus?: number;
  };
  environmentVariables?: Record<string, string>;
  volumes?: Array<{
    host: string;
    container: string;
    readOnly?: boolean;
  }>;
  networkMode?: string;
  restartPolicy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
}

/**
 * Options for running a container
 */
export interface RunContainerOptions {
  appId: string;
  appPath: string;
  port: number;
  forceRecreate?: boolean;
  skipInstall?: boolean;
  cpuLimit?: string;
  memoryLimit?: string;
  environmentVariables?: Record<string, string>;
  volumeMounts?: Array<{
    host: string;
    container: string;
    readOnly?: boolean;
  }>;
}

/**
 * Options for syncing files to a container
 */
export interface SyncFilesOptions {
  appId: string;
  filePaths?: string[];
  fullSync?: boolean;
}

/**
 * Result of a container operation
 */
export interface ContainerOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Container engine handler interface
 * All container engines must implement this interface
 */
export interface IContainerEngine {
  /**
   * Initialize the container engine (check availability, setup, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Check if the container engine is available and running
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the version of the container engine
   */
  getVersion(): Promise<string>;

  /**
   * Run a container for an application
   */
  runContainer(options: RunContainerOptions): Promise<ContainerOperationResult>;

  /**
   * Stop a running container
   */
  stopContainer(appId: string): Promise<ContainerOperationResult>;

  /**
   * Get the status of a container
   */
  getContainerStatus(appId: string): Promise<ContainerStatus>;

  /**
   * Check if a container exists
   */
  containerExists(appId: string): Promise<boolean>;

  /**
   * Check if a container is running
   */
  isContainerRunning(appId: string): Promise<boolean>;

  /**
   * Check if a container is ready to accept requests
   */
  isContainerReady(appId: string): Promise<boolean>;

  /**
   * Check if dependencies are installed in the container
   */
  hasDependenciesInstalled(appId: string): Promise<boolean>;

  /**
   * Sync files to a running container
   */
  syncFilesToContainer(options: SyncFilesOptions): Promise<ContainerOperationResult>;

  /**
   * Execute a command in a running container
   */
  execInContainer(appId: string, command: string[]): Promise<ContainerOperationResult>;

  /**
   * Get logs from a container
   */
  getContainerLogs(appId: string, lines?: number): Promise<string>;

  /**
   * Stream logs from a container in real-time
   */
  streamLogs(options: {
    appId: string;
    follow?: boolean;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<AsyncIterable<string>>;

  /**
   * Get logs with options
   */
  getLogs(options: {
    appId: string;
    tail?: number;
    since?: string;
    timestamps?: boolean;
  }): Promise<string>;

  /**
   * Get container lifecycle events
   */
  getEvents(appId: string): Promise<any[]>;

  /**
   * Remove a container
   */
  removeContainer(appId: string, force?: boolean): Promise<ContainerOperationResult>;

  /**
   * Cleanup volumes associated with an app
   */
  cleanupVolumes(appId: string): Promise<ContainerOperationResult>;

  /**
   * Get container engine specific info
   */
  getEngineInfo(): Promise<any>;

  /**
   * Get the container name for an app
   */
  getContainerName(appId: string): string;
}

/**
 * Factory configuration
 */
export interface ContainerizationConfig {
  enabled: boolean;
  engine: ContainerEngineType;
  docker?: {
    socket?: string;
    host?: string;
    port?: number;
    image: string;
    defaultPort: number;
  };
  podman?: {
    socket?: string;
    image: string;
    defaultPort: number;
  };
  tanzu?: {
    apiUrl: string;
    namespace: string;
    image: string;
  };
  kubernetes?: {
    config: string;
    namespace: string;
    image: string;
  };
}
