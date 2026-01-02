/**
 * Containerization Module Exports
 * Central export point for all containerization components
 */

// Types and interfaces
export * from './types';

// Factory
export { ContainerFactory, createContainerFactory } from './ContainerFactory';

// Handlers
export { AbstractContainerHandler } from './handlers/AbstractContainerHandler';
export { DockerHandler } from './handlers/DockerHandler';
export { PodmanHandler } from './handlers/PodmanHandler';

// Service
export { ContainerizationService, containerizationService } from '../services/containerization_service';

// Configuration
export {
  loadContainerizationConfig,
  getEngineConfig,
  isContainerizationEnabled,
  getContainerEngine,
  displayConfig
} from '../config/containerization.config';
