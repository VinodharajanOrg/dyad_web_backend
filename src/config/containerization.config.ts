/**
 * Containerization Configuration
 * Loads and validates environment-based configuration for the container factory
 */

import { ContainerizationConfig, ContainerEngineType } from '../containerization/types';

/**
 * Load containerization configuration from environment variables
 */
export function loadContainerizationConfig(): ContainerizationConfig {
  // Main configuration flags
  const enabled = process.env.CONTAINERIZATION_ENABLED === 'true';
  const engine = (process.env.CONTAINERIZATION_ENGINE || 'docker') as ContainerEngineType;

  // Docker configuration
  const dockerConfig = {
    socket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    host: process.env.DOCKER_HOST,
    port: process.env.DOCKER_PORT ? Number.parseInt(process.env.DOCKER_PORT, 10) : undefined,
    image: process.env.DOCKER_IMAGE || 'node:22-alpine',
    defaultPort: process.env.DOCKER_DEFAULT_PORT
      ? Number.parseInt(process.env.DOCKER_DEFAULT_PORT, 10)
      : 32100,
  };

  // Podman configuration
  const podmanConfig = {
    socket: process.env.PODMAN_SOCKET || '/run/user/1000/podman/podman.sock',
    image: process.env.PODMAN_IMAGE || 'node:22-alpine',
    defaultPort: process.env.PODMAN_DEFAULT_PORT
      ? Number.parseInt(process.env.PODMAN_DEFAULT_PORT, 10)
      : 32100,
  };

  // VMware Tanzu configuration
  const tanzuConfig = {
    apiUrl: process.env.TANZU_API_URL || '',
    namespace: process.env.TANZU_NAMESPACE || 'default',
    image: process.env.TANZU_IMAGE || 'node:22-alpine',
  };

  // Kubernetes configuration
  const kubernetesConfig = {
    config: process.env.KUBECONFIG || '~/.kube/config',
    namespace: process.env.K8S_NAMESPACE || 'default',
    image: process.env.K8S_IMAGE || 'node:22-alpine',
  };

  const config: ContainerizationConfig = {
    enabled,
    engine,
    docker: dockerConfig,
    podman: podmanConfig,
    tanzu: tanzuConfig,
    kubernetes: kubernetesConfig,
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Validate containerization configuration
 */
function validateConfig(config: ContainerizationConfig): void {
  if (!config.enabled) {
    // No validation needed if disabled
    return;
  }

  const supportedEngines: ContainerEngineType[] = ['docker', 'podman', 'tanzu', 'kubernetes'];
  
  if (!supportedEngines.includes(config.engine)) {
    throw new Error(
      `Invalid CONTAINERIZATION_ENGINE: ${config.engine}. Supported: ${supportedEngines.join(', ')}`
    );
  }

  // Validate engine-specific configuration
  switch (config.engine) {
    case 'docker':
      if (!config.docker?.image) {
        throw new Error('DOCKER_IMAGE is required when using Docker engine');
      }
      break;

    case 'podman':
      if (!config.podman?.image) {
        throw new Error('PODMAN_IMAGE is required when using Podman engine');
      }
      break;

    case 'tanzu':
      if (!config.tanzu?.apiUrl) {
        throw new Error('TANZU_API_URL is required when using Tanzu engine');
      }
      break;

    case 'kubernetes':
      if (!config.kubernetes?.config) {
        throw new Error('KUBECONFIG is required when using Kubernetes engine');
      }
      break;
  }
}

/**
 * Get a specific engine configuration
 */
export function getEngineConfig(
  config: ContainerizationConfig,
  engine: ContainerEngineType
): any {
  switch (engine) {
    case 'docker':
      return config.docker;
    case 'podman':
      return config.podman;
    case 'tanzu':
      return config.tanzu;
    case 'kubernetes':
      return config.kubernetes;
    default:
      throw new Error(`Unknown engine: ${engine}`);
  }
}

/**
 * Check if containerization is enabled
 */
export function isContainerizationEnabled(): boolean {
  return process.env.CONTAINERIZATION_ENABLED === 'true';
}

/**
 * Get the configured container engine
 */
export function getContainerEngine(): ContainerEngineType {
  return (process.env.CONTAINERIZATION_ENGINE || 'docker') as ContainerEngineType;
}

/**
 * Display current configuration (for debugging)
 */
export function displayConfig(config: ContainerizationConfig): void {
  console.log('┌─────────────────────────────────────────┐');
  console.log('│  Containerization Configuration         │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│ Enabled: ${config.enabled ? '✓' : '✗'}`.padEnd(42) + '│');
  console.log(`│ Engine: ${config.engine}`.padEnd(42) + '│');
  
  if (config.enabled) {
    console.log('├─────────────────────────────────────────┤');
    const engineConfig = getEngineConfig(config, config.engine);
    console.log(`│ ${config.engine.toUpperCase()} Configuration:`.padEnd(42) + '│');
    
    Object.entries(engineConfig).forEach(([key, value]) => {
      const line = `│   ${key}: ${value}`;
      console.log(line.padEnd(42) + '│');
    });
  }
  
  console.log('└─────────────────────────────────────────┘');
}