# Docker Hot Reload Fix

## Problem
When AI generates code updates, the running Docker container was not reflecting the changes. Files were being written to disk, but the app continued showing old code.

## Root Cause Analysis

### Original Flow (WORKING BUT INCOMPLETE)
```
AI Generates Code → Parse dyad tags → Write Files to app.path → 
❌ Docker integration was REMOVED from stream.ts → 
App never restarted with new code
```

### Issues Identified
1. **Missing Docker Integration**: The Docker restart logic was removed from `/api/stream/chat` endpoint
2. **Docker Build Caching**: Docker was using cached layers even after code changes
3. **No Force Rebuild**: The `--no-cache` flag was not being used during rebuilds

## Solution Implemented

### 1. Re-added Docker Integration to Stream Route
**File**: `backend/src/routes/stream.ts`

After AI completes file generation, the system now:
- Stops existing Docker container (if running)
- Rebuilds Docker image with `--no-cache` flag
- Starts new container with volume mounts
- Streams Docker events to frontend (docker:starting, docker:started, docker:output, docker:error, docker:closed)

```typescript
// STEP 18: Restart Docker container after files are updated
const { getDockerService } = await import('../services/docker_service');
const dockerService = getDockerService();
const dockerConfig = dockerService.getConfig();

if (dockerConfig.enabled) {
  // Check if already running
  const isRunning = dockerService.isAppRunning(app.id);
  if (isRunning) {
    await dockerService.stopApp(app.id);
  }

  // Restart with updated code
  await dockerService.runAppInDocker({
    appId: app.id,
    appPath: app.path,
    installCommand: app.installCommand,
    startCommand: app.startCommand,
    onOutput, onError, onClose
  });
}
```

### 2. Added --no-cache Flag to Docker Build
**File**: `backend/src/services/docker_service.ts`

Modified `buildDockerImage()` method to force rebuild:

```typescript
private async buildDockerImage(appPath: string, appId: number, forceRebuild: boolean = true): Promise<void> {
  const buildArgs = ['build', '-f', 'Dockerfile.dyad', '-t', imageName];
  
  // Add --no-cache flag to force rebuild when files change
  if (forceRebuild) {
    buildArgs.push('--no-cache');
  }
  
  buildArgs.push('.');
  
  const buildProcess = spawn('docker', buildArgs, { cwd: appPath, stdio: 'pipe' });
  // ... rest of build logic
}
```

### 3. Added File Verification Helper
**File**: `backend/src/services/docker_service.ts`

Added method to verify files are visible inside container after mount:

```typescript
private async verifyContainerFiles(containerName: string, filePaths: string[]): Promise<void> {
  for (const filePath of filePaths.slice(0, 3)) {
    const exec = spawn('docker', ['exec', containerName, 'ls', '-la', `/app/${filePath}`]);
    // Logs whether files are visible in container
  }
}
```

## Complete Hot Reload Flow (FIXED)

```
1. User sends prompt → AI generates code with <dyad-write> tags
2. Backend parses tags and extracts file operations
3. Files written to app.path directory on host
   ✅ Wrote: src/App.tsx
   ✅ Wrote: src/components/Button.tsx
4. Docker service checks if container is running
5. If running, stops and removes existing container
   ⏹️ Stopping existing container...
6. Docker builds new image with --no-cache flag
   🐳 Building image: dyad-app-20 (no cache)
7. Docker starts new container with volume mounts
   -v ${appPath}:/app (app code)
   -v dyad-pnpm-${appId}:/app/.pnpm-store (cache)
8. Container runs: pnpm install && pnpm dev
9. Frontend receives SSE events:
   docker:starting → docker:started → docker:output
10. App accessible at http://localhost:32100 with NEW CODE ✅
```

## Frontend Integration

The frontend (`dyad_frontend_test/src/components/ChatInterface.tsx`) already handles Docker events from SSE stream:

```tsx
if (event === 'docker:starting') {
  setDockerStatus('🐳 Starting Docker container...');
} else if (event === 'docker:started') {
  setDockerStatus('✅ App running in Docker');
  setDockerUrl(parsed.url || '');
} else if (event === 'docker:error') {
  setDockerStatus('❌ Docker error: ' + parsed.error);
}
```

## Testing

### How to Test Hot Reload

1. Start backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start frontend:
   ```bash
   cd dyad_frontend_test
   npm run dev
   ```

3. Open chat interface and select an app (e.g., calculator-vite)

4. Send a prompt that generates code changes:
   ```
   "Update the App.tsx to add a red border around the calculator"
   ```

5. Monitor backend logs for:
   ```
   📝 STEP 15: Parsing file operations from AI response...
   ✅ Wrote: src/App.tsx
   🐳 Docker is enabled, restarting container for app 20...
   ⏹️ Stopping existing container...
   🚀 Starting new container with updated code...
   [Docker Build 20] Step 1/5 : FROM node:22-alpine
   ✅ Docker container started for app 20 with updated code
   ```

6. Check frontend status indicator changes to "✅ App running in Docker"

7. Open http://localhost:32100 to see updated app with red border ✅

### Expected Behavior

- AI code changes are immediately written to disk
- Docker container automatically restarts
- New container picks up changes (no caching)
- App reflects updates within ~10-15 seconds (depending on install time)
- Frontend shows live status updates via SSE events

## Environment Variables

Ensure these are set in `backend/.env`:

```env
# Docker Configuration
DOCKER_ENABLED=true
DOCKER_APP_PORT=32100
DOCKER_NODE_IMAGE=node:22-alpine

# Database
DATABASE_URL=file:./data/dyad.db

# Server
PORT=3001
```

## Architecture Benefits

### Separation of Concerns
- **AI Service**: Generates code
- **File Service**: Writes files to disk
- **Docker Service**: Manages container lifecycle
- **Stream Route**: Orchestrates the full flow

### Automatic Hot Reload
- No manual Docker restart needed
- No manual file sync required
- Seamless developer experience
- Real-time feedback via SSE events

### Volume Mounts (Not Copy)
- Files are mounted, not copied into container
- Changes on host immediately visible in container
- Dev server (Vite/Webpack) detects changes via file watching
- True hot module replacement (HMR) support

## Troubleshooting

### Issue: "Docker build failed"
- Check if Docker daemon is running: `docker ps`
- Verify Dockerfile.dyad exists in app directory
- Check Docker logs in backend console

### Issue: "Files not updating in container"
- Verify `--no-cache` flag is in build command
- Check volume mounts with: `docker inspect dyad-app-{appId}`
- Ensure dev server supports hot reload (most Vite/Webpack apps do)

### Issue: "Container exits immediately"
- Check app's install command is valid
- Verify start command runs dev server
- Check Docker logs: `docker logs dyad-app-{appId}`

### Issue: "Port 32100 already in use"
- Stop existing containers: `docker ps` → `docker stop <container>`
- Or change DOCKER_APP_PORT in .env

## Files Modified

1. ✅ `backend/src/routes/stream.ts` - Re-added Docker integration after file operations
2. ✅ `backend/src/services/docker_service.ts` - Added --no-cache flag and verification helper
3. ✅ `backend/DOCKER_HOT_RELOAD_FIX.md` - This documentation

## Related Documentation

- See `backend/API_DOCUMENTATION.md` for complete API reference
- See `backend/SWAGGER_UPDATE_SUMMARY.md` for Swagger/OpenAPI docs
- See `docs/architecture.md` for overall system architecture
