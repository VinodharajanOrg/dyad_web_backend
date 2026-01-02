# Containerization Factory - Quick Reference

## Configuration Flags

```bash
# Enable/disable containerization
CONTAINERIZATION_ENABLED=true|false

# Select container engine
CONTAINERIZATION_ENGINE=docker|podman|tanzu|kubernetes

# Docker config
DOCKER_IMAGE=node:22-alpine
DOCKER_DEFAULT_PORT=32100

# Podman config
PODMAN_IMAGE=node:22-alpine
PODMAN_DEFAULT_PORT=32100
```

## Common Operations

### Check if Enabled
```typescript
if (containerizationService.isEnabled()) {
  // Containerization is enabled
}
```

### Run Container
```typescript
const result = await containerizationService.runContainer({
  appId: '123',
  appPath: '/path/to/app',
  port: 32100,
  forceRecreate: false,
  skipInstall: false,
});
```

### Get Status
```typescript
const status = await containerizationService.getContainerStatus('123');
// status.isRunning, status.isReady, status.hasDependenciesInstalled
```

### Stop Container
```typescript
await containerizationService.stopContainer('123');
```

### Sync Files
```typescript
await containerizationService.syncFilesToContainer({
  appId: '123',
  filePaths: ['src/App.tsx'],
});
```

### Quick Start
```typescript
await containerizationService.quickStartContainer(
  '123',
  '/path/to/app',
  32100,
  true  // skipInstall
);
```

### Cleanup
```typescript
await containerizationService.cleanupVolumes('123');
```

### Get Service Info
```typescript
const status = await containerizationService.getServiceStatus();
// { enabled, engine, available, version }
```

## Switch Engines

### Docker → Podman
```bash
# .env
CONTAINERIZATION_ENGINE=podman
```

### Docker → Tanzu (Future)
```bash
# .env
CONTAINERIZATION_ENGINE=tanzu
TANZU_API_URL=https://tanzu-api.example.com
TANZU_NAMESPACE=development
```

## Disable Containerization
```bash
# .env
CONTAINERIZATION_ENABLED=false
```

All operations will return gracefully without errors.

## File Structure

```
backend/src/
├── containerization/
│   ├── types.ts                    # Interfaces & types
│   ├── ContainerFactory.ts         # Factory pattern
│   ├── index.ts                    # Module exports
│   ├── examples.ts                 # Usage examples
│   ├── README.md                   # Full documentation
│   ├── FLOW.md                     # Flow diagrams
│   └── handlers/
│       ├── AbstractContainerHandler.ts  # Base class
│       ├── DockerHandler.ts             # Docker implementation
│       └── PodmanHandler.ts             # Podman implementation
├── config/
│   └── containerization.config.ts  # Config loader
└── services/
    ├── containerization_service.ts # Facade service
    └── docker_service_refactored.ts # Legacy wrapper
```

## Handler Methods

All handlers implement `IContainerEngine`:

```typescript
interface IContainerEngine {
  initialize(): Promise<void>;
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
  runContainer(options): Promise<ContainerOperationResult>;
  stopContainer(appId): Promise<ContainerOperationResult>;
  getContainerStatus(appId): Promise<ContainerStatus>;
  containerExists(appId): Promise<boolean>;
  isContainerRunning(appId): Promise<boolean>;
  isContainerReady(appId): Promise<boolean>;
  hasDependenciesInstalled(appId): Promise<boolean>;
  syncFilesToContainer(options): Promise<ContainerOperationResult>;
  execInContainer(appId, command): Promise<ContainerOperationResult>;
  getContainerLogs(appId, lines?): Promise<string>;
  removeContainer(appId, force?): Promise<ContainerOperationResult>;
  cleanupVolumes(appId): Promise<ContainerOperationResult>;
  getEngineInfo(): Promise<any>;
  getContainerName(appId): string;
}
```

## Add New Engine (5 Steps)

1. **Create Handler**: `handlers/TanzuHandler.ts`
2. **Register**: Add to `HANDLER_REGISTRY` in `ContainerFactory.ts`
3. **Types**: Add to `ContainerEngineType` in `types.ts`
4. **Config**: Add to `containerization.config.ts`
5. **Use**: Set `CONTAINERIZATION_ENGINE=tanzu` in `.env`

## Error Handling

All methods return `ContainerOperationResult`:
```typescript
{
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}
```

Always check `success`:
```typescript
const result = await containerizationService.runContainer(...);
if (!result.success) {
  console.error(result.error);
}
```

## Testing

```typescript
// Get factory
const factory = ContainerFactory.getInstance(config);

// Check engines
console.log(factory.getSupportedEngines());
// ['docker', 'podman', 'tanzu', 'kubernetes']

// Get handler
const handler = factory.getCurrentHandler();

// Test availability
const available = await handler.isAvailable();
console.log({ available });
```

## CLI Commands

### Docker
```bash
# Run
docker run -d --name dyad-app-123 -p 32100:32100 ...

# Stop
docker stop dyad-app-123

# Remove
docker rm dyad-app-123

# Logs
docker logs dyad-app-123

# Status
docker inspect dyad-app-123
```

### Podman
```bash
# Run
podman run -d --name dyad-app-123 -p 32100:32100 ...

# Stop
podman stop dyad-app-123

# Remove
podman rm dyad-app-123

# Logs
podman logs dyad-app-123

# Status
podman inspect dyad-app-123
```

## Troubleshooting

### Container not starting
```typescript
const status = await containerizationService.getServiceStatus();
console.log(status);
// Check: enabled, engine, available, version
```

### Check logs
```typescript
const logs = await containerizationService.getContainerLogs('123', 100);
console.log(logs);
```

### Force recreate
```typescript
await containerizationService.runContainer({
  appId: '123',
  appPath: '/path/to/app',
  port: 32100,
  forceRecreate: true,  // ← Force rebuild
});
```

## Best Practices

1. **Always check enabled state**
   ```typescript
   if (!containerizationService.isEnabled()) {
     // Fall back to local execution
   }
   ```

2. **Handle errors gracefully**
   ```typescript
   const result = await service.runContainer(...);
   if (!result.success) {
     // Log error and continue
     console.error(result.error);
   }
   ```

3. **Use quick start for speed**
   ```typescript
   // Use quick start when dependencies already installed
   await service.quickStartContainer(appId, path, port, true);
   ```

4. **Clean up resources**
   ```typescript
   await service.stopContainer(appId);
   await service.cleanupVolumes(appId);
   ```

5. **Monitor status**
   ```typescript
   const status = await service.getContainerStatus(appId);
   if (status.isRunning && !status.isReady) {
     // Container starting, wait...
   }
   ```

## Import Paths

```typescript
// Service (recommended)
import { containerizationService } from './services/containerization_service';

// Types
import { ContainerStatus, RunContainerOptions } from './containerization/types';

// Factory (advanced)
import { ContainerFactory } from './containerization/ContainerFactory';

// Config
import { loadContainerizationConfig } from './config/containerization.config';
```

## Version Support

- **Docker**: 20.10+
- **Podman**: 3.0+
- **Tanzu**: Coming soon
- **Kubernetes**: Coming soon

## License

Same as parent project.
