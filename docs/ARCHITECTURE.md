# Containerization Factory Pattern - Architecture Diagram

## System Architecture

```
╔════════════════════════════════════════════════════════════════════════════╗
║                          APPLICATION LAYER                                  ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ║
║  │    Routes    │  │  Controllers │  │   Services   │  │   Business   │  ║
║  │  (Express)   │  │              │  │              │  │    Logic     │  ║
║  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  ║
║         │                  │                  │                  │          ║
╚═════════╪══════════════════╪══════════════════╪══════════════════╪══════════╝
          │                  │                  │                  │
          └──────────────────┴──────────────────┴──────────────────┘
                                     │
                                     ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                     CONTAINERIZATION SERVICE (Facade)                       ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │  ContainerizationService                                           │   ║
║  │  • Singleton instance                                              │   ║
║  │  • Checks enabled/disabled state                                   │   ║
║  │  • Provides unified API                                            │   ║
║  │  • Wraps errors gracefully                                         │   ║
║  │  • Delegates to factory                                            │   ║
║  │                                                                     │   ║
║  │  Methods:                                                          │   ║
║  │  • runContainer()          • getContainerStatus()                  │   ║
║  │  • stopContainer()         • syncFilesToContainer()                │   ║
║  │  • quickStartContainer()   • cleanupVolumes()                      │   ║
║  │  • isEnabled()             • getServiceStatus()                    │   ║
║  └────────────────────────────────┬───────────────────────────────────┘   ║
╚═══════════════════════════════════╪════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                      CONTAINER FACTORY (Factory Pattern)                    ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │  ContainerFactory                                                  │   ║
║  │  • Singleton instance                                              │   ║
║  │  • Reads configuration from environment                            │   ║
║  │  • Dynamically selects engine based on config.engine               │   ║
║  │  • Caches handler instances for performance                        │   ║
║  │  • Supports custom engine registration                             │   ║
║  │                                                                     │   ║
║  │  HANDLER_REGISTRY:                                                 │   ║
║  │  {                                                                 │   ║
║  │    docker: (config) => new DockerHandler(...)                      │   ║
║  │    podman: (config) => new PodmanHandler(...)                      │   ║
║  │    tanzu:  (config) => new TanzuHandler(...)   ← Future           │   ║
║  │    kubernetes: (config) => new K8sHandler(...) ← Future           │   ║
║  │  }                                                                 │   ║
║  └────────────────────────────────┬───────────────────────────────────┘   ║
╚═══════════════════════════════════╪════════════════════════════════════════╝
                                    │
                       ┌────────────┴────────────┐
                       │                         │
                       ▼                         ▼
╔═══════════════════════════════╗   ╔═══════════════════════════════╗
║      DOCKER HANDLER           ║   ║      PODMAN HANDLER           ║
║  ┌───────────────────────┐   ║   ║  ┌───────────────────────┐   ║
║  │  DockerHandler        │   ║   ║  │  PodmanHandler        │   ║
║  │  extends Abstract     │   ║   ║  │  extends Abstract     │   ║
║  │                       │   ║   ║  │                       │   ║
║  │  • Uses docker CLI    │   ║   ║  │  • Uses podman CLI    │   ║
║  │  • Volume management  │   ║   ║  │  • SELinux contexts   │   ║
║  │  • Port mapping       │   ║   ║  │  • Rootless support   │   ║
║  │  • Status monitoring  │   ║   ║  │  • Same API as Docker │   ║
║  └───────────────────────┘   ║   ║  └───────────────────────┘   ║
╚═══════════════════════════════╝   ╚═══════════════════════════════╝
                       │                         │
                       └────────────┬────────────┘
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║              ABSTRACT CONTAINER HANDLER (Base Class)                        ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │  AbstractContainerHandler                                          │   ║
║  │  • Common utilities                                                │   ║
║  │  • Container naming: getContainerName(), getVolumeName()           │   ║
║  │  • Command execution: execute(), executeCommand()                  │   ║
║  │  • Waiting logic: waitForCondition()                               │   ║
║  │  • Helpers: sleep(), parseJSON(), commandExists()                  │   ║
║  │  • Result creators: success(), failure()                           │   ║
║  │                                                                     │   ║
║  │  Abstract methods (must be implemented):                           │   ║
║  │  • initialize()           • runContainer()                         │   ║
║  │  • isAvailable()          • stopContainer()                        │   ║
║  │  • getVersion()           • getContainerStatus()                   │   ║
║  │  • containerExists()      • isContainerRunning()                   │   ║
║  │  • isContainerReady()     • hasDependenciesInstalled()             │   ║
║  │  • syncFilesToContainer() • execInContainer()                      │   ║
║  │  • getContainerLogs()     • removeContainer()                      │   ║
║  │  • cleanupVolumes()       • getEngineInfo()                        │   ║
║  └────────────────────────────────────────────────────────────────────┘   ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                    CONTAINER ENGINE INTERFACE                               ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │  IContainerEngine                                                  │   ║
║  │  • Contract for all container engines                              │   ║
║  │  • Defines all required methods                                    │   ║
║  │  • Ensures type safety across handlers                             │   ║
║  │  • TypeScript interface                                            │   ║
║  └────────────────────────────────────────────────────────────────────┘   ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                     CONFIGURATION LAYER                                     ║
║  ┌────────────────────────────────────────────────────────────────────┐   ║
║  │  containerization.config.ts                                        │   ║
║  │  • Loads from environment variables                                │   ║
║  │  • Validates configuration                                         │   ║
║  │  • Supports multiple engines                                       │   ║
║  │                                                                     │   ║
║  │  Environment Variables:                                            │   ║
║  │  • CONTAINERIZATION_ENABLED=true|false                             │   ║
║  │  • CONTAINERIZATION_ENGINE=docker|podman|tanzu|kubernetes          │   ║
║  │  • DOCKER_IMAGE=node:22-alpine                                     │   ║
║  │  • PODMAN_IMAGE=node:22-alpine                                     │   ║
║  │  • TANZU_API_URL=https://...                                       │   ║
║  │  • KUBECONFIG=~/.kube/config                                       │   ║
║  └────────────────────────────────────────────────────────────────────┘   ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔════════════════════════════════════════════════════════════════════════════╗
║                         CONTAINER RUNTIME                                   ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ║
║  │    Docker    │  │    Podman    │  │  VMware Tanzu│  │  Kubernetes  │  ║
║  │   Desktop    │  │              │  │              │  │              │  ║
║  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  ║
╚════════════════════════════════════════════════════════════════════════════╝
```

## Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     Request Flow                                │
└─────────────────────────────────────────────────────────────────┘

1. Application Layer
   │
   ├─→ Calls containerizationService.runContainer()
   │
2. ContainerizationService (Facade)
   │
   ├─→ Checks: if (!this.enabled) return disabled_response
   │
   ├─→ Calls: this.factory.getCurrentHandler()
   │
3. ContainerFactory
   │
   ├─→ Reads: config.engine → 'docker'
   │
   ├─→ Checks cache: this.handlers.has('docker')
   │
   ├─→ If not cached:
   │   │
   │   ├─→ Looks up: HANDLER_REGISTRY['docker']
   │   │
   │   ├─→ Creates: new DockerHandler(config.docker)
   │   │
   │   └─→ Caches: this.handlers.set('docker', handler)
   │
   └─→ Returns: DockerHandler instance
   │
4. DockerHandler
   │
   ├─→ Extends: AbstractContainerHandler
   │
   ├─→ Implements: IContainerEngine
   │
   ├─→ Executes: docker run -d --name dyad-app-123 ...
   │
   ├─→ Waits: waitForCondition(() => isContainerReady())
   │
   └─→ Returns: { success: true, data: {...} }
   │
5. Response to Application
   │
   └─→ Application gets result and handles accordingly
```

## State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                     State Flow                                  │
└─────────────────────────────────────────────────────────────────┘

Environment Variables (.env)
   │
   ├─→ CONTAINERIZATION_ENABLED=true
   ├─→ CONTAINERIZATION_ENGINE=docker
   └─→ DOCKER_IMAGE=node:22-alpine
   │
   ▼
Configuration Loader
   │
   ├─→ Reads and validates
   ├─→ Creates ContainerizationConfig object
   └─→ Returns config
   │
   ▼
ContainerFactory Instance
   │
   ├─→ Stores config
   ├─→ Caches handlers: Map<engine, handler>
   └─→ Manages lifecycle
   │
   ▼
ContainerizationService Instance
   │
   ├─→ Holds factory reference
   ├─→ Tracks enabled state
   └─→ Provides API
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              Data Flow Through Layers                           │
└─────────────────────────────────────────────────────────────────┘

Request Data:
{
  appId: '123',
  appPath: '/path/to/app',
  port: 32100
}
   │
   ▼
Service validates and enriches:
{
  appId: '123',
  appPath: '/path/to/app',
  port: 32100,
  forceRecreate: false,
  skipInstall: false
}
   │
   ▼
Handler receives:
RunContainerOptions
   │
   ▼
Handler executes commands:
docker run -d --name dyad-app-123 ...
   │
   ▼
Handler monitors status:
- Container created
- Dependencies installing
- Server starting
- Container ready
   │
   ▼
Handler returns:
ContainerOperationResult {
  success: true,
  message: 'Container started',
  data: {
    containerName: 'dyad-app-123',
    port: 32100,
    appId: '123'
  }
}
   │
   ▼
Service forwards to application
   │
   ▼
Application responds to client
```

## Configuration Impact

```
┌─────────────────────────────────────────────────────────────────┐
│       How Configuration Changes Affect System                   │
└─────────────────────────────────────────────────────────────────┘

CONTAINERIZATION_ENABLED=false
   │
   └─→ Service: isEnabled() → false
       │
       └─→ All operations: return { success: false, message: 'disabled' }
           │
           └─→ Graceful degradation, no errors thrown

CONTAINERIZATION_ENABLED=true
CONTAINERIZATION_ENGINE=docker
   │
   └─→ Factory: getCurrentHandler() → DockerHandler
       │
       └─→ Operations: use docker commands
           │
           └─→ Containers: managed by Docker

CONTAINERIZATION_ENGINE=podman
   │
   └─→ Factory: getCurrentHandler() → PodmanHandler
       │
       └─→ Operations: use podman commands
           │
           └─→ Containers: managed by Podman

CONTAINERIZATION_ENGINE=tanzu
   │
   └─→ Factory: getCurrentHandler() → TanzuHandler (future)
       │
       └─→ Operations: use Tanzu API/CLI
           │
           └─→ Workloads: managed by Tanzu
```

## Error Propagation

```
┌─────────────────────────────────────────────────────────────────┐
│              Error Handling Flow                                │
└─────────────────────────────────────────────────────────────────┘

System Level (Docker not installed)
   │
   └─→ Handler: isAvailable() → false
       │
       └─→ Service: initialize() → throws Error
           │
           └─→ Application: catches and logs
               │
               └─→ User: sees friendly message

Command Level (docker run fails)
   │
   └─→ Handler: execute() → throws Error
       │
       └─→ Handler: catches → return failure(message, error)
           │
           └─→ Service: forwards result
               │
               └─→ Application: checks result.success
                   │
                   └─→ User: sees error message

Timeout Level (container never ready)
   │
   └─→ Handler: waitForCondition() → returns false
       │
       └─→ Handler: return failure('not ready', logs)
           │
           └─→ Service: forwards result
               │
               └─→ Application: checks result.success
                   │
                   └─→ User: sees timeout message with logs
```

## Extension Points

```
┌─────────────────────────────────────────────────────────────────┐
│              Extension Points for New Engines                   │
└─────────────────────────────────────────────────────────────────┘

1. Create Handler Class
   handlers/NewEngineHandler.ts
   │
   ├─→ Extend: AbstractContainerHandler
   ├─→ Implement: All IContainerEngine methods
   └─→ Add: Engine-specific logic

2. Register in Factory
   ContainerFactory.ts
   │
   └─→ Add to HANDLER_REGISTRY:
       newengine: (config) => new NewEngineHandler(...)

3. Add Type Definition
   types.ts
   │
   └─→ Update ContainerEngineType:
       'docker' | 'podman' | 'newengine'

4. Add Configuration
   containerization.config.ts
   │
   ├─→ Read env vars: process.env.NEWENGINE_*
   └─→ Add to config object: newengine: {...}

5. Document and Test
   │
   ├─→ Update README.md
   ├─→ Add examples to examples.ts
   └─→ Test all methods

Done! New engine ready to use.
```

## Summary

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Easy extensibility
- ✅ Configuration-driven behavior
- ✅ Type safety throughout
- ✅ Comprehensive error handling
- ✅ Graceful degradation
- ✅ Multiple engine support
- ✅ Backward compatibility
- ✅ Production-ready design
