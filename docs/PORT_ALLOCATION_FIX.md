# Port Allocation Fix - Parallel Container Support

## Problem Identified

**Symptom**: Second container failed to start with error:
```
Error: something went wrong with the request: "proxy already running"
```

**Root Cause**: Multiple routes were hardcoding `port: 32100` instead of using the Container Lifecycle Service to allocate unique ports.

## Files Fixed

### 1. `/src/routes/container.ts` (Line 117)
**Before**:
```typescript
const result = await containerService.runContainer({
  appId,
  appPath,
  port: 32100, // ❌ Hardcoded - causes conflicts
  skipInstall: false,
});
```

**After**:
```typescript
const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
const lifecycleService = ContainerLifecycleService.getInstance();
const port = await lifecycleService.allocatePort(appId); // ✅ Unique port

const result = await containerService.runContainer({
  appId,
  appPath,
  port: port,
  skipInstall: false,
});
```

### 2. `/src/routes/apps.ts` (Line 212)
**Before**:
```typescript
containerService.runContainer({
  appId: app.id.toString(),
  appPath: fullAppPath,
  port: 32100, // ❌ Hardcoded - causes conflicts
}).catch(error => {
  console.error('Failed to start container for new app:', error);
});
```

**After**:
```typescript
const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
const lifecycleService = ContainerLifecycleService.getInstance();

lifecycleService.allocatePort(app.id.toString()).then(port => {
  return containerService.runContainer({
    appId: app.id.toString(),
    appPath: fullAppPath,
    port: port, // ✅ Unique port
  });
}).catch(error => {
  console.error('Failed to start container for new app:', error);
});
```

### 3. `/src/routes/stream.ts` (Line 787)
**Before**:
```typescript
const result = await containerService.runContainer({
  appId: app.id.toString(),
  appPath: fullAppPath,
  port: 32100, // ❌ Hardcoded - causes conflicts
});

if (result.success) {
  const status = await containerService.getContainerStatus(app.id.toString());
  // ... use status.port || 32100
}
```

**After**:
```typescript
const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
const lifecycleService = ContainerLifecycleService.getInstance();
const port = await lifecycleService.allocatePort(app.id.toString()); // ✅ Unique port

const result = await containerService.runContainer({
  appId: app.id.toString(),
  appPath: fullAppPath,
  port: port,
});

if (result.success) {
  // ... use port directly
}
```

### 4. `/src/routes/preview.ts`
**Status**: ✅ Already correct - was using lifecycle service properly

## How It Works Now

### Parallel Container Scenario

```
User Action 1: Create App with ID 56
  ├─ apps.ts: lifecycleService.allocatePort("56")
  ├─ Returns: 32100 (first available)
  └─ Starts: dyad-app-56 on port 32100 ✅

User Action 2: Create App with ID 57
  ├─ apps.ts: lifecycleService.allocatePort("57")
  ├─ Returns: 32101 (32100 already taken)
  └─ Starts: dyad-app-57 on port 32101 ✅

User Action 3: Run container via /api/apps/:appId/run
  ├─ container.ts: lifecycleService.allocatePort("58")
  ├─ Returns: 32102 (32100-32101 taken)
  └─ Starts: dyad-app-58 on port 32102 ✅

Result: All 3 containers running in parallel! 🎉
```

### Port Allocation Flow

```
lifecycleService.allocatePort(appId)
  ↓
Check if appId already has a port
  ├─ Yes → Return existing port
  └─ No  → Find next available port (32100-32200)
           ↓
           Store in containerPorts Map
           ↓
           Return unique port
```

## Testing

### Test 1: Create Multiple Apps
```bash
# Create App 1
curl -X POST http://localhost:3000/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"app-1","path":"app-1"}'
# Port: 32100

# Create App 2
curl -X POST http://localhost:3000/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"app-2","path":"app-2"}'
# Port: 32101

# Verify both running
podman ps
# Should show:
# dyad-app-1  →  0.0.0.0:32100
# dyad-app-2  →  0.0.0.0:32101
```

### Test 2: Verify Port Allocation
```bash
curl http://localhost:3000/api/containers/ports
```

Expected response:
```json
{
  "allocated": [
    {"appId": "1", "port": 32100},
    {"appId": "2", "port": 32101}
  ],
  "allocatedCount": 2,
  "availableCount": 99
}
```

### Test 3: Access Both Apps
```bash
# App 1
curl http://localhost:3000/app/preview/1/

# App 2
curl http://localhost:3000/app/preview/2/

# Both should respond without "proxy already running" error
```

## What Was the Issue?

The **Container Lifecycle Service** was implemented correctly, but **not all routes were using it**. The routes were bypassing the lifecycle service and directly calling `runContainer()` with a hardcoded port.

### Entry Points That Start Containers:

1. ✅ **Preview Route** (`/app/preview/:appId`) - Was already correct
2. ❌ **Container Run** (`/api/apps/:appId/run`) - **FIXED** ✅
3. ❌ **App Create** (`/api/apps`) - **FIXED** ✅
4. ❌ **Stream Route** (AI chat creates containers) - **FIXED** ✅

## Prevention

To ensure this doesn't happen again, follow this pattern:

### ✅ Correct Pattern (Always use this):
```typescript
// Step 1: Import lifecycle service
const { ContainerLifecycleService } = await import('../services/container_lifecycle_service');
const lifecycleService = ContainerLifecycleService.getInstance();

// Step 2: Allocate unique port
const port = await lifecycleService.allocatePort(appId);

// Step 3: Start container with allocated port
const result = await containerService.runContainer({
  appId,
  appPath,
  port: port, // ✅ Use allocated port
});
```

### ❌ Incorrect Pattern (Never do this):
```typescript
// ❌ DON'T hardcode the port
const result = await containerService.runContainer({
  appId,
  appPath,
  port: 32100, // ❌ WRONG - causes conflicts
});
```

## Benefits After Fix

✅ **Multiple containers can run in parallel** - Each gets a unique port
✅ **No port conflicts** - Lifecycle service manages port pool (32100-32200)
✅ **Automatic resource management** - Inactive containers release ports after 15 minutes
✅ **Unified access** - All apps accessible via `/app/preview/:appId`
✅ **Port visibility** - Use `/api/containers/info` to see all allocations

## Related Files

- **Port Management**: `src/services/container_lifecycle_service.ts`
- **Container Operations**: `src/services/containerization_service.ts`
- **Preview Proxy**: `src/routes/preview.ts`
- **Container Info API**: `src/routes/container_info.ts`
- **Documentation**: `MULTI_CONTAINER_ARCHITECTURE.md`

## Summary

The fix ensures **all container start operations** go through the **Container Lifecycle Service** for port allocation, preventing port conflicts and enabling true parallel container execution.

**Status**: ✅ TypeScript compiles successfully
**Testing**: Ready for multi-container testing
