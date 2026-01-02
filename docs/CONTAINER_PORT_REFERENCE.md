# Container Port Management - Quick Reference

## Check Port Assignments

### Get all active containers with ports
```bash
curl http://localhost:3000/api/containers/info
```

### Get specific container port
```bash
curl http://localhost:3000/api/containers/info/1
```

### Get port allocation overview
```bash
curl http://localhost:3000/api/containers/ports
```

## Access Running Apps

### Via Unified Preview URL (Recommended)
```
http://localhost:3000/app/preview/:appId
```

Example:
- App 1: `http://localhost:3000/app/preview/1`
- App 2: `http://localhost:3000/app/preview/2`
- App 3: `http://localhost:3000/app/preview/3`

### Via Direct Port (Alternative)
First get the port:
```bash
curl http://localhost:3000/api/containers/info/1 | jq .port
# Returns: 32100
```

Then access directly:
```
http://localhost:32100
```

## Port Allocation Logic

### Automatic Assignment
```
App 1 → Port 32100 (first available)
App 2 → Port 32101 (32100 taken)
App 3 → Port 32102 (32100-32101 taken)
...
App N → Port 32100 + (N-1)
```

### Port Range
- **Minimum**: 32100
- **Maximum**: 32200
- **Total Available**: 101 ports
- **When Full**: Cleanup old containers or increase range

## How Containers Run in Parallel

### Container Naming
```
appId: 1 → Container: dyad-app-1 → Port: 32100
appId: 2 → Container: dyad-app-2 → Port: 32101
appId: 5 → Container: dyad-app-5 → Port: 32102
```

### Port Conflict Resolution
**With AUTO_KILL_PORT=true** (default):
- System automatically stops old containers using the port
- No manual intervention needed

**With AUTO_KILL_PORT=false**:
- Returns error if port is occupied
- Must manually stop conflicting container

### Activity Tracking
Every request to `/app/preview/:appId` updates the last activity timestamp:
```typescript
lifecycleService.recordActivity(appId);
// Sets containerActivity[appId] = Date.now()
```

### Auto-Cleanup
Every 2 minutes, the system checks:
```
For each container:
  if (Date.now() - lastActivity) > 15 minutes:
    Stop container
    Release port
    Remove from tracking
```

## Verify Parallel Execution

### Check Running Containers
```bash
# Using Podman
podman ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"

# Expected output:
# NAMES         PORTS                    STATUS
# dyad-app-1    0.0.0.0:32100->32100/tcp Up 5 minutes
# dyad-app-2    0.0.0.0:32101->32101/tcp Up 3 minutes
# dyad-app-3    0.0.0.0:32102->32102/tcp Up 1 minute
```

### Check Port Bindings
```bash
# List all port mappings
podman ps --format "{{.Names}}: {{.Ports}}"

# Check specific container
podman port dyad-app-1
# Output: 32100/tcp -> 0.0.0.0:32100
```

### Test Concurrent Access
```bash
# Terminal 1: Access App 1
curl http://localhost:3000/app/preview/1/ &

# Terminal 2: Access App 2
curl http://localhost:3000/app/preview/2/ &

# Terminal 3: Access App 3
curl http://localhost:3000/app/preview/3/ &

# All should respond successfully
```

## Manual Container Management

### Stop a Container
```bash
curl -X POST http://localhost:3000/api/containers/1/stop
```

### Stop All Containers
```bash
# Get all app IDs
curl http://localhost:3000/api/containers/info | jq -r '.containers[].appId'

# Stop each one
for id in $(curl -s http://localhost:3000/api/containers/info | jq -r '.containers[].appId'); do
  curl -X POST http://localhost:3000/api/containers/$id/stop
done
```

### Restart a Container
```bash
# Stop
curl -X POST http://localhost:3000/api/containers/1/stop

# Access preview URL to auto-start
curl http://localhost:3000/app/preview/1/
```

## Troubleshooting Commands

### Container not responding?
```bash
# 1. Check if running
curl http://localhost:3000/api/containers/info/1

# 2. Check Podman status
podman ps -a | grep dyad-app-1

# 3. View logs
podman logs dyad-app-1

# 4. Check port is listening
lsof -i :32100
```

### Port conflict?
```bash
# 1. Find what's using the port
lsof -i :32100

# 2. Check lifecycle service allocation
curl http://localhost:3000/api/containers/ports

# 3. Stop conflicting container
podman stop $(podman ps -q --filter publish=32100)
```

### Container stopped unexpectedly?
```bash
# 1. Check last activity
curl http://localhost:3000/api/containers/info/1 | jq .inactiveDuration

# 2. If > 900000 (15 min), it was auto-cleaned
# Solution: Access preview URL to restart
curl http://localhost:3000/app/preview/1/
```

## Architecture at a Glance

```
Request: GET /app/preview/1/
    ↓
Preview Router
    ↓
Record Activity (prevent auto-cleanup)
    ↓
Container Running?
    ├─ No  → Allocate Port → Start Container → Wait 3s → Proxy
    └─ Yes → Get Port → Proxy
                ↓
        http://localhost:32100/
                ↓
        Container responds
```

## Key Files

- **Lifecycle Management**: `src/services/container_lifecycle_service.ts`
- **Preview Proxy**: `src/routes/preview.ts`
- **Container Info API**: `src/routes/container_info.ts`
- **Container Operations**: `src/services/containerization_service.ts`
- **Podman Handler**: `src/containerization/handlers/PodmanHandler.ts`

## Environment Configuration

```env
# Enable containerization
CONTAINERIZATION_ENABLED=true

# Auto-cleanup inactive containers after 15 minutes
CONTAINER_INACTIVITY_TIMEOUT=900000

# Automatically kill containers using the same port
AUTO_KILL_PORT=true

# Container engine (podman or docker)
CONTAINER_ENGINE=podman
```

## Common Issues & Solutions

| Issue | Check | Solution |
|-------|-------|----------|
| Can't access preview | Port assigned? | `curl http://localhost:3000/api/containers/info/1` |
| Port conflict | AUTO_KILL_PORT enabled? | Set `AUTO_KILL_PORT=true` in .env |
| Container stopped | Inactive too long? | Access `/app/preview/:appId` to restart |
| Out of ports | 101 ports used? | Stop unused containers or expand range |
| HMR not working | WebSocket proxied? | Check `ws: true` in proxy config |

## Performance Considerations

### Maximum Containers
- **Theoretical**: 101 containers (ports 32100-32200)
- **Practical**: Depends on system resources (RAM, CPU)
- **Recommended**: 10-20 active containers

### Auto-Cleanup Benefits
- Prevents resource exhaustion
- Releases ports for reuse
- Stops idle development servers
- Reduces system load

### Resource Usage per Container
- **Base Image**: node:22-alpine (~40MB)
- **Volume Mount**: Host filesystem (0 extra storage)
- **Memory**: ~100-300MB per Node.js dev server
- **CPU**: Idle until accessed

## Next Steps

1. **Test the system**: Create multiple apps and access them via preview URLs
2. **Monitor containers**: Use the Container Info API to track port assignments
3. **Adjust timeout**: Modify `CONTAINER_INACTIVITY_TIMEOUT` based on workflow
4. **Expand port range**: Edit `container_lifecycle_service.ts` if needed
5. **Check logs**: Review backend logs for lifecycle events

---

For detailed architecture explanation, see [MULTI_CONTAINER_ARCHITECTURE.md](./MULTI_CONTAINER_ARCHITECTURE.md)
