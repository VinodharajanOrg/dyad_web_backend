# Containerization Factory Pattern - End-to-End Flow

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION REQUEST                              │
│  "Start app ID 123 in a container"                                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROUTE HANDLER (Express)                               │
│  POST /api/apps/:appId/run                                              │
│                                                                          │
│  router.post('/api/apps/:appId/run', async (req, res) => {              │
│    const result = await containerizationService.runContainer({          │
│      appId: req.params.appId,                                           │
│      appPath: app.path,                                                 │
│      port: 32100                                                        │
│    });                                                                  │
│  });                                                                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              CONTAINERIZATION SERVICE (Facade)                           │
│  src/services/containerization_service.ts                               │
│                                                                          │
│  1. Check if enabled                                                    │
│     if (!this.enabled) return disabled_response                         │
│                                                                          │
│  2. Get handler from factory                                            │
│     const handler = this.factory.getCurrentHandler()                    │
│                                                                          │
│  3. Delegate to handler                                                 │
│     return await handler.runContainer(options)                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   CONTAINER FACTORY                                      │
│  src/containerization/ContainerFactory.ts                               │
│                                                                          │
│  1. Read configuration                                                  │
│     const config = loadContainerizationConfig()                         │
│     // enabled: true                                                    │
│     // engine: 'docker'                                                 │
│                                                                          │
│  2. Check cache                                                         │
│     if (this.handlers.has('docker'))                                    │
│       return cached_handler                                             │
│                                                                          │
│  3. Create handler                                                      │
│     const constructor = HANDLER_REGISTRY['docker']                      │
│     const handler = constructor(config)                                 │
│     this.handlers.set('docker', handler)                                │
│                                                                          │
│  4. Return handler                                                      │
│     return handler                                                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DOCKER HANDLER                                      │
│  src/containerization/handlers/DockerHandler.ts                         │
│                                                                          │
│  async runContainer(options) {                                          │
│    1. Get container name                                                │
│       containerName = 'dyad-app-123'                                    │
│       volumeName = 'dyad-app-123-pnpm-store'                            │
│                                                                          │
│    2. Check if container exists                                         │
│       exists = await this.containerExists(appId)                        │
│       if (exists && !forceRecreate)                                     │
│         return "Container already running"                              │
│                                                                          │
│    3. Create volume                                                     │
│       await execute('docker volume create ' + volumeName)               │
│                                                                          │
│    4. Build run command                                                 │
│       const cmd = `docker run -d                                        │
│         --name ${containerName}                                         │
│         -p 32100:32100                                                  │
│         -v ${appPath}:/app                                              │
│         -v ${volumeName}:/app/.pnpm-store                               │
│         -e PORT=32100                                                   │
│         -w /app                                                         │
│         node:22-alpine                                                  │
│         sh -c "pnpm install && pnpm dev"`                               │
│                                                                          │
│    5. Execute command                                                   │
│       await this.execute(cmd)                                           │
│                                                                          │
│    6. Wait for ready                                                    │
│       ready = await this.waitForCondition(                              │
│         () => this.isContainerReady(appId),                             │
│         60000                                                           │
│       )                                                                 │
│                                                                          │
│    7. Return result                                                     │
│       return {                                                          │
│         success: true,                                                  │
│         message: 'Container started',                                   │
│         data: { containerName, port: 32100 }                            │
│       }                                                                 │
│  }                                                                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ABSTRACT HANDLER                                    │
│  src/containerization/handlers/AbstractContainerHandler.ts              │
│                                                                          │
│  protected async execute(command: string) {                             │
│    const { stdout } = await execAsync(command);                         │
│    return stdout.trim();                                                │
│  }                                                                      │
│                                                                          │
│  protected async waitForCondition(                                      │
│    condition: () => Promise<boolean>,                                   │
│    timeout: number                                                      │
│  ) {                                                                    │
│    while (Date.now() - start < timeout) {                               │
│      if (await condition()) return true;                                │
│      await sleep(500);                                                  │
│    }                                                                    │
│    return false;                                                        │
│  }                                                                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SYSTEM EXECUTION                                      │
│                                                                          │
│  $ docker run -d --name dyad-app-123 -p 32100:32100 ...                │
│                                                                          │
│  Container ID: abc123def456                                             │
│  Status: Running                                                        │
│  Port: 32100 → 32100                                                    │
│                                                                          │
│  $ docker logs dyad-app-123                                             │
│  Installing dependencies...                                             │
│  VITE v5.0.0 ready in 500ms                                             │
│  ➜ Local: http://localhost:32100/                                      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        RESPONSE TO CLIENT                                │
│                                                                          │
│  HTTP 200 OK                                                            │
│  {                                                                      │
│    "success": true,                                                     │
│    "message": "Container started successfully",                         │
│    "data": {                                                            │
│      "containerName": "dyad-app-123",                                   │
│      "port": 32100,                                                     │
│      "appId": "123",                                                    │
│      "url": "http://localhost:32100"                                    │
│    }                                                                    │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Flow

```
┌────────────────────────────────────────────────────────────┐
│                    .env FILE                               │
│                                                            │
│  CONTAINERIZATION_ENABLED=true                            │
│  CONTAINERIZATION_ENGINE=docker                           │
│  DOCKER_IMAGE=node:22-alpine                              │
│  DOCKER_DEFAULT_PORT=32100                                │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│       CONFIG LOADER (containerization.config.ts)           │
│                                                            │
│  function loadContainerizationConfig() {                  │
│    return {                                               │
│      enabled: process.env.CONTAINERIZATION_ENABLED,       │
│      engine: process.env.CONTAINERIZATION_ENGINE,         │
│      docker: {                                            │
│        image: process.env.DOCKER_IMAGE,                   │
│        defaultPort: parseInt(process.env.DOCKER_DEFAULT_PORT)│
│      }                                                    │
│    }                                                      │
│  }                                                        │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│                   FACTORY INITIALIZATION                   │
│                                                            │
│  const config = loadContainerizationConfig()              │
│  const factory = ContainerFactory.getInstance(config)     │
│  await factory.initialize()                               │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│              SERVICE INITIALIZATION                        │
│                                                            │
│  const service = ContainerizationService.getInstance()    │
│  await service.initialize()                               │
│  // Output: ✓ Containerization enabled using docker      │
└────────────────────────────────────────────────────────────┘
```

## Switch Engine Flow

```
┌────────────────────────────────────────────────────────────┐
│              SWITCH FROM DOCKER TO PODMAN                  │
└────────────────────────────────────────────────────────────┘

Step 1: Update .env
┌────────────────────────────────────────────┐
│  CONTAINERIZATION_ENGINE=podman            │
│  PODMAN_IMAGE=node:22-alpine              │
│  PODMAN_DEFAULT_PORT=32100                │
└────────────────────┬───────────────────────┘
                     │
Step 2: Restart Backend
                     │
                     ▼
┌────────────────────────────────────────────┐
│  $ npm run dev                            │
│  Config reloaded                          │
│  Factory cleared cache                    │
└────────────────────┬───────────────────────┘
                     │
Step 3: Next Request
                     │
                     ▼
┌────────────────────────────────────────────┐
│  factory.getCurrentHandler()              │
│  // Returns PodmanHandler instead         │
│  // All operations now use Podman         │
└────────────────────────────────────────────┘
```

## Disable Containerization Flow

```
┌────────────────────────────────────────────────────────────┐
│              DISABLE CONTAINERIZATION                      │
└────────────────────────────────────────────────────────────┘

Step 1: Set enabled=false
┌────────────────────────────────────────────┐
│  CONTAINERIZATION_ENABLED=false            │
└────────────────────┬───────────────────────┘
                     │
Step 2: Request comes in
                     │
                     ▼
┌────────────────────────────────────────────┐
│  containerizationService.runContainer()   │
│                                           │
│  if (!this.enabled) {                     │
│    return {                               │
│      success: false,                      │
│      message: 'Containerization disabled' │
│    }                                      │
│  }                                        │
└────────────────────┬───────────────────────┘
                     │
Step 3: Graceful response
                     │
                     ▼
┌────────────────────────────────────────────┐
│  HTTP 200 OK (not an error)               │
│  {                                        │
│    "success": false,                      │
│    "message": "Containerization disabled" │
│  }                                        │
│                                           │
│  // App falls back to local execution    │
└────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌────────────────────────────────────────────────────────────┐
│                    ERROR SCENARIOS                         │
└────────────────────────────────────────────────────────────┘

Scenario 1: Docker not installed
┌────────────────────────────────────────────┐
│  handler.isAvailable()                    │
│  // Runs: docker --version                │
│  // Throws: Command not found             │
│  // Returns: false                        │
└────────────────────┬───────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────┐
│  service.initialize()                     │
│  // Logs: Docker is not available         │
│  // Throws: Error with helpful message    │
└────────────────────────────────────────────┘

Scenario 2: Container fails to start
┌────────────────────────────────────────────┐
│  handler.runContainer()                   │
│  // Runs: docker run...                   │
│  // Command fails                         │
│  // Catches error                         │
└────────────────────┬───────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────┐
│  return {                                 │
│    success: false,                        │
│    message: 'Failed to run container',    │
│    error: error.message                   │
│  }                                        │
└────────────────────────────────────────────┘

Scenario 3: Container never becomes ready
┌────────────────────────────────────────────┐
│  await waitForCondition(                  │
│    () => isContainerReady(),              │
│    60000                                  │
│  )                                        │
│  // Returns: false after timeout          │
└────────────────────┬───────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────┐
│  const logs = getContainerLogs(50)        │
│  return {                                 │
│    success: false,                        │
│    message: 'Container not ready',        │
│    error: logs                            │
│  }                                        │
└────────────────────────────────────────────┘
```

## Add New Engine Flow (Tanzu Example)

```
┌────────────────────────────────────────────────────────────┐
│              ADD VMWARE TANZU SUPPORT                      │
└────────────────────────────────────────────────────────────┘

Step 1: Create Handler
┌────────────────────────────────────────────┐
│  handlers/TanzuHandler.ts                 │
│                                           │
│  export class TanzuHandler                │
│      extends AbstractContainerHandler {   │
│                                           │
│    async runContainer(options) {          │
│      // Use Tanzu CLI commands            │
│      await execute('tanzu apps workload  │
│        create ...')                       │
│    }                                      │
│  }                                        │
└────────────────────┬───────────────────────┘
                     │
Step 2: Register in Factory
                     │
                     ▼
┌────────────────────────────────────────────┐
│  ContainerFactory.ts                      │
│                                           │
│  HANDLER_REGISTRY = {                     │
│    docker: ...,                           │
│    podman: ...,                           │
│    tanzu: (config) => new TanzuHandler(  │
│      config.tanzu.apiUrl,                 │
│      config.tanzu.namespace               │
│    )                                      │
│  }                                        │
└────────────────────┬───────────────────────┘
                     │
Step 3: Add Config Type
                     │
                     ▼
┌────────────────────────────────────────────┐
│  types.ts                                 │
│                                           │
│  export type ContainerEngineType =        │
│    'docker' | 'podman' | 'tanzu'          │
│                                           │
│  export interface ContainerizationConfig {│
│    tanzu?: {                              │
│      apiUrl: string;                      │
│      namespace: string;                   │
│    }                                      │
│  }                                        │
└────────────────────┬───────────────────────┘
                     │
Step 4: Add Config Loader
                     │
                     ▼
┌────────────────────────────────────────────┐
│  containerization.config.ts               │
│                                           │
│  tanzu: {                                 │
│    apiUrl: process.env.TANZU_API_URL,     │
│    namespace: process.env.TANZU_NAMESPACE │
│  }                                        │
└────────────────────┬───────────────────────┘
                     │
Step 5: Use It
                     │
                     ▼
┌────────────────────────────────────────────┐
│  .env                                     │
│  CONTAINERIZATION_ENGINE=tanzu            │
│  TANZU_API_URL=https://tanzu.example.com  │
│  TANZU_NAMESPACE=dev                      │
│                                           │
│  // Restart → automatically uses Tanzu   │
└────────────────────────────────────────────┘
```

## Summary

### Key Points:

1. **Enabled/Disabled**: Controlled by `CONTAINERIZATION_ENABLED` flag
   - When false: All operations return gracefully
   - When true: Factory loads appropriate engine

2. **Engine Selection**: Controlled by `CONTAINERIZATION_ENGINE`
   - Current: `docker`, `podman`
   - Future: `tanzu`, `kubernetes`
   - Extensible: Register custom engines

3. **Factory Pattern**: Dynamically creates handlers
   - Singleton instance
   - Caches handlers
   - Validates configuration

4. **Facade Service**: Unified API
   - Handles enabled state
   - Delegates to factory
   - Wraps errors gracefully

5. **Handler Hierarchy**: Abstract base + concrete implementations
   - Common utilities in AbstractContainerHandler
   - Engine-specific logic in concrete handlers
   - All implement IContainerEngine interface

6. **Configuration-Driven**: All behavior via environment variables
   - No code changes to switch engines
   - Easy to add new engines
   - Validates configuration on startup

7. **Error Handling**: Comprehensive error management
   - Graceful degradation
   - Helpful error messages
   - Automatic retries where appropriate

8. **Extensibility**: Add new engines without modifying existing code
   - Create handler class
   - Register in factory
   - Add configuration
   - Done!
