# Docker Workflow Optimization

## Overview

The Docker workflow has been optimized to provide **fast, incremental updates** without rebuilding containers or restarting processes each time files change. This dramatically improves the development experience when working with AI-generated code.

## Key Improvements

### 1. **Quick Start Container** 🚀
- Starts container immediately with base template
- No full image rebuild needed
- Reuses existing Docker images when available
- Container starts in seconds instead of minutes

### 2. **Incremental File Sync** 📦
- Volume mounting enables real-time file synchronization
- AI-generated file changes are immediately visible in the container
- No container restart required
- Vite's HMR (Hot Module Replacement) automatically detects changes

### 3. **Smart Dependency Management** 📚
- Dependencies installed once and cached in Docker volumes
- Subsequent starts can skip installation (when dependencies haven't changed)
- Volume persistence: `dyad-pnpm-{appId}` stores pnpm cache

### 4. **Container State Tracking** ✅
- Track when container is ready to serve requests
- Monitor dependency installation progress
- Know when changes can be synced

## Optimized Workflow

### Initial App Creation

```
1. Create app from template        → ~1-2 seconds
2. Quick start container           → ~3-5 seconds
3. Install dependencies (first time)→ ~30-60 seconds
4. Dev server ready                → Total: ~35-70 seconds
```

### Subsequent Runs (Same App)

```
1. Quick start with skipInstall=true → ~3-5 seconds
2. Dev server ready                  → Total: ~5-10 seconds
```

### AI File Updates

```
1. AI generates/updates files       → Variable
2. Auto-sync via volume mount       → Instant
3. Vite HMR triggers                → ~100-500ms
4. Browser updates                  → Instant
```

## API Endpoints

### POST `/api/apps/{appId}/quick-start`

Quick start a container with optimized settings.

**Body:**
```json
{
  "skipInstall": false  // Set to true if dependencies already installed
}
```

**Response:**
```json
{
  "success": true,
  "message": "App 1 quick started in Docker",
  "data": {
    "appId": "1",
    "containerName": "dyad-app-1",
    "port": 32100
  }
}
```

### POST `/api/apps/{appId}/sync`

Sync updated files to running container (optional - files sync automatically via volume mount).

**Body:**
```json
{
  "filePaths": ["src/App.tsx", "src/pages/Index.tsx"]  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Files synced to container for app 1"
}
```

### GET `/api/apps/{appId}/status`

Check container status including readiness and dependency installation.

**Response:**
```json
{
  "success": true,
  "data": {
    "appId": "1",
    "isRunning": true,
    "isReady": true,
    "hasDependenciesInstalled": true,
    "dockerEnabled": true,
    "containerName": "dyad-app-1",
    "port": 32100
  }
}
```

## Usage Examples

### Scenario 1: First Time App Creation

```bash
# Create app
curl -X POST http://localhost:3001/api/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","path":"/apps/my-app","template":"vite-react-shadcn"}'

# Quick start container
curl -X POST http://localhost:3001/api/apps/1/quick-start \
  -H "Content-Type: application/json" \
  -d '{"skipInstall":false}'

# Wait for dependencies to install (check status)
curl http://localhost:3001/api/apps/1/status

# App ready at http://localhost:32100
```

### Scenario 2: Restarting Existing App

```bash
# Quick start with skip install (much faster!)
curl -X POST http://localhost:3001/api/apps/1/quick-start \
  -H "Content-Type: application/json" \
  -d '{"skipInstall":true}'

# Ready in seconds at http://localhost:32100
```

### Scenario 3: AI Updates Files

Files are automatically synced via volume mount. Vite's HMR will detect changes and hot reload the browser. No API calls needed!

Optionally, you can manually trigger a sync:
```bash
curl -X POST http://localhost:3001/api/apps/1/sync \
  -H "Content-Type: application/json" \
  -d '{"filePaths":["src/pages/Index.tsx"]}'
```

## How It Works

### Volume Mounting
```dockerfile
-v ${appPath}:/app                    # Bidirectional file sync
-v dyad-pnpm-{appId}:/app/.pnpm-store # Persistent dependency cache
```

This creates a **live link** between your host filesystem and the container. When AI generates or updates files on the host, they're immediately visible in the container.

### Hot Module Replacement (HMR)

Vite watches for file changes and uses HMR to update the browser without full page reload:

```
File Change → Vite detects → Module updated → Browser updates
   (Host)     (Container)      (Container)      (Instant)
```

### State Tracking

The service monitors container output to detect:
- ✅ Dependencies installed: `"packages in"` or `"Already up to date"`
- ✅ Server ready: `"Local:"` or `"ready in"` or `"Server running"`

## Performance Comparison

| Operation | Old Approach | Optimized Approach | Improvement |
|-----------|--------------|-------------------|-------------|
| First start | 2-3 minutes | 35-70 seconds | **3-5x faster** |
| Restart | 2-3 minutes | 5-10 seconds | **12-36x faster** |
| File update | Full rebuild (2-3 min) | Instant (HMR) | **∞x faster** |
| Image build | Every time | Once (cached) | **Reused** |

## Best Practices

1. **Use `skipInstall=true`** when restarting if dependencies haven't changed
2. **Let volume mounting handle file sync** - no manual sync needed
3. **Monitor container status** to know when ready to accept requests
4. **Keep volumes** to speed up subsequent starts (persistent cache)
5. **Use quick-start** for template apps, regular run for custom setups

## Troubleshooting

### Container not seeing file changes?
- Check that volume mount is working: `-v ${appPath}:/app`
- Verify container is running: `GET /api/apps/{appId}/status`

### Slow first start?
- Normal! Dependencies need to install
- Subsequent starts will be much faster with volume cache

### Want even faster startup?
- Use `skipInstall=true` when dependencies haven't changed
- Pre-build images for common templates

## Technical Details

### Docker Service Methods

- `quickStartContainer()` - Optimized container startup
- `syncFilesToContainer()` - Manual file sync (rarely needed)
- `isContainerReady()` - Check if serving requests
- `hasDependenciesInstalled()` - Check dependency status

### Container Lifecycle

1. **Stop existing** container (if any)
2. **Ensure Dockerfile** exists
3. **Build/reuse image** (cached when possible)
4. **Start container** with volume mounts
5. **Install dependencies** (if needed)
6. **Start dev server**
7. **Monitor output** for readiness
8. **Mark as ready** when serving

## Environment Variables

```bash
DOCKER_ENABLED=true         # Enable Docker execution
DOCKER_APP_PORT=32100       # Container port for apps
DOCKER_NODE_IMAGE=node:22-alpine  # Base Node.js image
```

## Summary

The optimized Docker workflow provides:
- ⚡ **Fast startup** - containers ready in seconds
- 🔄 **Incremental updates** - no rebuilds needed
- 🔥 **Hot reload** - changes reflected instantly
- 💾 **Smart caching** - dependencies persist across restarts
- 📊 **State tracking** - know when container is ready

This makes working with AI-generated code seamless and fast!
