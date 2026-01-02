# Docker Integration - End-to-End Flow Test

## Overview
This document describes how the Docker integration works when an AI generates code and automatically runs it in a container.

## Complete Flow

### 1. User Creates App and Starts Chat
```
User → Frontend → POST /api/apps
                → POST /api/chats
                → POST /api/chats/:chatId/messages
```

### 2. User Sends Message to AI
```
User types: "Create a simple Express server with a /hello endpoint"
  ↓
Frontend → POST /api/stream/chat
  ↓
Backend receives request
```

### 3. Backend Streams AI Response
```
Backend (stream.ts):
  1. Load chat history
  2. Build system prompt
  3. Call AI provider (OpenAI/Anthropic/Google)
  4. Stream response chunks to frontend
     - event: chat:chunk
     - data: { chunk: "...", fullText: "..." }
```

### 4. AI Generates Code with Dyad Tags
```
AI Response:
I'll create an Express server for you.

<dyad-write path="server.js">
const express = require('express');
const app = express();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello World!' });
});

app.listen(32100, '0.0.0.0', () => {
  console.log('Server running on port 32100');
});
</dyad-write>

<dyad-write path="package.json">
{
  "name": "express-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
</dyad-write>
```

### 5. Backend Parses Dyad Tags
```typescript
// In stream.ts after AI completes
const dyadWriteRegex = /<dyad-write path="([^"]+)">\s*(?:```[\w]*\s*)?([\s\S]*?)(?:```\s*)?<\/dyad-write>/g;

while ((match = dyadWriteRegex.exec(fullResponse)) !== null) {
  const [, filePath, content] = match;
  fileChanges.push({
    path: filePath,
    type: 'write',
    content: content.trim(),
  });
}
```

### 6. Backend Writes Files to Disk
```typescript
for (const change of fileChanges) {
  const fullPath = path.join(app.path, change.path);
  
  if (change.type === 'write') {
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, change.content || '', 'utf-8');
    console.log(`  ✅ Wrote: ${change.path}`);
  }
}
```

Result on disk:
```
./apps/my-app/
  ├── server.js
  └── package.json
```

### 7. Backend Automatically Starts Docker Container
```typescript
// After files are written
const dockerService = getDockerService();

if (dockerConfig.enabled && fileChanges.length > 0) {
  console.log('🐳 Starting app in Docker container...');
  
  // Send event to frontend
  sendEvent('docker:starting', {
    chatId: req.chatId,
    appId: app.id,
    message: 'Starting app in Docker container...',
  });

  // Run in Docker
  await dockerService.runAppInDocker({
    appId: app.id,
    appPath: app.path,
    installCommand: app.installCommand,
    startCommand: app.startCommand,
  });
}
```

### 8. Docker Service Creates and Runs Container
```typescript
// docker_service.ts

async runAppInDocker(params) {
  // 1. Check if Docker is available
  await this.isDockerAvailable();
  
  // 2. Stop any existing container
  await this.stopAndRemoveContainer(`dyad-app-${appId}`);
  
  // 3. Create Dockerfile.dyad if missing
  const dockerfileContent = `
FROM node:22-alpine
RUN npm install -g pnpm
`;
  await fs.writeFile(path.join(appPath, 'Dockerfile.dyad'), dockerfileContent);
  
  // 4. Build Docker image
  spawn('docker', [
    'build', '-f', 'Dockerfile.dyad', 
    '-t', `dyad-app-${appId}`, '.'
  ], { cwd: appPath });
  
  // 5. Run container
  spawn('docker', [
    'run',
    '--rm',
    '--name', `dyad-app-${appId}`,
    '-p', '32100:32100',
    '-v', `${appPath}:/app`,
    '-v', `dyad-pnpm-${appId}:/app/.pnpm-store`,
    '-e', 'PNPM_STORE_PATH=/app/.pnpm-store',
    '-w', '/app',
    `dyad-app-${appId}`,
    'sh', '-c',
    'pnpm install && pnpm start'
  ]);
}
```

### 9. Docker Container Execution
```bash
# Inside container
$ pnpm install
# Downloads and installs express

$ pnpm start
# Executes: node server.js
Server running on port 32100
```

Container details:
- **Name**: `dyad-app-{appId}`
- **Image**: `dyad-app-{appId}`
- **Port**: Host 32100 → Container 32100
- **Volumes**:
  - `./apps/my-app:/app` (app code)
  - `dyad-pnpm-{appId}:/app/.pnpm-store` (deps cache)

### 10. Backend Streams Docker Events to Frontend
```typescript
sendEvent('docker:started', {
  chatId: req.chatId,
  appId: app.id,
  port: 32100,
  url: 'http://localhost:32100',
  message: 'App is running in Docker container',
});

// Stream container output
onOutput: (data) => {
  sendEvent('docker:output', {
    appId: app.id,
    output: data,
  });
}
```

### 11. Frontend Receives Docker Events
```typescript
// ChatInterface.tsx

if (event === 'docker:starting') {
  setDockerStatus('🐳 Starting Docker container...');
}
else if (event === 'docker:started') {
  setDockerStatus('✅ App running in Docker');
  setDockerUrl(parsed.url);
}
```

### 12. Frontend Shows Docker Status Bar
```tsx
{dockerStatus && (
  <div className="docker-status">
    <span>{dockerStatus}</span>
    {dockerUrl && (
      <a href={dockerUrl} target="_blank">
        Open App →
      </a>
    )}
  </div>
)}
```

User sees:
```
┌─────────────────────────────────────────────┐
│ ✅ App running in Docker    [Open App →]   │
└─────────────────────────────────────────────┘
```

### 13. User Opens App
```
User clicks "Open App →"
  ↓
Opens http://localhost:32100 in new tab
  ↓
Browser → Docker Container (port 32100)
  ↓
Express server responds: {"message": "Hello World!"}
```

## Event Flow Diagram

```
User Input
   ↓
Frontend (POST /api/stream/chat)
   ↓
Backend Stream Handler
   ↓
AI Provider (OpenAI/Anthropic/Google)
   ↓
Parse Response (extract <dyad-write> tags)
   ↓
Write Files to Disk
   ↓
Docker Service
   ↓
┌─────────────────────────────┐
│ 1. Check Docker available   │
│ 2. Stop existing container  │
│ 3. Create Dockerfile        │
│ 4. Build image              │
│ 5. Run container            │
└─────────────────────────────┘
   ↓
Container Running
   ↓
Stream events to Frontend
   ↓
Frontend shows Docker status
   ↓
User opens app in browser
   ↓
App accessible at localhost:32100
```

## SSE Events Reference

### From Backend to Frontend

| Event | Data | Description |
|-------|------|-------------|
| `connected` | `{ timestamp }` | Connection established |
| `chat:start` | `{ chatId, messageId }` | Chat streaming started |
| `chat:chunk` | `{ chunk, fullText }` | AI response chunk |
| `chat:complete` | `{ assistantMessageId, fullText, fileChanges }` | Stream complete |
| `chat:error` | `{ error }` | Error occurred |
| `docker:starting` | `{ appId, message }` | Docker starting |
| `docker:started` | `{ appId, port, url }` | Docker running |
| `docker:output` | `{ appId, output }` | Container output |
| `docker:error` | `{ appId, error }` | Docker error |
| `docker:closed` | `{ appId, exitCode }` | Container stopped |

## Testing the Complete Flow

### Prerequisites
```bash
# 1. Docker running
docker --version

# 2. Backend running
cd backend
npm run dev

# 3. Frontend running
cd frontend
npm run dev

# 4. Docker enabled in .env
DOCKER_ENABLED=true
DOCKER_APP_PORT=32100
```

### Test Steps

1. **Open Frontend**
   ```
   http://localhost:5173
   ```

2. **Create App**
   - Click "+ New App"
   - Name: "test-server"
   - Path: "test-server"

3. **Start Chat**
   - Select the app
   - Click "+ New Chat"

4. **Send Prompt**
   ```
   Create a simple Express server with a /hello endpoint that returns JSON
   ```

5. **Watch Events**
   - Open browser console (F12)
   - See SSE events streaming
   - Watch Docker status bar appear

6. **Open App**
   - Click "Open App →" button
   - New tab opens to http://localhost:32100
   - See app running

7. **Verify Docker**
   ```bash
   # List running containers
   docker ps --filter "name=dyad-app-*"
   
   # View container logs
   docker logs dyad-app-1
   
   # List volumes
   docker volume ls --filter "name=dyad-pnpm-*"
   ```

## File Structure After Generation

```
backend/
├── .env (DOCKER_ENABLED=true)
├── apps/
│   └── test-server/
│       ├── Dockerfile.dyad (auto-generated)
│       ├── server.js (AI-generated)
│       └── package.json (AI-generated)
└── src/
    ├── routes/
    │   ├── stream.ts (handles AI + Docker)
    │   └── docker.ts (Docker API)
    └── services/
        └── docker_service.ts (Docker logic)

frontend/
└── src/
    └── components/
        ├── ChatInterface.tsx (shows Docker status)
        └── ChatInterface.css (Docker status styles)
```

## Troubleshooting

### Docker Container Not Starting
```bash
# Check if Docker is running
docker ps

# Check backend logs
tail -f backend/logs/app.log

# Check container logs
docker logs dyad-app-1

# Rebuild image
docker rmi dyad-app-1
```

### Port Already in Use
```bash
# Find process on port 32100
lsof -i :32100

# Kill process
kill -9 <PID>

# Or change port in .env
DOCKER_APP_PORT=32101
```

### Files Not Generated
- Check backend console for parsing errors
- Verify AI response includes `<dyad-write>` tags
- Check app path exists: `ls -la backend/apps/test-server`

### Frontend Not Showing Docker Status
- Open browser console
- Check for SSE events: `docker:starting`, `docker:started`
- Verify CORS is enabled on backend

## Performance Metrics

| Operation | First Run | Subsequent | Notes |
|-----------|-----------|------------|-------|
| AI Response | 5-15s | 5-15s | Model dependent |
| File Write | <100ms | <100ms | Local disk |
| Docker Build | 30-60s | 2-5s | Image cached |
| Container Start | 5-10s | 3-5s | - |
| Deps Install | 10-30s | 2-5s | Volume cached |
| **Total** | **50-120s** | **15-35s** | - |

## Configuration Reference

### Backend (.env)
```env
DOCKER_ENABLED=true
DOCKER_APP_PORT=32100
DOCKER_NODE_IMAGE=node:22-alpine
APPS_BASE_DIR=./apps
```

### Docker Defaults
```typescript
{
  enabled: process.env.DOCKER_ENABLED === 'true',
  port: parseInt(process.env.DOCKER_APP_PORT || '32100', 10),
  nodeImage: process.env.DOCKER_NODE_IMAGE || 'node:22-alpine',
}
```

### AI System Prompt
The prompt includes instructions for using `<dyad-write>` tags:
```
Use <dyad-write path="filename">content</dyad-write> to create/update files.
```

## Success Criteria

✅ **Complete Flow Working When:**
1. AI generates code with `<dyad-write>` tags
2. Backend parses and writes files to disk
3. Docker container automatically starts
4. Frontend shows Docker status bar
5. User can click "Open App →" to access running app
6. App is accessible at http://localhost:32100
7. Container output is logged (optional: streamed to frontend)

## Next Steps

After verifying the flow works:
1. Add real-time container log streaming to frontend
2. Implement auto-restart on file changes
3. Add container health checks
4. Support multiple port mappings
5. Add Docker Compose support for multi-service apps
