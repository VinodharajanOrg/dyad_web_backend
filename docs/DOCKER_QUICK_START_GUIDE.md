# Quick Start Guide: Optimized Docker Integration

## For App Creation Flow

### Recommended Workflow

```typescript
// 1. Create app from template
const app = await appService.createApp({
  name: "my-app",
  path: "/apps/my-app",
  template: "vite-react-shadcn"
});

// 2. Quick start container immediately (while AI generates content)
await dockerService.quickStartContainer({
  appId: app.id,
  appPath: appService.getFullAppPath(app.path),
  installCommand: app.installCommand,
  startCommand: app.startCommand,
  skipInstall: false  // First time needs deps
});

// 3. AI generates/updates files
// Files are automatically synced via volume mount!
// Vite HMR will hot reload the browser

// 4. (Optional) Check status
const isReady = dockerService.isContainerReady(app.id);
```

## API Integration Example

```javascript
// Frontend: Create app and start container
async function createAndStartApp(appData) {
  // Step 1: Create app
  const createResponse = await fetch('/api/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appData)
  });
  const { data: app } = await createResponse.json();

  // Step 2: Quick start container
  const startResponse = await fetch(`/api/apps/${app.id}/quick-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skipInstall: false })
  });

  // Step 3: Poll for readiness
  const checkReady = async () => {
    const statusResponse = await fetch(`/api/apps/${app.id}/status`);
    const { data: status } = await statusResponse.json();
    
    if (status.isReady) {
      console.log(`✅ App ready at http://localhost:${status.port}`);
      return true;
    }
    
    if (status.hasDependenciesInstalled) {
      console.log('📦 Dependencies installed, server starting...');
    } else {
      console.log('⏳ Installing dependencies...');
    }
    
    return false;
  };

  // Poll every 2 seconds
  while (!(await checkReady())) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return app;
}

// Frontend: Restart existing app (much faster!)
async function restartApp(appId) {
  await fetch(`/api/apps/${appId}/quick-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skipInstall: true })  // Skip for speed!
  });
}
```

## Backend Route Integration

```typescript
// In your apps route
router.post('/', asyncHandler(async (req, res) => {
  // Create app
  const app = await appService.createApp(req.body);
  
  // Optionally auto-start in Docker
  if (req.body.autoStart && dockerService.getConfig().enabled) {
    const appPath = appService.getFullAppPath(app.path);
    
    // Start in background (don't wait)
    dockerService.quickStartContainer({
      appId: app.id,
      appPath,
      installCommand: app.installCommand,
      startCommand: app.startCommand,
      skipInstall: false
    }).catch(err => {
      console.error(`Failed to auto-start app ${app.id}:`, err);
    });
  }
  
  res.status(201).json({ data: app });
}));
```

## Chat/AI Service Integration

```typescript
// When AI updates files
async function onAIFileUpdate(appId: number, updatedFiles: string[]) {
  // Files automatically sync via volume mount
  // Optionally trigger manual sync (usually not needed)
  if (dockerService.isAppRunning(appId)) {
    await dockerService.syncFilesToContainer(appId, updatedFiles);
  }
  
  // Vite HMR will automatically detect and hot reload
  console.log(`✨ AI updated ${updatedFiles.length} files`);
}
```

## WebSocket Integration

```typescript
// Real-time status updates
io.on('connection', (socket) => {
  socket.on('startApp', async (appId) => {
    const app = await appService.getApp(appId);
    const appPath = appService.getFullAppPath(app.path);
    
    await dockerService.quickStartContainer({
      appId,
      appPath,
      installCommand: app.installCommand,
      startCommand: app.startCommand,
      skipInstall: false,
    });
    
    // Send status updates
    const statusInterval = setInterval(async () => {
      const status = {
        isRunning: dockerService.isAppRunning(appId),
        isReady: dockerService.isContainerReady(appId),
        hasDeps: dockerService.hasDependenciesInstalled(appId),
      };
      
      socket.emit('appStatus', status);
      
      if (status.isReady) {
        clearInterval(statusInterval);
        socket.emit('appReady', { 
          url: `http://localhost:${dockerService.getConfig().port}` 
        });
      }
    }, 2000);
  });
});
```

## Key Benefits

- ✅ **No waiting**: Start container while AI generates code
- ✅ **Auto-sync**: Volume mounts eliminate manual file copying
- ✅ **Hot reload**: Changes appear instantly in browser
- ✅ **Fast restarts**: Skip dependency install when unchanged
- ✅ **Status tracking**: Know exactly when app is ready

## Migration from Old Approach

### Before (Slow)
```typescript
// Create app
await appService.createApp(data);

// Wait for AI to finish generating all files
await waitForAI();

// Build Docker image (slow!)
await dockerService.buildDockerImage();

// Start container and install deps (slow!)
await dockerService.runAppInDocker();

// Total: 2-3 minutes
```

### After (Fast)
```typescript
// Create app with template
await appService.createApp(data);

// Quick start immediately
await dockerService.quickStartContainer({ skipInstall: false });

// AI updates files (auto-synced, instant HMR)
// No restart needed!

// Total: 30-60 seconds first time, 5-10 seconds after
```

## Summary

The optimized workflow:
1. **Starts fast** - template ready in seconds
2. **Updates instantly** - volume mounts + HMR
3. **Restarts faster** - skip install when possible
4. **Tracks progress** - know when ready
5. **Zero rebuilds** - reuse images and cache

Use `quickStartContainer()` instead of `runAppInDocker()` for the best experience!
