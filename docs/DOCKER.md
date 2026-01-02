# Docker Integration for Dyad Backend

## Overview

The Dyad backend now supports running generated apps in Docker containers, similar to Dyad Desktop. This provides isolated environments for each app and simplifies dependency management.

## Features

- ✅ Automatic Docker container creation for apps
- ✅ Volume mounting for app code and dependencies
- ✅ Port mapping for app access
- ✅ Build caching with named volumes
- ✅ Container lifecycle management (start/stop/cleanup)
- ✅ Configurable via environment variables

## Configuration

Add these environment variables to your `.env` file:

```env
# Docker Configuration
DOCKER_ENABLED=true
DOCKER_APP_PORT=32100
DOCKER_NODE_IMAGE=node:22-alpine
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_ENABLED` | `false` | Enable Docker execution for apps |
| `DOCKER_APP_PORT` | `32100` | Port to expose for apps (mapped to container) |
| `DOCKER_NODE_IMAGE` | `node:22-alpine` | Base Docker image for Node.js apps |

## Prerequisites

1. **Docker Desktop** must be installed and running
   - macOS: https://docs.docker.com/desktop/install/mac-install/
   - Windows: https://docs.docker.com/desktop/install/windows-install/
   - Linux: https://docs.docker.com/desktop/install/linux-install/

2. Verify Docker is available:
   ```bash
   docker --version
   ```

## API Endpoints

### Run App in Docker
```http
POST /api/apps/:appId/run
Content-Type: application/json

{
  "installCommand": "pnpm install",  // optional
  "startCommand": "pnpm dev --host 0.0.0.0 --port 32100"  // optional
}
```

Response:
```json
{
  "success": true,
  "message": "App 1 started in Docker container",
  "data": {
    "appId": "1",
    "containerName": "dyad-app-1",
    "port": 32100
  }
}
```

### Stop App Container
```http
POST /api/apps/:appId/stop
```

Response:
```json
{
  "success": true,
  "message": "App 1 stopped"
}
```

### Check App Status
```http
GET /api/apps/:appId/status
```

Response:
```json
{
  "success": true,
  "data": {
    "appId": "1",
    "isRunning": true,
    "dockerEnabled": true
  }
}
```

### Cleanup Docker Volumes
```http
POST /api/apps/:appId/cleanup
```

Removes Docker volumes used for dependency caching.

### Docker Service Status
```http
GET /api/docker/status
```

Response:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "available": true,
    "config": {
      "enabled": true,
      "port": 32100,
      "nodeImage": "node:22-alpine"
    },
    "runningContainers": 2,
    "runningAppIds": [1, 3]
  }
}
```

## How It Works

### 1. Container Creation

When you run an app via `/api/apps/:appId/run`:

1. **Docker Check**: Verifies Docker is available
2. **Container Cleanup**: Stops any existing container with the same name
3. **Dockerfile Generation**: Creates `Dockerfile.dyad` in the app directory:
   ```dockerfile
   FROM node:22-alpine
   RUN npm install -g pnpm
   ```
4. **Image Build**: Builds Docker image `dyad-app-{appId}`
5. **Container Start**: Runs container with:
   - Volume mount: `{appPath}:/app`
   - Dependency cache: `dyad-pnpm-{appId}:/app/.pnpm-store`
   - Port mapping: `32100:32100`
   - Working directory: `/app`

### 2. Container Lifecycle

```
Create App → Generate Dockerfile → Build Image → Run Container
                                                      ↓
                                        App runs on localhost:32100
                                                      ↓
Stop Container ← User request or error
```

### 3. Volume Management

Each app gets a named volume for dependency caching:
- Volume name: `dyad-pnpm-{appId}`
- Purpose: Persist `node_modules` between container restarts
- Cleanup: Via `/api/apps/:appId/cleanup` endpoint

## Architecture Comparison

### Dyad Desktop (Electron)
```
settings.runtimeMode2 → "docker"
  ↓
executeAppInDocker() → Docker container
  ↓
Container output → IPC → Renderer process
```

### Dyad Backend (HTTP Server)
```
DOCKER_ENABLED=true
  ↓
POST /api/apps/:appId/run → Docker container
  ↓
Container output → Console logs (can be streamed via SSE)
```

## Default Commands

If no custom install/start commands are provided, the default is:
```bash
pnpm install && pnpm dev --host 0.0.0.0 --port 32100
```

The `--host 0.0.0.0` flag ensures the app binds to all interfaces, making it accessible from outside the container.

## Accessing Running Apps

Once an app is running in a container, access it at:
```
http://localhost:32100
```

The backend maps the container's port 32100 to the host's port 32100.

## Troubleshooting

### Docker not available
```
Error: Docker is required but not available
```
**Solution**: Install Docker Desktop and ensure it's running.

### Port already in use
```
Error: Bind for 0.0.0.0:32100 failed: port is already allocated
```
**Solution**: Stop the existing container or change `DOCKER_APP_PORT`.

### Container fails to start
Check Docker logs:
```bash
docker logs dyad-app-1
```

### Build fails
Inspect build output in server console. Common issues:
- Network problems during image download
- Insufficient disk space
- Invalid Dockerfile syntax

## Manual Docker Commands

### List all Dyad containers
```bash
docker ps -a --filter "name=dyad-app-*"
```

### Stop all Dyad containers
```bash
docker stop $(docker ps -q --filter "name=dyad-app-*")
```

### Remove all Dyad containers
```bash
docker rm $(docker ps -a -q --filter "name=dyad-app-*")
```

### List Dyad volumes
```bash
docker volume ls --filter "name=dyad-pnpm-*"
```

### Remove all Dyad volumes
```bash
docker volume rm $(docker volume ls -q --filter "name=dyad-pnpm-*")
```

## Security Notes

- Containers run with default Docker security settings
- App code is mounted from host filesystem
- Containers are removed when stopped (`--rm` flag)
- No privileged mode or special capabilities

## Performance

Docker adds minimal overhead:
- First run: ~1-2 minutes (image build + dependency install)
- Subsequent runs: ~10-30 seconds (image cached, deps cached)
- Runtime performance: Near-native (Alpine Linux + minimal overhead)

## Integration with AI Streaming

Docker execution works seamlessly with the SSE streaming endpoint:

1. AI generates code with `<dyad-write>` tags
2. Backend writes files to app directory
3. Docker container detects file changes (if using hot reload)
4. App automatically reloads with new code

## Future Enhancements

- [ ] Real-time container logs via SSE
- [ ] Multiple port mappings
- [ ] Custom Dockerfile support
- [ ] Docker Compose for multi-service apps
- [ ] Resource limits (CPU/memory)
- [ ] Container health checks
- [ ] Automatic cleanup of old containers
