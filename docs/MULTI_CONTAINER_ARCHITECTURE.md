# Multi-Container Architecture Guide

## Overview

The system supports running multiple app containers in parallel with automatic resource management. Each app runs in its own isolated container with a dedicated port, accessible through a unified preview URL.

## Architecture

### 1. **Container Lifecycle Service** (`src/services/container_lifecycle_service.ts`)

**Purpose**: Singleton service managing container lifecycle, port allocation, and automatic cleanup.

**Key Features**:
- **Activity Tracking**: Records last activity timestamp for each container
- **Port Allocation**: Dynamically assigns ports from 32100-32200 range
- **Auto-Cleanup**: Automatically stops containers after 15 minutes of inactivity
- **Resource Management**: Prevents port conflicts and manages port pool

**Port Assignment Flow**:
```
1. Request comes for appId "1"
2. Check if port already allocated → Yes: Return existing port
3. No: Find next available port in range (32100-32200)
4. Assign port to appId in containerPorts Map
5. Return allocated port
```

**Data Structures**:
```typescript
containerActivity: Map<string, number>  // appId → lastActivityTimestamp
containerPorts: Map<string, number>     // appId → assignedPort
```

### 2. **Preview Proxy Route** (`src/routes/preview.ts`)

**Purpose**: Unified entry point for accessing all app containers.

**URL Pattern**: `http://localhost:3000/app/preview/:appId/*`

**Request Flow**:
```
1. Request: GET /app/preview/1/
2. Record activity for appId "1"
3. Check if container is running
   → No: Allocate port, start container, wait 3 seconds
   → Yes: Get existing port
4. Proxy request to http://localhost:{port}/
5. Forward response back to client
```

**Example Usage**:
```bash
# App 1 (auto-assigned to port 32100)
http://localhost:3000/app/preview/1/

# App 2 (auto-assigned to port 32101)
http://localhost:3000/app/preview/2/

# App 3 (auto-assigned to port 32102)
http://localhost:3000/app/preview/3/
```

### 3. **Containerization Service** (`src/services/containerization_service.ts`)

**Purpose**: Facade for Podman/Docker operations.

**Container Start Process**:
```typescript
runContainer({
  appId: "1",
  appPath: "/path/to/app",
  port: 32100,  // From lifecycle service
  skipInstall: false
})
```

**What Happens Inside**:
1. Create volume: `podman volume create dyad-app-1-data`
2. Stop existing containers on this port (if AUTO_KILL_PORT=true)
3. Start container with:
   - Port mapping: `-p 32100:32100`
   - Volume mount: `-v {appPath}:/app:z`
   - Environment: `PORT=32100`
4. Run startup script: install deps → start dev server

### 4. **Container Info API** (`src/routes/container_info.ts`) - **NEW**

**Purpose**: Provides visibility into running containers and port allocations.

**Endpoints**:

#### GET `/api/containers/info`
List all active containers with port mappings.

**Response Example**:
```json
{
  "enabled": true,
  "totalContainers": 3,
  "runningContainers": 2,
  "containers": [
    {
      "appId": "1",
      "isRunning": true,
      "port": 32100,
      "lastActivity": "2025-11-27T10:30:00.000Z",
      "inactiveDuration": 45000,
      "previewUrl": "http://localhost:3000/app/preview/1",
      "directUrl": "http://localhost:32100"
    },
    {
      "appId": "2",
      "isRunning": true,
      "port": 32101,
      "lastActivity": "2025-11-27T10:29:00.000Z",
      "inactiveDuration": 105000,
      "previewUrl": "http://localhost:3000/app/preview/2",
      "directUrl": "http://localhost:32101"
    }
  ],
  "portRange": {
    "min": 32100,
    "max": 32200
  }
}
```

#### GET `/api/containers/info/:appId`
Get specific container details.

**Response Example**:
```json
{
  "enabled": true,
  "appId": "1",
  "isRunning": true,
  "port": 32100,
  "lastActivity": "2025-11-27T10:30:00.000Z",
  "inactiveDuration": 45000,
  "status": "running",
  "containerName": "dyad-app-1",
  "previewUrl": "http://localhost:3000/app/preview/1",
  "directUrl": "http://localhost:32100"
}
```

#### GET `/api/containers/ports`
View port allocation status.

**Response Example**:
```json
{
  "portRange": {
    "min": 32100,
    "max": 32200,
    "total": 101
  },
  "allocated": [
    { "appId": "1", "port": 32100 },
    { "appId": "2", "port": 32101 },
    { "appId": "5", "port": 32102 }
  ],
  "allocatedCount": 3,
  "availableCount": 98,
  "availablePorts": [32103, 32104, 32105, 32106, 32107, 32108, 32109, 32110, 32111, 32112]
}
```

#### POST `/api/containers/:appId/stop`
Manually stop a container and release its port.

**Response Example**:
```json
{
  "success": true,
  "message": "Container stopped and cleaned up",
  "appId": "1"
}
```

## How Parallel Containers Work

### Scenario: Running 3 Apps Simultaneously

```
Time: 10:00 AM
-----------------
User creates App 1:
  1. lifecycleService.allocatePort("1") → 32100
  2. containerService.runContainer({ appId: "1", port: 32100 })
  3. Container "dyad-app-1" starts on port 32100
  4. Access via: http://localhost:3000/app/preview/1

Time: 10:05 AM
-----------------
User creates App 2:
  1. lifecycleService.allocatePort("2") → 32101 (32100 taken)
  2. containerService.runContainer({ appId: "2", port: 32101 })
  3. Container "dyad-app-2" starts on port 32101
  4. Access via: http://localhost:3000/app/preview/2

Time: 10:10 AM
-----------------
User creates App 3:
  1. lifecycleService.allocatePort("3") → 32102 (32100-32101 taken)
  2. containerService.runContainer({ appId: "3", port: 32102 })
  3. Container "dyad-app-3" starts on port 32102
  4. Access via: http://localhost:3000/app/preview/3

Current State:
-----------------
podman ps:
  dyad-app-1  →  0.0.0.0:32100  (active: 10min ago)
  dyad-app-2  →  0.0.0.0:32101  (active: 5min ago)
  dyad-app-3  →  0.0.0.0:32102  (active: just now)

Port Map:
  containerPorts = { "1": 32100, "2": 32101, "3": 32102 }
  
Activity Map:
  containerActivity = { 
    "1": 1732704000000,  // 10:00 AM
    "2": 1732704300000,  // 10:05 AM
    "3": 1732704600000   // 10:10 AM
  }
```

### Auto-Cleanup Process

```
Time: 10:25 AM
-----------------
Lifecycle service runs cleanup check (every 2 minutes):

1. Check App 1:
   - Last activity: 10:00 AM
   - Current time: 10:25 AM
   - Inactive duration: 25 minutes
   - Threshold: 15 minutes
   - Action: STOP & CLEANUP
   
   Executes:
   - podman stop dyad-app-1
   - podman rm dyad-app-1
   - containerActivity.delete("1")
   - containerPorts.delete("1")  // Port 32100 now available

2. Check App 2:
   - Last activity: 10:20 AM (user accessed via preview)
   - Inactive duration: 5 minutes
   - Action: KEEP RUNNING

3. Check App 3:
   - Last activity: 10:22 AM
   - Inactive duration: 3 minutes
   - Action: KEEP RUNNING

Result:
  - App 1: Stopped and removed
  - App 2: Still running on port 32101
  - App 3: Still running on port 32102
  - Port 32100: Available for new containers
```

## Port Detection Methods

### Method 1: Via Lifecycle Service (Recommended)
```typescript
const lifecycleService = ContainerLifecycleService.getInstance();
const port = lifecycleService.getPort("1");
// Returns: 32100
```

### Method 2: Via Container Status
```typescript
const containerService = ContainerizationService.getInstance();
const status = await containerService.getContainerStatus("1");
// status.port = 32100
```

### Method 3: Via Container Info API
```bash
curl http://localhost:3000/api/containers/info/1
# Response: { "port": 32100, ... }
```

### Method 4: Direct Podman Inspection
```bash
podman inspect dyad-app-1 --format '{{(index (index .NetworkSettings.Ports "32100/tcp") 0).HostPort}}'
# Output: 32100
```

## Configuration

### Environment Variables

```env
# Container Lifecycle
CONTAINER_INACTIVITY_TIMEOUT=900000  # 15 minutes (in milliseconds)

# Containerization
CONTAINERIZATION_ENABLED=true        # Enable/disable containers
CONTAINER_ENGINE=podman              # podman or docker
AUTO_KILL_PORT=true                  # Auto-cleanup port conflicts

# Port Range (hardcoded in lifecycle service)
# Base Port: 32100
# Max Port: 32200
# Total Ports: 101
```

### Modifying Inactivity Timeout

**15 minutes (default)**:
```env
CONTAINER_INACTIVITY_TIMEOUT=900000
```

**30 minutes**:
```env
CONTAINER_INACTIVITY_TIMEOUT=1800000
```

**5 minutes (testing)**:
```env
CONTAINER_INACTIVITY_TIMEOUT=300000
```

## Troubleshooting

### Problem: Container not accessible via preview URL

**Check 1**: Is container running?
```bash
podman ps | grep dyad-app-1
```

**Check 2**: What port is assigned?
```bash
curl http://localhost:3000/api/containers/info/1
```

**Check 3**: Check proxy logs
```bash
# In terminal where backend is running
# Look for: "Proxying request to container"
```

**Check 4**: Access container directly
```bash
# Use direct URL from API response
curl http://localhost:32100
```

### Problem: Port conflict errors

**Solution 1**: Enable auto-cleanup
```env
AUTO_KILL_PORT=true
```

**Solution 2**: Manually stop containers
```bash
curl -X POST http://localhost:3000/api/containers/1/stop
```

**Solution 3**: Check port usage
```bash
curl http://localhost:3000/api/containers/ports
```

### Problem: Container stopped unexpectedly

**Check 1**: Check if inactive timeout triggered
```bash
curl http://localhost:3000/api/containers/info/1
# Check "inactiveDuration" field
```

**Check 2**: Increase timeout
```env
CONTAINER_INACTIVITY_TIMEOUT=1800000  # 30 minutes
```

**Check 3**: Check container logs
```bash
podman logs dyad-app-1
```

### Problem: Running out of ports

**Current Limit**: 101 ports (32100-32200)

**Solutions**:
1. Stop unused containers:
   ```bash
   curl -X POST http://localhost:3000/api/containers/APPID/stop
   ```

2. Modify lifecycle service to expand range:
   ```typescript
   // In container_lifecycle_service.ts
   private basePort: number = 32100;
   private maxPort: number = 32300;  // Increase from 32200
   ```

## Testing Multi-Container Setup

### Test 1: Start Multiple Apps
```bash
# Create App 1
curl -X POST http://localhost:3000/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"test-app-1","path":"test-app-1"}'

# Create App 2
curl -X POST http://localhost:3000/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"test-app-2","path":"test-app-2"}'

# Access App 1 Preview
curl http://localhost:3000/app/preview/1/

# Access App 2 Preview
curl http://localhost:3000/app/preview/2/

# Check both are running
curl http://localhost:3000/api/containers/info
```

### Test 2: Verify Port Allocation
```bash
# Check port assignments
curl http://localhost:3000/api/containers/ports

# Expected:
# {
#   "allocated": [
#     {"appId": "1", "port": 32100},
#     {"appId": "2", "port": 32101}
#   ],
#   "allocatedCount": 2,
#   "availableCount": 99
# }
```

### Test 3: Test Auto-Cleanup
```bash
# Set short timeout (1 minute)
# In .env:
CONTAINER_INACTIVITY_TIMEOUT=60000

# Restart server
# Wait 3 minutes
# Check containers
curl http://localhost:3000/api/containers/info
# Should show empty or only recently accessed containers
```

### Test 4: WebSocket/HMR Through Proxy
```bash
# Make a file change via AI
# The preview URL should auto-reload
# Vite HMR uses WebSocket on same port
# Proxy has ws: true enabled for WebSocket support
```

## Code Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                           │
│  http://localhost:3000/app/preview/1/                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Express Server (port 3000)                      │
│                                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Preview Router (/app/preview/:appId)               │    │
│  │  src/routes/preview.ts                              │    │
│  └──────────────┬─────────────────────────────────────┘    │
│                 │                                             │
│                 ├──► 1. Record Activity                      │
│                 │    lifecycleService.recordActivity("1")    │
│                 │                                             │
│                 ├──► 2. Check if Running                     │
│                 │    containerService.isContainerRunning()   │
│                 │                                             │
│                 ├──► 3a. If NOT Running:                     │
│                 │     - allocatePort("1") → 32100            │
│                 │     - runContainer({ port: 32100 })        │
│                 │     - wait 3 seconds                       │
│                 │                                             │
│                 ├──► 3b. If Running:                         │
│                 │     - getPort("1") → 32100                 │
│                 │                                             │
│                 └──► 4. Proxy Request                        │
│                      httpProxy.web(req, res, {               │
│                        target: "http://localhost:32100"      │
│                      })                                       │
│                                                               │
└───────────────────────────┬───────────────────────────────┬─┘
                            │                                 │
                            │                                 │
          ┌─────────────────┴─────────────┐    ┌────────────▼───────────┐
          │  Container Lifecycle Service  │    │  Containerization       │
          │  (Singleton)                  │    │  Service                │
          │                               │    │                         │
          │  containerActivity Map        │    │  runContainer()         │
          │  containerPorts Map           │    │  stopContainer()        │
          │                               │    │  getContainerStatus()   │
          │  allocatePort()               │    │                         │
          │  recordActivity()             │    │  Delegates to:          │
          │  cleanupInactiveContainers()  │    │  - PodmanHandler        │
          │                               │    │  - DockerHandler        │
          └───────────────────────────────┘    └────────────┬────────────┘
                                                             │
                                                             ▼
                              ┌──────────────────────────────────────────┐
                              │         Podman/Docker Engine             │
                              │                                          │
                              │  ┌─────────────────┐  ┌───────────────┐│
                              │  │  dyad-app-1     │  │  dyad-app-2   ││
                              │  │  Port: 32100    │  │  Port: 32101  ││
                              │  │  Volume: /app   │  │  Volume: /app ││
                              │  └─────────────────┘  └───────────────┘│
                              └──────────────────────────────────────────┘
```

## Summary

✅ **Multiple containers run in parallel** - Each app gets its own container and port
✅ **Automatic port management** - Lifecycle service allocates ports from 32100-32200
✅ **Port detection** - Four methods available (lifecycle service, container status, API, podman inspect)
✅ **Unified access** - All apps accessible via `/app/preview/:appId` pattern
✅ **Auto-cleanup** - Inactive containers stopped after 15 minutes
✅ **Port visibility** - Container Info API provides real-time port mappings
✅ **Resource efficiency** - Stopped containers release their ports for reuse
✅ **WebSocket support** - Vite HMR works through proxy for hot reload

