/**
 * Container Factory
 * Dynamically selects and creates the appropriate container engine handler
 * based on configuration
 */

import { IContainerEngine, ContainerizationConfig, ContainerEngineType } from './types';
import { DockerHandler } from './handlers/DockerHandler';
import { PodmanHandler } from './handlers/PodmanHandler';

/**
 * Registry of available container engine handlers
 * Extend this map to add support for new container engines
 */
type HandlerConstructor = (config: ContainerizationConfig) => IContainerEngine;

const HANDLER_REGISTRY: Record<ContainerEngineType, HandlerConstructor> = {
  docker: (config: ContainerizationConfig) => {
    const dockerConfig = config.docker || { image: 'node:22-alpine', defaultPort: 32100 };
    return new DockerHandler(dockerConfig.image, dockerConfig.defaultPort);
  },

  podman: (config: ContainerizationConfig) => {
    const podmanConfig = config.podman || { image: 'node:22-alpine', defaultPort: 32100 };
    return new PodmanHandler(podmanConfig.image, podmanConfig.defaultPort, podmanConfig.socket);
  },

  tanzu: (config: ContainerizationConfig) => {
    // Placeholder for VMware Tanzu handler
    // Implementation would go in handlers/TanzuHandler.ts
    throw new Error(
      'Tanzu handler not yet implemented. Create handlers/TanzuHandler.ts to add support.'
    );
  },

  kubernetes: (config: ContainerizationConfig) => {
    // Placeholder for Kubernetes handler
    // Implementation would go in handlers/KubernetesHandler.ts
    throw new Error(
      'Kubernetes handler not yet implemented. Create handlers/KubernetesHandler.ts to add support.'
    );
  },
};

/**
 * Container Factory class
 * Manages creation and lifecycle of container engine handlers
 */
export class ContainerFactory {
  private static instance: ContainerFactory;
  private readonly handlers: Map<ContainerEngineType, IContainerEngine> = new Map();
  private config: ContainerizationConfig;

  private constructor(config: ContainerizationConfig) {
    this.config = config;
  }

  /**
   * Get singleton instance of ContainerFactory
   */
  static getInstance(config: ContainerizationConfig): ContainerFactory {
    if (!ContainerFactory.instance) {
      ContainerFactory.instance = new ContainerFactory(config);
    }
    return ContainerFactory.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    ContainerFactory.instance = null as any;
  }

  /**
   * Get or create a container engine handler
   */
  getHandler(engineType?: ContainerEngineType): IContainerEngine {
    const engine = engineType || this.config.engine;

    // Return cached handler if available
    if (this.handlers.has(engine)) {
      return this.handlers.get(engine)!;
    }

    // Create new handler
    const handlerConstructor = HANDLER_REGISTRY[engine];
    if (!handlerConstructor) {
      throw new Error(
        `Unsupported container engine: ${engine}. Supported engines: ${Object.keys(
          HANDLER_REGISTRY
        ).join(', ')}`
      );
    }

    const handler = handlerConstructor(this.config);
    this.handlers.set(engine, handler);

    return handler;
  }

  /**
   * Get the currently configured container engine handler
   */
  getCurrentHandler(): IContainerEngine {
    return this.getHandler();
  }

  /**
   * Check if containerization is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the configured engine type
   */
  getEngineType(): ContainerEngineType {
    return this.config.engine;
  }

  /**
   * Get the full configuration
   */
  getConfig(): ContainerizationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (useful for dynamic reconfiguration)
   */
  updateConfig(newConfig: Partial<ContainerizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Clear cached handlers if engine changed
    if (newConfig.engine && newConfig.engine !== this.config.engine) {
      this.handlers.clear();
    }
  }

  /**
   * Register a custom container engine handler
   * This allows third-party integrations without modifying core code
   * 
   * Example:
   * ```typescript
   * factory.registerHandler('custom-engine', (config) => new CustomHandler(config));
   * ```
   */
  registerHandler(
    engineType: string,
    handlerConstructor: HandlerConstructor
  ): void {
    HANDLER_REGISTRY[engineType as ContainerEngineType] = handlerConstructor;
  }

  /**
   * Get list of supported engine types
   */
  getSupportedEngines(): ContainerEngineType[] {
    return Object.keys(HANDLER_REGISTRY) as ContainerEngineType[];
  }

  /**
   * Check if an engine type is supported
   */
  isEngineSupported(engineType: string): boolean {
    return engineType in HANDLER_REGISTRY;
  }

  /**
   * Initialize the current handler
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Containerization is disabled');
      return;
    }

    const handler = this.getCurrentHandler();
    await handler.initialize();
  }

  /**
   * Check if the current engine is available
   */
  async isCurrentEngineAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const handler = this.getCurrentHandler();
      return await handler.isAvailable();
    } catch {
      return false;
    }
  }
}

/**
 * Helper function to create a factory instance
 */
export function createContainerFactory(config: ContainerizationConfig): ContainerFactory {
  return ContainerFactory.getInstance(config);
}
