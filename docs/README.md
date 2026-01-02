# Containerization Factory Pattern

## Overview

This directory contains the containerization factory pattern implementation that provides a flexible, extensible architecture for managing container engines (Docker, Podman, Tanzu, Kubernetes, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                          │
│        (Routes, Controllers, Business Logic)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            ContainerizationService (Facade)                 │
│  - Handles enabled/disabled state                           │
│  - Provides unified API                                     │
│  - Delegates to factory                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              ContainerFactory (Factory Pattern)             │
│  - Dynamically selects engine based on config               │
│  - Caches engine instances                                  │
│  - Supports custom engine registration                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────┴────────────────┐
        │                                  │
        ▼                                  ▼
┌──────────────────┐              ┌──────────────────┐
│  DockerHandler   │              │  PodmanHandler   │
│  (Implements     │              │  (Implements     │
│  IContainerEngine)│              │  IContainerEngine)│
└──────────────────┘              └──────────────────┘
        │                                  │
        └────────────────┬─────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ AbstractContainerHandler│
              │  - Common utilities    │
              │  - Base functionality  │
              └──────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  IContainerEngine    │
              │  (Interface)         │
              │  - Defines contract  │
              └──────────────────────┘
```

## Key Components

### 1. **types.ts**
Defines all TypeScript interfaces and types:
- `IContainerEngine` - Core interface all engines must implement
- `ContainerStatus` - Status information
- `ContainerConfig` - Configuration structure
- `RunContainerOptions` - Options for running containers
- etc.

### 2. **AbstractContainerHandler**
Base class providing common functionality:
- Command execution utilities
- Container naming conventions
- Wait conditions and retry logic
- Success/failure result helpers
- JSON parsing, sleep utilities

### 3. **Engine Handlers**

#### DockerHandler
- Implements Docker-specific operations
- Uses `docker` CLI commands
- Volume management
- Port mapping

#### PodmanHandler
- Implements Podman-specific operations
- Uses `podman` CLI commands
- SELinux context handling (`:Z` flag)
- Rootless container support

### 4. **ContainerFactory**
Factory pattern implementation:
- Singleton pattern for instance management
- Dynamic engine selection based on config
- Engine instance caching
- Support for custom engine registration
- Validation and error handling

### 5. **ContainerizationService**
Facade service providing:
- Unified API for all container operations
- Enabled/disabled state handling
- Error wrapping and logging
- Backward compatibility

### 6. **Configuration**
Environment-based configuration:
- `CONTAINERIZATION_ENABLED` - Enable/disable globally
- `CONTAINERIZATION_ENGINE` - Select engine type
- Engine-specific configuration (ports, images, etc.)

## Configuration

### Enable Containerization

```bash
# .env file
CONTAINERIZATION_ENABLED=true
CONTAINERIZATION_ENGINE=docker
```

### Disable Containerization

```bash
# .env file
CONTAINERIZATION_ENABLED=false
```

When disabled, all container operations return gracefully without errors.

### Docker Configuration

```bash
CONTAINERIZATION_ENGINE=docker
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_IMAGE=node:22-alpine
DOCKER_DEFAULT_PORT=32100
```

### Podman Configuration

```bash
CONTAINERIZATION_ENGINE=podman
PODMAN_SOCKET=/run/user/1000/podman/podman.sock
PODMAN_IMAGE=node:22-alpine
PODMAN_DEFAULT_PORT=32100
```

### VMware Tanzu Configuration (Future)

```bash
CONTAINERIZATION_ENGINE=tanzu
TANZU_API_URL=https://tanzu-api.example.com
TANZU_NAMESPACE=development
TANZU_IMAGE=node:22-alpine
```

### Kubernetes Configuration (Future)

```bash
CONTAINERIZATION_ENGINE=kubernetes
KUBECONFIG=~/.kube/config
K8S_NAMESPACE=default
K8S_IMAGE=node:22-alpine
```

## Usage

### Basic Usage

```typescript
import { containerizationService } from './services/containerization_service';

// Check if enabled
if (containerizationService.isEnabled()) {
  // Run a container
  const result = await containerizationService.runContainer({
    appId: '123',
    appPath: '/path/to/app',
    port: 32100,
  });

  if (result.success) {
    console.log('Container started:', result.data);
  } else {
    console.error('Failed:', result.error);
  }
}
```

### Get Container Status

```typescript
const status = await containerizationService.getContainerStatus('123');
console.log({
  isRunning: status.isRunning,
  isReady: status.isReady,
  hasDependencies: status.hasDependenciesInstalled,
  port: status.port,
});
```

### Stop Container

```typescript
const result = await containerizationService.stopContainer('123');
if (result.success) {
  console.log('Container stopped');
}
```

### Sync Files

```typescript
await containerizationService.syncFilesToContainer({
  appId: '123',
  filePaths: ['src/App.tsx', 'src/components/Button.tsx'],
});
```

### Get Service Status

```typescript
const serviceStatus = await containerizationService.getServiceStatus();
console.log({
  enabled: serviceStatus.enabled,
  engine: serviceStatus.engine,        // 'docker' or 'podman'
  available: serviceStatus.available,  // true if engine is running
  version: serviceStatus.version,      // 'Docker version 24.0.0'
});
```

## Adding a New Container Engine

To add support for a new container engine (e.g., VMware Tanzu):

### Step 1: Create Handler Class

Create `handlers/TanzuHandler.ts`:

```typescript
import { AbstractContainerHandler } from './AbstractContainerHandler';
import { ContainerStatus, RunContainerOptions, ContainerOperationResult } from '../types';

export class TanzuHandler extends AbstractContainerHandler {
  private apiUrl: string;
  private namespace: string;
  private image: string;

  constructor(apiUrl: string, namespace: string, image: string) {
    super('tanzu');
    this.apiUrl = apiUrl;
    this.namespace = namespace;
    this.image = image;
  }

  async initialize(): Promise<void> {
    // Check Tanzu CLI availability
    const hasTanzuCli = await this.commandExists('tanzu');
    if (!hasTanzuCli) {
      throw new Error('Tanzu CLI not found');
    }
    this.initialized = true;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.execute('tanzu version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return await this.execute('tanzu version');
  }

  async runContainer(options: RunContainerOptions): Promise<ContainerOperationResult> {
    // Implement Tanzu-specific container creation
    // Use Tanzu API or CLI to deploy
    try {
      const deployCommand = `tanzu apps workload create ${this.getContainerName(options.appId)} 
        --namespace ${this.namespace} 
        --image ${this.image} 
        --port ${options.port} 
        --source-image ${options.appPath}`;
      
      await this.execute(deployCommand);
      
      return this.success('Tanzu workload created', {
        containerName: this.getContainerName(options.appId),
        port: options.port,
      });
    } catch (error: any) {
      return this.failure('Failed to create Tanzu workload', error.message);
    }
  }

  async stopContainer(appId: string): Promise<ContainerOperationResult> {
    try {
      const workloadName = this.getContainerName(appId);
      await this.execute(`tanzu apps workload delete ${workloadName} --namespace ${this.namespace} --yes`);
      return this.success('Tanzu workload deleted');
    } catch (error: any) {
      return this.failure('Failed to delete workload', error.message);
    }
  }

  async getContainerStatus(appId: string): Promise<ContainerStatus> {
    try {
      const workloadName = this.getContainerName(appId);
      const statusOutput = await this.execute(
        `tanzu apps workload get ${workloadName} --namespace ${this.namespace} --output json`
      );
      const status = this.parseJSON<any>(statusOutput);
      
      return {
        appId,
        isRunning: status?.status?.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True'),
        isReady: status?.status?.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True'),
        hasDependenciesInstalled: true, // Tanzu handles this
        containerName: workloadName,
        port: status?.spec?.port || null,
        status: status?.status?.conditions?.[0]?.status || 'unknown',
      };
    } catch {
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
  }

  // Implement other required methods...
  async containerExists(appId: string): Promise<boolean> { /* ... */ }
  async isContainerRunning(appId: string): Promise<boolean> { /* ... */ }
  async isContainerReady(appId: string): Promise<boolean> { /* ... */ }
  async hasDependenciesInstalled(appId: string): Promise<boolean> { /* ... */ }
  async syncFilesToContainer(options: any): Promise<ContainerOperationResult> { /* ... */ }
  async execInContainer(appId: string, command: string[]): Promise<ContainerOperationResult> { /* ... */ }
  async getContainerLogs(appId: string, lines?: number): Promise<string> { /* ... */ }
  async removeContainer(appId: string, force?: boolean): Promise<ContainerOperationResult> { /* ... */ }
  async cleanupVolumes(appId: string): Promise<ContainerOperationResult> { /* ... */ }
  async getEngineInfo(): Promise<any> { /* ... */ }
}
```

### Step 2: Register in Factory

Update `ContainerFactory.ts`:

```typescript
import { TanzuHandler } from './handlers/TanzuHandler';

const HANDLER_REGISTRY: Record<ContainerEngineType, HandlerConstructor> = {
  // ... existing handlers ...
  
  tanzu: (config: ContainerizationConfig) => {
    const tanzuConfig = config.tanzu;
    if (!tanzuConfig) {
      throw new Error('Tanzu configuration missing');
    }
    return new TanzuHandler(
      tanzuConfig.apiUrl,
      tanzuConfig.namespace,
      tanzuConfig.image
    );
  },
};
```

### Step 3: Add Configuration

Update `types.ts`:

```typescript
export type ContainerEngineType = 'docker' | 'podman' | 'tanzu' | 'kubernetes';

export interface ContainerizationConfig {
  // ... existing config ...
  tanzu?: {
    apiUrl: string;
    namespace: string;
    image: string;
  };
}
```

### Step 4: Update Config Loader

Update `config/containerization.config.ts`:

```typescript
const tanzuConfig = {
  apiUrl: process.env.TANZU_API_URL || '',
  namespace: process.env.TANZU_NAMESPACE || 'default',
  image: process.env.TANZU_IMAGE || 'node:22-alpine',
};

const config: ContainerizationConfig = {
  // ... existing config ...
  tanzu: tanzuConfig,
};
```

### Step 5: Add Environment Variables

Update `.env.example`:

```bash
# VMware Tanzu configuration
CONTAINERIZATION_ENGINE=tanzu
TANZU_API_URL=https://tanzu-api.example.com
TANZU_NAMESPACE=development
TANZU_IMAGE=node:22-alpine
```

### Step 6: Use It

```bash
# Set environment
CONTAINERIZATION_ENABLED=true
CONTAINERIZATION_ENGINE=tanzu
TANZU_API_URL=https://tanzu-api.example.com
TANZU_NAMESPACE=my-namespace
```

```typescript
// Service automatically uses Tanzu
const result = await containerizationService.runContainer({
  appId: '123',
  appPath: '/path/to/app',
  port: 8080,
});
```

## Benefits

1. **Extensibility**: Add new engines without modifying existing code
2. **Separation of Concerns**: Each engine has its own handler
3. **Configuration-Driven**: Change engines via environment variables
4. **Backward Compatibility**: Existing DockerService still works
5. **Testability**: Each component can be tested independently
6. **Graceful Degradation**: System works when containerization is disabled
7. **Type Safety**: Full TypeScript interfaces ensure correctness

## Testing

```typescript
import { ContainerFactory } from './ContainerFactory';
import { loadContainerizationConfig } from '../config/containerization.config';

// Test factory
const config = loadContainerizationConfig();
const factory = ContainerFactory.getInstance(config);

// Get handler
const handler = factory.getCurrentHandler();

// Test operations
const available = await handler.isAvailable();
const version = await handler.getVersion();

console.log({ available, version });
```

## Migration Guide

### From Old DockerService to New Pattern

**Old Code:**
```typescript
import { getDockerService } from './services/docker_service';

const dockerService = getDockerService();
await dockerService.runAppInDocker({
  appId: 123,
  appPath: '/path/to/app',
});
```

**New Code:**
```typescript
import { containerizationService } from './services/containerization_service';

await containerizationService.runContainer({
  appId: '123',
  appPath: '/path/to/app',
  port: 32100,
});
```

## Troubleshooting

### Containerization Not Working

1. Check if enabled:
```typescript
console.log(containerizationService.isEnabled());
```

2. Check engine availability:
```typescript
const status = await containerizationService.getServiceStatus();
console.log(status);
```

3. Check configuration:
```bash
echo $CONTAINERIZATION_ENABLED
echo $CONTAINERIZATION_ENGINE
```

### Switch Engines

```bash
# Switch to Podman
CONTAINERIZATION_ENGINE=podman

# Restart backend
npm run dev
```

## Future Enhancements

- [ ] Kubernetes handler implementation
- [ ] VMware Tanzu handler implementation
- [ ] Container metrics and monitoring
- [ ] Multi-container orchestration
- [ ] Container health checks
- [ ] Automatic failover between engines
- [ ] Container resource limits configuration
- [ ] Network isolation and security policies

## Contributing

When adding a new container engine handler:

1. Extend `AbstractContainerHandler`
2. Implement all methods from `IContainerEngine`
3. Add to `HANDLER_REGISTRY` in `ContainerFactory`
4. Update configuration types
5. Add environment variables
6. Write tests
7. Update documentation

## License

Same as parent project.
