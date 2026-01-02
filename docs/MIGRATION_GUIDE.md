# Backend Migration Guide

## Overview

This document describes the migration from Electron IPC handlers to a standalone Express + WebSocket backend server.

## Architecture Changes

### Before (Electron)
```
Frontend (React) → IPC → Main Process (Node.js) → Database/AI
```

### After (Standalone Backend)
```
Frontend (React) → HTTP/WebSocket → Express Server (Node.js) → Database/AI
```

## Key Components

### 1. REST API Routes (`src/routes/`)

Replaces synchronous IPC handlers:

| Route | Replaces IPC Handler | Description |
|-------|---------------------|-------------|
| `GET /api/apps` | `list-apps` | List all apps |
| `POST /api/apps` | `create-app` | Create new app |
| `GET /api/chats` | `get-chats` | List chats for app |
| `POST /api/chats` | `create-chat` | Create new chat |
| `GET /api/chats/:id/messages` | `get-messages` | Get chat messages |

### 2. WebSocket Streaming (`src/websocket/`)

Replaces asynchronous IPC streaming:

| WebSocket Event | Replaces IPC Channel | Description |
|----------------|---------------------|-------------|
| `chat:stream` | `chat:stream` | AI chat streaming |
| `chat:cancel` | `chat:cancel` | Cancel active stream |
| `chat:chunk` | `chat:response:chunk` | Response chunks |
| `chat:complete` | `chat:response:end` | Stream complete |
| `chat:error` | `chat:response:error` | Error handling |

### 3. Services (`src/services/`)

Business logic extracted from IPC handlers:

- **ai_service.ts**: LLM provider configuration and streaming (from `get_model_client.ts`)
- **codebase_service.ts**: Context extraction (from `codebase.ts`)  
- **prompt_service.ts**: System prompt generation (from `system_prompt.ts`)
- **chat_service.ts**: Chat/message CRUD operations
- **app_service.ts**: App management
- **file_service.ts**: File operations
- **git_service.ts**: Git operations

## API Documentation

### Swagger UI

Access interactive API docs at: **http://localhost:3000/api-docs**

- Try all endpoints directly from the browser
- View request/response schemas
- See example payloads

### REST Endpoints

#### Apps
```bash
# List all apps
GET /api/apps

# Get single app
GET /api/apps/:id

# Create app
POST /api/apps
{
  "name": "My App",
  "path": "/path/to/app",
  "githubOrg": "myorg",
  "githubRepo": "myrepo"
}

# Update app
PUT /api/apps/:id
{
  "name": "Updated Name",
  "isFavorite": true
}

# Delete app
DELETE /api/apps/:id
```

#### Chats
```bash
# List chats for app
GET /api/chats?appId=1

# Get chat with messages
GET /api/chats/:id

# Create chat
POST /api/chats
{
  "appId": 1,
  "title": "New Feature"
}

# Delete chat
DELETE /api/chats/:id

# Get messages
GET /api/chats/:id/messages

# Create message
POST /api/chats/:id/messages
{
  "role": "user",
  "content": "Add a login button",
  "model": "gpt-4"
}
```

### WebSocket Protocol

Connect to: `ws://localhost:3000/ws`

#### Client → Server Messages

**Start Chat Stream:**
```json
{
  "type": "chat:stream",
  "data": {
    "chatId": 1,
    "prompt": "Add authentication",
    "attachments": [],
    "selectedComponent": null,
    "redo": false
  }
}
```

**Cancel Stream:**
```json
{
  "type": "chat:cancel",
  "data": {
    "chatId": 1
  }
}
```

#### Server → Client Messages

**Connection Established:**
```json
{
  "type": "connected",
  "message": "Connected to Dyad WebSocket server"
}
```

**Stream Started:**
```json
{
  "type": "chat:start",
  "data": {
    "chatId": 1,
    "messages": [ /* all messages including user */ ]
  }
}
```

**Response Chunk:**
```json
{
  "type": "chat:chunk",
  "data": {
    "chatId": 1,
    "chunk": "I'll help you add authentication. ",
    "fullText": "I'll help you add authentication. "
  }
}
```

**Stream Complete:**
```json
{
  "type": "chat:complete",
  "data": {
    "chatId": 1,
    "message": { /* full assistant message */ },
    "updatedFiles": true
  }
}
```

**Error:**
```json
{
  "type": "chat:error",
  "data": {
    "chatId": 1,
    "error": "API key not configured"
  }
}
```

## Configuration

### Environment Variables

Create `.env` file in `backend/` directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dyad

# Server
PORT=3000
NODE_ENV=development

# Paths
DATA_DIR=./data/apps

# Optional: AI Provider API Keys (can also be stored in database)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Database Setup

```bash
cd backend

# Install dependencies
npm install

# Generate migrations
npm run db:generate

# Apply migrations
npm run db:push

# Start server
npm run dev
```

## Migration Checklist

### Backend (Completed ✅)

- [x] PostgreSQL schema conversion
- [x] REST API routes (apps, chats, files, git)
- [x] WebSocket server setup
- [x] AI service with OpenAI/Anthropic support
- [x] Codebase context extraction
- [x] Prompt service for system prompts
- [x] Swagger API documentation
- [x] CORS configuration
- [x] Error handling middleware

### Backend (TODO 🔄)

- [ ] Complete chat streaming implementation (Steps 15-18 from diagram)
  - [ ] Parse dyad tags (write, rename, delete, search-replace)
  - [ ] Execute file operations
  - [ ] Git commit with file tracking
  - [ ] Add dependencies (npm, pip)
  - [ ] SQL migrations execution
- [ ] File attachments handling
  - [ ] Upload-to-codebase attachments
  - [ ] Chat-context attachments
  - [ ] Image attachments for multimodal
- [ ] Settings table and management
  - [ ] API keys storage
  - [ ] Model selection
  - [ ] Chat mode configuration
- [ ] Smart context features
  - [ ] Auto-detect file references
  - [ ] Include related files
- [ ] Turbo Edits V2
  - [ ] Search-replace validation
  - [ ] Dry run and retry
- [ ] MCP tools integration (if needed)
- [ ] Authentication & authorization
- [ ] Rate limiting
- [ ] Usage tracking

### Frontend (TODO 🔄)

- [ ] Replace IPC client with HTTP client
- [ ] WebSocket connection management
- [ ] Update all components to use REST API
- [ ] Handle WebSocket reconnection
- [ ] Update state management (remove IPC queries)
- [ ] Error handling for network failures
- [ ] Loading states for HTTP requests
- [ ] Real-time updates via WebSocket events

## Testing

### Manual Testing

```bash
# Start backend server
cd backend
npm run dev

# In another terminal, test REST API
curl http://localhost:3000/api/apps

# Test WebSocket with wscat
npm install -g wscat
wscat -c ws://localhost:3000/ws

# Send test message
{"type":"ping"}
```

### Swagger UI

Visit http://localhost:3000/api-docs and test all endpoints interactively.

## Deployment

### Development

```bash
cd backend
npm run dev
```

Runs on http://localhost:3000

### Production

```bash
cd backend
npm run build
npm start
```

Or use process manager:

```bash
pm2 start npm --name "dyad-backend" -- start
```

### Docker (Future)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Performance Considerations

### Caching

- File content cached during context extraction
- Settings cached in AIService
- Clear caches periodically or on updates

### Streaming

- Chunks sent immediately (not buffered)
- AbortController for cancellation
- Connection cleanup on errors

### Database

- Indexed foreign keys (appId, chatId)
- Pagination for large result sets
- Connection pooling (max 10 connections)

### Rate Limiting

- Implement per-user rate limits
- Queue requests during high load
- Graceful degradation

## Security

### API Keys

- Stored encrypted in database
- Never exposed to frontend
- Rotated regularly

### Path Validation

- All file operations use `safeJoin()`
- Prevents directory traversal
- Constrained to app directory

### CORS

- Configured for specific origins in production
- Credentials support enabled
- All HTTP methods allowed for development

### Input Validation

- Request body validation
- File size limits
- SQL injection prevention (Drizzle ORM parameterized queries)

## Troubleshooting

### CORS Errors

If Swagger UI shows CORS errors:
1. Check `backend/src/index.ts` CORS configuration
2. Ensure `origin: "*"` for development
3. Restart server after changes

### WebSocket Connection Failed

1. Check server is running: `curl http://localhost:3000/health`
2. Test WebSocket endpoint: `wscat -c ws://localhost:3000/ws`
3. Check firewall/proxy settings

### Database Connection Error

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Test connection: `psql $DATABASE_URL`
4. Run migrations: `npm run db:push`

### AI Provider Errors

1. Verify API key is set (environment or database)
2. Check provider status (OpenAI/Anthropic)
3. Review rate limits
4. Check model availability

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [WebSocket API](https://github.com/websockets/ws)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Swagger/OpenAPI](https://swagger.io/specification/)

## Support

For issues or questions:
1. Check existing documentation
2. Review error logs: `backend/logs/`
3. Test with Swagger UI
4. Check GitHub issues

---

**Last Updated:** November 13, 2025  
**Version:** 1.0.0  
**Status:** Migration in progress (backend 70% complete, frontend not started)
