# Container Auto-Shutdown and Resource Configuration

## Overview

This document describes the container auto-shutdown feature and configurable resource limits for containers.

## Features

### 1. Automatic Container Shutdown

Containers are automatically stopped after a configurable period of inactivity to save system resources.

**How it works:**
- The `ContainerLifecycleService` tracks activity for each container
- Activity is recorded when:
  - Container is started/run
  - Container status is checked
  - Commands are executed in the container
  - Container logs are accessed
- A background job runs every 2 minutes checking for inactive containers
- Before stopping a container, the service verifies it's truly inactive by:
  - Checking CPU usage (must be < 1%)
  - Checking network I/O (must be minimal, < 10KB)
  - If container shows activity, it's kept alive and timestamp is updated
- Only containers that are both timeout-exceeded AND showing no activity are stopped

### 2. Server Restart Recovery

**The lifecycle service now handles server restarts gracefully:**

- **Container Discovery**: On startup, discovers all existing containers with the `dyad-app-*` prefix
- **State Restoration**: 
  - Running containers → Registered as active with current timestamp
  - Stopped containers → Registered with past timestamp (will be cleaned up if not restarted)
  - Port allocations → Restored from container port mappings
- **Seamless Continuity**: Existing containers continue to be managed without interruption

**Benefits:**
- ✅ No orphaned containers after server crash/restart
- ✅ Port allocations preserved across restarts
- ✅ Running containers remain tracked and protected
- ✅ Stopped containers automatically cleaned up if not reused

### 3. Configurable Resource Limits

CPU and memory limits can be set for each container to prevent resource exhaustion.

## Environment Variables

Add these to your `.env` file:

```bash
# Container inactivity timeout (in milliseconds)
# Containers will be automatically stopped after this period of inactivity
# Default: 600000 (10 minutes)
CONTAINER_INACTIVITY_TIMEOUT=600000

# Container CPU limit (e.g., 0.5, 1, 2)
# Limits the number of CPUs a container can use
# Default: 1
CONTAINER_CPU_LIMIT=1

# Container memory limit (e.g., 512m, 1g, 2g)
# Limits the amount of memory a container can use
# Default: 1g
CONTAINER_MEMORY_LIMIT=1g
```

## Configuration Examples

### Short Timeout (5 minutes)
```bash
CONTAINER_INACTIVITY_TIMEOUT=300000
```

### Long Timeout (30 minutes)
```bash
CONTAINER_INACTIVITY_TIMEOUT=1800000
```

### Lower Resource Limits (for smaller apps)
```bash
CONTAINER_CPU_LIMIT=0.5
CONTAINER_MEMORY_LIMIT=512m
```

### Higher Resource Limits (for resource-intensive apps)
```bash
CONTAINER_CPU_LIMIT=2
CONTAINER_MEMORY_LIMIT=2g
```

## Implementation Details

### ContainerLifecycleService

Located in: `src/services/container_lifecycle_service.ts`

**Key Methods:**
- `initialize()` - Discovers existing containers on startup
- `recordActivity(appId)` - Records activity for a container
- `allocatePort(appId)` - Allocates a port for a container
- `isContainerActivelyUsed(appId)` - Checks actual container usage (CPU, network)
- `cleanupInactiveContainers()` - Background job that stops truly inactive containers
- `getContainerInfo(appId)` - Returns container status with activity information
- `getStats()` - Returns lifecycle service statistics

**Activity Detection:**
The service uses a two-level detection system:
1. **Tracked Activity**: Records timestamps when containers are accessed via our API
2. **Real-time Stats**: Before stopping, checks actual container metrics:
   - CPU usage (> 1% indicates active)
   - Network I/O (> 10KB indicates active connections)
   - If either metric shows activity, container is kept alive

**Container Discovery:**
On server startup, the service:
1. Queries the container engine for all containers with `dyad-app-*` prefix
2. Extracts app IDs and port mappings
3. Registers running containers as active
4. Marks stopped containers for cleanup (unless restarted)
5. Logs discovered containers for visibility

### Activity Tracking

Activity is automatically tracked in the following operations:
- `ContainerizationService.runContainer()` - When starting a container
- `ContainerizationService.getContainerStatus()` - When checking container status
- `ContainerizationService.execInContainer()` - When executing commands
- `ContainerizationService.getContainerLogs()` - When viewing logs

### Resource Limits

Resource limits are applied when containers are created:
- Docker: `--cpus` and `--memory` flags
- Podman: `--cpus` and `--memory` flags

The limits can be set:
1. Via environment variables (applies to all containers)
2. Via `RunContainerOptions.cpuLimit` and `memoryLimit` (per-container override)

## Monitoring

### Check Container Activity

```typescript
const lifecycleService = ContainerLifecycleService.getInstance();
const info = await lifecycleService.getContainerInfo(appId);

console.log({
  isRunning: info.isRunning,
  port: info.port,
  lastActivity: info.lastActivity,
  inactiveDuration: info.inactiveDuration // milliseconds
});
```

### Get Lifecycle Statistics

**API Endpoint:**
```bash
GET /api/container/lifecycle/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "managedContainers": 5,
    "allocatedPorts": 5,
    "startingContainers": 0,
    "portRange": "32100-32200",
    "inactivityTimeout": 600000,
    "initialized": true
  }
}
```

**Or programmatically:**
```typescript
const lifecycleService = ContainerLifecycleService.getInstance();
const stats = lifecycleService.getStats();
console.log(stats);
```

### Manual Container Shutdown

```typescript
const lifecycleService = ContainerLifecycleService.getInstance();
await lifecycleService.stopContainer(appId);
```

## Logs

The lifecycle service logs all activity:

```
INFO: Container Lifecycle Service initialized
  - inactivityTimeout: 600000
  - inactivityMinutes: 10

INFO: Discovering existing containers after server restart
  - service: lifecycle

INFO: Discovered container
  - appId: 49
  - port: 32100
  - status: running
  - containerName: dyad-app-49

INFO: Container discovery complete
  - totalDiscovered: 3
  - running: 2
  - stopped: 1

INFO: Lifecycle service initialization complete
  - discoveredContainers: 3
  - allocatedPorts: 3

INFO: Container lifecycle manager started
  - checkInterval: 120s
  - managedContainers: 3

INFO: Container started, installing dependencies in background
  - appId: my-app
  - port: 32100

INFO: Recorded container activity
  - appId: my-app

INFO: Container inactive, scheduling cleanup
  - appId: my-app
  - inactiveDuration: 10 minutes

DEBUG: Container shows CPU activity
  - appId: my-app
  - cpuUsage: 5.2%

INFO: Container marked inactive but shows activity, keeping alive
  - appId: my-app

INFO: Stopping inactive container (verified no activity)
  - appId: idle-app

INFO: Inactive container stopped
  - appId: idle-app
```

## Testing

1. **Test Auto-Shutdown:**
   ```bash
   # Set short timeout for testing (1 minute)
   CONTAINER_INACTIVITY_TIMEOUT=60000
   
   # Start a container
   # Wait 1+ minutes without accessing it
   # Check logs - container should be stopped
   ```

2. **Test Resource Limits:**
   ```bash
   # Set limits
   CONTAINER_CPU_LIMIT=0.5
   CONTAINER_MEMORY_LIMIT=256m
   
   # Start container and verify limits:
   docker stats <container-name>
   # or
   podman stats <container-name>
   ```

## Architecture

```
┌─────────────────────────────────────────┐
│   Container Operations (Routes/API)    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     ContainerizationService             │
│  - runContainer()                       │
│  - getContainerStatus()                 │
│  - execInContainer()                    │
│  - getContainerLogs()                   │
│  ↓ Records activity for each operation  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    ContainerLifecycleService            │
│  - Tracks last activity time            │
│  - Background job (every 2 min)         │
│  - Stops containers after timeout       │
└─────────────────────────────────────────┘
```

## Benefits

1. **Resource Efficiency**: Automatically frees up CPU, memory, and ports from unused containers
2. **Cost Savings**: Reduces infrastructure costs by not running idle containers
3. **Flexibility**: Configurable timeout and resource limits per environment
4. **Transparency**: Full logging of lifecycle events
5. **Safety**: Containers can be restarted on-demand when needed

## Notes

- The lifecycle manager starts automatically when the application starts
- Activity tracking is thread-safe and handles concurrent requests
- Stopped containers can be restarted automatically on the next request
- Resource limits prevent any single container from consuming excessive resources
