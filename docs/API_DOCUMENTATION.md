# Backend API Documentation

Complete REST API reference for the Dyad Backend Server.

**Base URL**: `http://localhost:3001`  
**Content-Type**: `application/json`

---

## Table of Contents

1. [Apps API](#apps-api)
2. [Chats API](#chats-api)
3. [Docker API](#docker-api)
4. [Files API](#files-api)
5. [Git API](#git-api)
6. [Settings API](#settings-api)
7. [Streaming API (SSE)](#streaming-api-sse)
8. [Error Responses](#error-responses)
9. [Data Models](#data-models)

---

## Apps API

Manage applications (projects) in the system.

### List All Apps

```http
GET /api/apps
```

**Response**
```json
{
  "data": [
    {
      "id": 1,
      "name": "my-app",
      "path": "./apps/my-app",
      "githubOrg": "myorg",
      "githubRepo": "my-app",
      "installCommand": "pnpm install",
      "startCommand": "pnpm dev",
      "isFavorite": false,
      "createdAt": "2025-11-17T10:00:00Z",
      "updatedAt": "2025-11-17T10:00:00Z"
    }
  ]
}
```

---

### Get App by ID

```http
GET /api/apps/:id
```

**Path Parameters**
- `id` (integer, required) - App ID

**Response**
```json
{
  "data": {
    "id": 1,
    "name": "my-app",
    "path": "./apps/my-app",
    "installCommand": "pnpm install",
    "startCommand": "pnpm dev",
    "isFavorite": false,
    "createdAt": "2025-11-17T10:00:00Z"
  }
}
```

**Error Response**
```json
{
  "error": "App not found"
}
```
Status Code: `404`

---

### Create App

```http
POST /api/apps
```

**Request Body**
```json
{
  "name": "my-new-app",
  "path": "./apps/my-new-app",
  "githubOrg": "myorg",
  "githubRepo": "my-new-app",
  "installCommand": "pnpm install",
  "startCommand": "pnpm dev"
}
```

**Required Fields**
- `name` (string) - App name
- `path` (string) - App directory path

**Optional Fields**
- `githubOrg` (string) - GitHub organization
- `githubRepo` (string) - GitHub repository
- `installCommand` (string) - Installation command
- `startCommand` (string) - Start command

**Response**
```json
{
  "data": {
    "id": 2,
    "name": "my-new-app",
    "path": "./apps/my-new-app",
    "createdAt": "2025-11-17T10:00:00Z"
  }
}
```
Status Code: `201`

---

### Update App

```http
PUT /api/apps/:id
```

**Path Parameters**
- `id` (integer, required) - App ID

**Request Body**
```json
{
  "name": "updated-app-name",
  "installCommand": "npm install",
  "isFavorite": true
}
```

**Response**
```json
{
  "data": {
    "id": 1,
    "name": "updated-app-name",
    "installCommand": "npm install",
    "isFavorite": true,
    "updatedAt": "2025-11-17T11:00:00Z"
  }
}
```

---

### Delete App

```http
DELETE /api/apps/:id
```

**Path Parameters**
- `id` (integer, required) - App ID

**Response**
```json
{
  "success": true,
  "message": "App deleted successfully"
}
```

---

### Toggle Favorite

```http
POST /api/apps/:id/favorite
```

**Path Parameters**
- `id` (integer, required) - App ID

**Response**
```json
{
  "data": {
    "id": 1,
    "isFavorite": true,
    "updatedAt": "2025-11-17T11:00:00Z"
  }
}
```

---

## Chats API

Manage chat conversations and messages.

### List Chats for App

```http
GET /api/chats?appId=1
```

**Query Parameters**
- `appId` (string, required) - App ID

**Response**
```json
{
  "data": [
    {
      "id": 1,
      "appId": 1,
      "title": "Create Express Server",
      "createdAt": "2025-11-17T10:00:00Z",
      "updatedAt": "2025-11-17T10:00:00Z"
    }
  ]
}
```

**Error Response**
```json
{
  "error": "appId query parameter is required"
}
```
Status Code: `400`

---

### Get Chat by ID

```http
GET /api/chats/:id
```

**Path Parameters**
- `id` (integer, required) - Chat ID

**Response**
```json
{
  "data": {
    "id": 1,
    "appId": 1,
    "title": "Create Express Server",
    "createdAt": "2025-11-17T10:00:00Z"
  }
}
```

---

### Create Chat

```http
POST /api/chats
```

**Request Body**
```json
{
  "appId": "1",
  "title": "New Chat Title"
}
```

**Required Fields**
- `appId` (string) - App ID

**Optional Fields**
- `title` (string) - Chat title

**Response**
```json
{
  "data": {
    "id": 2,
    "appId": 1,
    "title": "New Chat Title",
    "createdAt": "2025-11-17T10:00:00Z"
  }
}
```
Status Code: `201`

---

### Delete Chat

```http
DELETE /api/chats/:id
```

**Path Parameters**
- `id` (integer, required) - Chat ID

**Response**
```json
{
  "success": true,
  "message": "Chat deleted successfully"
}
```

---

### Get Messages for Chat

```http
GET /api/chats/:id/messages
```

**Path Parameters**
- `id` (integer, required) - Chat ID

**Response**
```json
{
  "data": [
    {
      "id": 1,
      "chatId": 1,
      "role": "user",
      "content": "Create a simple Express server",
      "model": "claude-3-5-sonnet-20241022",
      "createdAt": "2025-11-17T10:00:00Z"
    },
    {
      "id": 2,
      "chatId": 1,
      "role": "assistant",
      "content": "I'll create an Express server for you...",
      "model": "claude-3-5-sonnet-20241022",
      "createdAt": "2025-11-17T10:00:30Z"
    }
  ]
}
```

---

### Create Message

```http
POST /api/chats/:id/messages
```

**Path Parameters**
- `id` (integer, required) - Chat ID

**Request Body**
```json
{
  "role": "user",
  "content": "Add authentication to the server",
  "model": "claude-3-5-sonnet-20241022"
}
```

**Required Fields**
- `role` (string) - Message role: `user` or `assistant`
- `content` (string) - Message content

**Optional Fields**
- `model` (string) - AI model used

**Response**
```json
{
  "data": {
    "id": 3,
    "chatId": 1,
    "role": "user",
    "content": "Add authentication to the server",
    "createdAt": "2025-11-17T10:05:00Z"
  }
}
```
Status Code: `201`

---

### Update Message

```http
PUT /api/chats/:chatId/messages/:messageId
```

**Path Parameters**
- `chatId` (integer, required) - Chat ID
- `messageId` (integer, required) - Message ID

**Request Body**
```json
{
  "content": "Updated message content"
}
```

**Response**
```json
{
  "data": {
    "id": 3,
    "content": "Updated message content",
    "updatedAt": "2025-11-17T10:10:00Z"
  }
}
```

---

## Docker API

Manage Docker containers for running apps.

### Run App in Docker

```http
POST /api/apps/:appId/run
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body** (Optional)
```json
{
  "installCommand": "pnpm install",
  "startCommand": "pnpm dev"
}
```

**Response**
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

**Error Response**
```json
{
  "success": false,
  "error": "Docker execution is disabled. Set DOCKER_ENABLED=true in .env"
}
```
Status Code: `400`

**Notes**
- Requires Docker to be installed and running
- Uses environment variables from `.env` file
- Creates container with name `dyad-app-{appId}`
- Maps container port to `DOCKER_APP_PORT` (default: 32100)

---

### Stop App Container

```http
POST /api/apps/:appId/stop
```

**Path Parameters**
- `appId` (string, required) - App ID

**Response**
```json
{
  "success": true,
  "message": "App 1 stopped"
}
```

---

### Get App Container Status

```http
GET /api/apps/:appId/status
```

**Path Parameters**
- `appId` (string, required) - App ID

**Response**
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

---

### Cleanup App Volumes

```http
POST /api/apps/:appId/cleanup
```

**Path Parameters**
- `appId` (string, required) - App ID

**Response**
```json
{
  "success": true,
  "message": "Docker volumes removed for app 1"
}
```

**Notes**
- Removes Docker volumes: `dyad-pnpm-{appId}` and `dyad-node-modules-{appId}`
- Use this to free up disk space after deleting an app

---

### Get Docker Service Status

```http
GET /api/docker/status
```

**Response**
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

---

## Files API

File operations within app directories.

### List Files

```http
GET /api/files/:appId?path=src
```

**Path Parameters**
- `appId` (string, required) - App ID

**Query Parameters**
- `path` (string, optional) - Relative path within app directory (default: root)

**Response**
```json
{
  "data": [
    {
      "name": "index.ts",
      "type": "file",
      "size": 1024,
      "modifiedAt": "2025-11-17T10:00:00Z"
    },
    {
      "name": "utils",
      "type": "directory",
      "size": 0
    }
  ]
}
```

---

### Read File

```http
GET /api/files/:appId/read?path=src/index.ts
```

**Path Parameters**
- `appId` (string, required) - App ID

**Query Parameters**
- `path` (string, required) - File path relative to app directory

**Response**
```json
{
  "data": {
    "content": "import express from 'express';\n\nconst app = express();"
  }
}
```

**Error Response**
```json
{
  "error": "path query parameter is required"
}
```
Status Code: `400`

---

### Write File

```http
POST /api/files/:appId/write
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body**
```json
{
  "path": "src/server.ts",
  "content": "import express from 'express';\n\nconst app = express();"
}
```

**Required Fields**
- `path` (string) - File path relative to app directory
- `content` (string) - File content

**Response**
```json
{
  "success": true,
  "message": "File written successfully"
}
```

**Notes**
- Creates parent directories if they don't exist
- Overwrites existing files

---

### Delete File

```http
DELETE /api/files/:appId?path=src/old-file.ts
```

**Path Parameters**
- `appId` (string, required) - App ID

**Query Parameters**
- `path` (string, required) - File path relative to app directory

**Response**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

### Create Directory

```http
POST /api/files/:appId/mkdir
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body**
```json
{
  "path": "src/components"
}
```

**Required Fields**
- `path` (string) - Directory path relative to app directory

**Response**
```json
{
  "success": true,
  "message": "Directory created successfully"
}
```

---

### Get File Stats

```http
GET /api/files/:appId/stats?path=src/index.ts
```

**Path Parameters**
- `appId` (string, required) - App ID

**Query Parameters**
- `path` (string, required) - File path relative to app directory

**Response**
```json
{
  "data": {
    "size": 1024,
    "isFile": true,
    "isDirectory": false,
    "modifiedAt": "2025-11-17T10:00:00Z",
    "createdAt": "2025-11-16T09:00:00Z"
  }
}
```

---

## Git API

Git operations within app repositories.

### Initialize Repository

```http
POST /api/git/:appId/init
```

**Path Parameters**
- `appId` (string, required) - App ID

**Response**
```json
{
  "success": true,
  "message": "Git repository initialized"
}
```

---

### Clone Repository

```http
POST /api/git/:appId/clone
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body**
```json
{
  "url": "https://github.com/username/repo.git"
}
```

**Required Fields**
- `url` (string) - Git repository URL

**Response**
```json
{
  "success": true,
  "message": "Repository cloned successfully"
}
```

---

### Stage Files

```http
POST /api/git/:appId/add
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body**
```json
{
  "filepath": "src/index.ts"
}
```

**Optional Fields**
- `filepath` (string) - File path to stage (default: `.` for all files)

**Response**
```json
{
  "success": true,
  "message": "Files staged successfully"
}
```

---

### Commit Changes

```http
POST /api/git/:appId/commit
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body**
```json
{
  "message": "Add authentication feature",
  "author": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Required Fields**
- `message` (string) - Commit message

**Optional Fields**
- `author` (object) - Author information

**Response**
```json
{
  "success": true,
  "data": {
    "sha": "abc123def456"
  }
}
```

---

### Get Commit Log

```http
GET /api/git/:appId/log?depth=20
```

**Path Parameters**
- `appId` (string, required) - App ID

**Query Parameters**
- `depth` (string, optional) - Number of commits to retrieve (default: 10)

**Response**
```json
{
  "data": [
    {
      "sha": "abc123",
      "message": "Add authentication",
      "author": "John Doe",
      "date": "2025-11-17T10:00:00Z"
    }
  ]
}
```

---

### Checkout Branch/Commit

```http
POST /api/git/:appId/checkout
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body**
```json
{
  "ref": "main"
}
```

**Required Fields**
- `ref` (string) - Branch name, tag, or commit SHA

**Response**
```json
{
  "success": true,
  "message": "Checked out main"
}
```

---

### Push to Remote

```http
POST /api/git/:appId/push
```

**Path Parameters**
- `appId` (string, required) - App ID

**Request Body**
```json
{
  "remote": "origin",
  "ref": "main"
}
```

**Optional Fields**
- `remote` (string) - Remote name (default: `origin`)
- `ref` (string) - Branch name (default: `main`)

**Response**
```json
{
  "success": true,
  "message": "Pushed successfully"
}
```

---

### Get Repository Status

```http
GET /api/git/:appId/status
```

**Path Parameters**
- `appId` (string, required) - App ID

**Response**
```json
{
  "data": {
    "branch": "main",
    "modified": ["src/index.ts"],
    "added": ["src/new-file.ts"],
    "deleted": [],
    "untracked": ["temp.txt"]
  }
}
```

---

### Get Current Branch

```http
GET /api/git/:appId/branch
```

**Path Parameters**
- `appId` (string, required) - App ID

**Response**
```json
{
  "data": {
    "branch": "main"
  }
}
```

---

### List Branches

```http
GET /api/git/:appId/branches
```

**Path Parameters**
- `appId` (string, required) - App ID

**Response**
```json
{
  "data": [
    {
      "name": "main",
      "current": true
    },
    {
      "name": "feature/auth",
      "current": false
    }
  ]
}
```

---

## Settings API

Manage user settings and AI model configuration.

### Get Settings

```http
GET /api/settings
```

**Response**
```json
{
  "data": {
    "id": 1,
    "userId": "user123",
    "selectedModel": {
      "id": "claude-3-5-sonnet-20241022",
      "name": "Claude 3.5 Sonnet",
      "providerId": "anthropic"
    },
    "apiKeys": {
      "openai": "sk-proj...abc123",
      "anthropic": "sk-ant-...xyz789"
    },
    "selectedChatMode": "auto-code",
    "smartContextEnabled": true,
    "turboEditsV2Enabled": false
  }
}
```

**Notes**
- API keys are masked in response (first 8 chars + `...` + last 4 chars)

---

### Update Settings

```http
PUT /api/settings
```

**Request Body**
```json
{
  "selectedModel": {
    "id": "gpt-4o",
    "name": "GPT-4 Optimized",
    "providerId": "openai"
  },
  "selectedChatMode": "agent",
  "smartContextEnabled": false
}
```

**Optional Fields**
- `selectedModel` (object) - AI model configuration
- `selectedChatMode` (string) - Chat mode: `auto-code`, `agent`, `ask`, `custom`
- `smartContextEnabled` (boolean)
- `turboEditsV2Enabled` (boolean)

**Response**
```json
{
  "data": {
    "id": 1,
    "selectedModel": {
      "id": "gpt-4o",
      "name": "GPT-4 Optimized",
      "providerId": "openai"
    },
    "selectedChatMode": "agent",
    "updatedAt": "2025-11-17T11:00:00Z"
  }
}
```

---

### Update API Key

```http
PUT /api/settings/api-keys/:providerId
```

**Path Parameters**
- `providerId` (string, required) - Provider ID (`openai`, `anthropic`, etc.)

**Request Body**
```json
{
  "apiKey": "sk-proj-abc123..."
}
```

**Required Fields**
- `apiKey` (string) - API key for the provider

**Response**
```json
{
  "success": true,
  "message": "API key for openai updated successfully"
}
```

---

### Delete API Key

```http
DELETE /api/settings/api-keys/:providerId
```

**Path Parameters**
- `providerId` (string, required) - Provider ID

**Response**
```json
{
  "success": true,
  "message": "API key for openai deleted successfully"
}
```

---

### Get Available Models

```http
GET /api/settings/models
```

**Response**
```json
{
  "data": {
    "openai": [
      {
        "id": "gpt-4o",
        "name": "GPT-4 Optimized"
      },
      {
        "id": "gpt-4-turbo",
        "name": "GPT-4 Turbo"
      }
    ],
    "anthropic": [
      {
        "id": "claude-3-5-sonnet-20241022",
        "name": "Claude 3.5 Sonnet"
      },
      {
        "id": "claude-3-opus-20240229",
        "name": "Claude 3 Opus"
      }
    ]
  }
}
```

---

## Streaming API (SSE)

Server-Sent Events for real-time AI chat streaming.

### Stream Chat Response

```http
POST /api/stream/chat
```

**Headers**
```
Content-Type: application/json
Accept: text/event-stream
```

**Request Body**
```json
{
  "chatId": 1,
  "prompt": "Create a simple Express server",
  "attachments": [],
  "selectedComponent": null,
  "redo": false
}
```

**Required Fields**
- `chatId` (number) - Chat ID

**Optional Fields**
- `prompt` (string) - User prompt
- `messageId` (number) - Message ID to regenerate
- `attachments` (array) - File attachments
- `selectedComponent` (object) - Selected file context
- `redo` (boolean) - Regenerate last response

**SSE Events**

#### connected
```
event: connected
data: {"message":"Stream connected"}
```

#### chat:chunk
Streaming response chunks from AI
```
event: chat:chunk
data: {"chatId":1,"chunk":"Here's an Express server..."}
```

#### chat:complete
AI response completed
```
event: chat:complete
data: {"chatId":1,"messageId":2,"content":"Complete response text"}
```

#### docker:starting
Docker container is starting (automatic after file generation)
```
event: docker:starting
data: {"chatId":1,"appId":1,"message":"Starting app in Docker container..."}
```

#### docker:started
Docker container started successfully
```
event: docker:started
data: {"chatId":1,"appId":1,"port":32100,"url":"http://localhost:32100"}
```

#### docker:output
Container stdout/stderr output
```
event: docker:output
data: {"appId":1,"output":"Server running on port 3000"}
```

#### docker:error
Container error output
```
event: docker:error
data: {"appId":1,"error":"Connection refused"}
```

#### docker:closed
Container stopped
```
event: docker:closed
data: {"appId":1,"code":0}
```

#### chat:error
Error during streaming
```
event: chat:error
data: {"chatId":1,"error":"API key not configured"}
```

**Example Client (JavaScript)**
```javascript
const response = await fetch('http://localhost:3001/api/stream/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatId: 1,
    prompt: 'Create a simple Express server'
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const event = line.slice(7);
      continue;
    }
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(event, data);
    }
  }
}
```

---

### Cancel Chat Stream

```http
POST /api/stream/chat/:chatId/cancel
```

**Path Parameters**
- `chatId` (number, required) - Chat ID

**Response**
```json
{
  "success": true,
  "message": "Stream cancelled"
}
```

---

## Error Responses

All endpoints return consistent error responses:

### Validation Error
```json
{
  "error": "appId query parameter is required"
}
```
Status Code: `400`

### Not Found Error
```json
{
  "error": "App not found"
}
```
Status Code: `404`

### Server Error
```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```
Status Code: `500`

---

## Data Models

### App
```typescript
{
  id: number;
  name: string;
  path: string;
  githubOrg?: string;
  githubRepo?: string;
  installCommand?: string;
  startCommand?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Chat
```typescript
{
  id: number;
  appId: number;
  title?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Message
```typescript
{
  id: number;
  chatId: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Settings
```typescript
{
  id: number;
  userId: string;
  selectedModel: {
    id: string;
    name: string;
    providerId: string;
  };
  apiKeys: Record<string, string>;
  selectedChatMode: 'auto-code' | 'agent' | 'ask' | 'custom';
  smartContextEnabled: boolean;
  turboEditsV2Enabled: boolean;
}
```

### FileInfo
```typescript
{
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt?: string;
}
```

### GitStatus
```typescript
{
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}
```

---

## Environment Variables

Required environment variables in `.env`:

```bash
# Database
DATABASE_URL=./data/dyad.db

# AI Providers (at least one required)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Docker Configuration
DOCKER_ENABLED=true
DOCKER_APP_PORT=32100
DOCKER_NODE_IMAGE=node:22-alpine

# Server
PORT=3001
NODE_ENV=development
```

---

## Rate Limits

Currently no rate limits are enforced. Implement as needed based on AI provider limits.

---

## Authentication

Authentication is not currently implemented. All endpoints are publicly accessible. Implement JWT or session-based auth as needed for production.

---

## CORS

CORS is enabled for all origins in development. Configure appropriately for production:

```typescript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

---

## Changelog

### Version 1.0.0 (2025-11-17)
- Initial API documentation
- Apps, Chats, Docker, Files, Git, Settings, Streaming APIs
- SSE-based streaming with Docker integration
- Automatic Docker container startup after AI file generation

---

## Support

For issues or questions, please refer to:
- [DOCKER.md](./DOCKER.md) - Docker integration details
- [README.md](./README.md) - General backend documentation
- [AGENTS.md](../AGENTS.md) - Repository agent guide
