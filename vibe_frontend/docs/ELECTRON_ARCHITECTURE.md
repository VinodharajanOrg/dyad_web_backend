# Electron Architecture (Original Implementation)

**Status:** Historical Documentation - This describes the original Electron-based architecture before the Next.js migration.

---

## Overview

Dyad was originally built as an Electron desktop application. Electron apps follow a multi-process architecture where a **main process** (Node.js) handles system-level operations, and **renderer processes** (Chromium) run the UI. Communication between these processes happens through Inter-Process Communication (IPC).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
│                                                              │
│  ┌────────────────────────┐      ┌────────────────────────┐ │
│  │   Renderer Process     │      │     Main Process       │ │
│  │   (Chromium)           │      │     (Node.js)          │ │
│  │                        │      │                        │ │
│  │  ┌──────────────────┐  │      │  ┌──────────────────┐  │ │
│  │  │   React UI       │  │      │  │  IPC Host        │  │ │
│  │  │   - TanStack     │  │      │  │  - Handlers      │  │ │
│  │  │     Router       │  │      │  │  - Routes        │  │ │
│  │  │   - Jotai State  │  │      │  │                  │  │ │
│  │  │   - Components   │  │◄────►│  │  ┌────────────┐  │  │ │
│  │  └──────────────────┘  │ IPC  │  │  │ Handlers   │  │  │ │
│  │                        │      │  │  ├────────────┤  │  │ │
│  │  ┌──────────────────┐  │      │  │  │ App        │  │  │ │
│  │  │   IPC Client     │  │      │  │  │ Chat       │  │  │ │
│  │  │   (ipc_client.ts)│  │      │  │  │ Settings   │  │  │ │
│  │  └──────────────────┘  │      │  │  │ Git        │  │  │ │
│  │                        │      │  │  │ File Ops   │  │  │ │
│  └────────────────────────┘      │  │  │ AI/LLM     │  │  │ │
│            ▲                     │  │  │ ...        │  │  │ │
│            │                     │  │  └────────────┘  │  │ │
│  ┌─────────┴──────────┐          │  │                  │  │ │
│  │   Preload Script   │          │  │  ┌────────────┐  │  │ │
│  │   (preload.ts)     │          │  │  │ SQLite DB  │  │  │ │
│  │   - Security Layer │          │  │  │ (Better-   │  │  │ │
│  │   - Context Bridge │          │  │  │  SQLite3)  │  │  │ │
│  └────────────────────┘          │  │  └────────────┘  │  │ │
│                                  │  │                  │  │ │
└──────────────────────────────────┴──┴──────────────────┴──┴─┘
                                      │
                                      ├─ File System (Direct Access)
                                      ├─ Git Operations (NodeGit/SimpleGit)
                                      ├─ External APIs (LLM Providers)
                                      └─ System Resources
```

## Key Components

### 1. Main Process (`src/main.ts`)

The main process is a Node.js process that has full access to system resources:

**Responsibilities:**
- **Application lifecycle management** - startup, shutdown, window creation
- **File system operations** - reading/writing user project files
- **Database operations** - SQLite for storing apps, chats, messages, settings
- **Git operations** - version control for user projects
- **LLM API calls** - communicating with AI providers (OpenAI, Anthropic, etc.)
- **System integrations** - GitHub, Supabase, Vercel, Neon
- **Security** - sandboxing, permissions

**Key Files:**
- `src/main.ts` - Entry point, window management
- `src/ipc/ipc_host.ts` - IPC handler registry
- `src/ipc/handlers/*.ts` - ~38 handler files for different features

### 2. Renderer Process

The renderer process runs in a Chromium browser context with limited permissions:

**Responsibilities:**
- **UI rendering** - React components, routing
- **State management** - Jotai atoms for global state
- **User interactions** - forms, buttons, inputs
- **Display logic** - showing chat messages, previews, file trees

**Key Files:**
- `src/renderer.tsx` - Entry point
- `src/router.ts` - TanStack Router configuration
- `src/components/**/*.tsx` - UI components
- `src/atoms/*.ts` - Jotai state atoms
- `src/ipc/ipc_client.ts` - IPC communication wrapper

### 3. Preload Script (`src/preload.ts`)

The preload script acts as a secure bridge between renderer and main processes:

**Purpose:**
- **Security boundary** - exposes only allowed IPC channels
- **Context isolation** - prevents renderer from accessing Node.js APIs directly
- **Type safety** - provides typed API for IPC calls

**Example:**
```typescript
// Preload exposes safe API
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (ALLOWED_CHANNELS.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
    }
  }
});
```

### 4. IPC Communication

**How it works:**
1. Renderer calls `ipcClient.someMethod()`
2. IPC Client sends message through preload bridge
3. Main process receives via `ipcHost.handle(channel, handler)`
4. Handler executes business logic (DB, FS, API calls)
5. Result is sent back to renderer
6. IPC Client resolves promise with result

**Example Flow:**
```typescript
// Renderer (ipc_client.ts)
async createApp(params) {
  return this.ipcRenderer.invoke('create-app', params);
}

// Main (app_handlers.ts)
handle('create-app', async (event, params) => {
  // Validate params
  // Create directory
  // Initialize git
  // Insert into SQLite
  return { id, name, path };
});
```

## End-to-End Flow: Chat Streaming & Preview

### 1. User Enters Prompt

```
┌─────────────────────────────────────────────────────────────┐
│ User types in ChatInput component                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ ChatInput calls useStreamChat.streamMessage()                │
│ - Builds request with prompt, chat ID, attachments          │
│ - Sets isStreaming = true in atom                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ IPC Client sends 'start-chat-stream' event                  │
│ Payload: { prompt, chatId, attachments, selectedComponent } │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼ IPC
┌─────────────────────────────────────────────────────────────┐
│ Main Process - chat_stream_handlers.ts                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Main Process Builds LLM Request

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Load app context from file system                        │
│    - Read all files in app directory                        │
│    - Build codebase context                                 │
│    - Smart Context filtering (if enabled)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Construct LLM messages                                   │
│    - System prompt (with Dyad XML tags)                     │
│    - Previous chat history                                  │
│    - User prompt                                            │
│    - Codebase context                                       │
│    - Selected component info (if any)                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Call LLM API (OpenAI/Anthropic/etc)                     │
│    - Stream mode enabled                                    │
│    - Token counting                                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼ Streaming chunks
```

### 3. Stream Response to Renderer

```
┌─────────────────────────────────────────────────────────────┐
│ For each chunk from LLM:                                     │
│                                                              │
│ 1. Accumulate full response                                 │
│ 2. Send IPC event: 'chat-stream-chunk'                     │
│    { chatId, chunk, fullText }                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼ IPC Events
┌─────────────────────────────────────────────────────────────┐
│ Renderer - useStreamChat hook                               │
│                                                              │
│ 1. Receives chunks via IPC listener                         │
│ 2. Updates chatMessagesById atom                            │
│ 3. MessagesList re-renders with new content                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ ChatMessage component renders streaming text                │
│ - Shows loading animation                                   │
│ - DyadMarkdownParser parses <dyad-*> tags                  │
│ - Displays formatted output                                 │
└─────────────────────────────────────────────────────────────┘
```

### 4. Process LLM Response (Apply Changes)

```
┌─────────────────────────────────────────────────────────────┐
│ Stream Complete - Main Process                              │
│                                                              │
│ 1. Parse full response (response_processor.ts)              │
│    - Extract <dyad-write> tags → write files               │
│    - Extract <dyad-edit> tags → edit files                 │
│    - Extract <dyad-delete> tags → delete files             │
│    - Extract <dyad-rename> tags → rename files             │
│    - Extract <dyad-add-dependency> → npm install           │
│    - Extract other tags...                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Apply file system changes                                │
│    - Write/edit/delete files in app directory              │
│    - Execute npm install if needed                          │
│    - Run TypeScript compiler (if auto-fix enabled)         │
│    - Create git commit                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Store in database (SQLite)                               │
│    - Save assistant message to messages table               │
│    - Update chat timestamp                                  │
│    - Store approval state (if required)                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Send completion event                                    │
│    IPC: 'chat-stream-end'                                  │
│    { chatId, updatedFiles: true }                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼ IPC Event
```

### 5. Update UI & Preview

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer receives 'chat-stream-end' event                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Update state                                              │
│    - Set isStreaming = false                                │
│    - Refresh file tree (IPC: list-app-files)               │
│    - Refresh app info                                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Open/Refresh Preview Panel                               │
│    - Set isPreviewOpen = true                               │
│    - PreviewIframe reloads                                  │
│    - Shows updated app with new changes                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Additional actions (if enabled)                          │
│    - Auto-fix TypeScript errors                            │
│    - Check problems                                         │
│    - Sync to Docker (if Docker runtime)                    │
└─────────────────────────────────────────────────────────────┘
```

## Preview Panel Architecture

The preview panel shows the user's app running in real-time:

```
┌─────────────────────────────────────────────────────────────┐
│ PreviewPanel Component                                       │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ActionHeader                                            │ │
│ │ - Run/Stop buttons                                      │ │
│ │ - Refresh                                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PreviewIframe                                           │ │
│ │                                                         │ │
│ │  ┌────────────────────────────────────────────────┐    │ │
│ │  │ User's App Running                            │    │ │
│ │  │ (Vite dev server via proxy)                   │    │ │
│ │  │                                                │    │ │
│ │  │ http://localhost:5173                         │    │ │
│ │  └────────────────────────────────────────────────┘    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Console                                                 │ │
│ │ - Console logs from preview app                        │ │
│ │ - Error messages                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Problems                                                │ │
│ │ - TypeScript errors                                    │ │
│ │ - Lint warnings                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**How Preview Works:**

1. **Start Dev Server** (IPC: `run-app`)
   - Main process spawns Vite dev server
   - Port: dynamic (5173, 5174, etc.)
   - Process managed by process_manager.ts

2. **Proxy Setup**
   - Electron proxies preview requests through main process
   - Allows CORS and isolation
   - Captures console logs

3. **Live Reload**
   - File changes trigger Vite HMR
   - Preview updates automatically
   - No manual refresh needed (usually)

4. **Console Capture**
   - Injected script captures console.log, console.error
   - Sent via postMessage to parent
   - Displayed in Console panel

## Database Schema (SQLite)

```sql
-- Apps table
CREATE TABLE apps (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  createdAt TEXT,
  favorite INTEGER DEFAULT 0
);

-- Chats table
CREATE TABLE chats (
  id INTEGER PRIMARY KEY,
  appId INTEGER REFERENCES apps(id),
  title TEXT,
  createdAt TEXT
);

-- Messages table
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  chatId INTEGER REFERENCES chats(id),
  role TEXT CHECK(role IN ('user', 'assistant')),
  content TEXT,
  approvalState TEXT CHECK(approvalState IN ('approved', 'rejected', NULL)),
  createdAt TEXT
);

-- Settings stored as JSON
-- (selectedModel, providerSettings, etc.)
```

## File System Structure

```
~/dyad-apps/
├── my-first-app/
│   ├── .git/           # Git repository
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   ├── package.json
│   ├── vite.config.ts
│   └── ...
├── another-app/
│   └── ...
```

- Each app is a standalone directory
- Direct file system access (no cloud storage)
- Git-backed version control
- Full npm/package ecosystem

## Security Model

### Context Isolation

```javascript
// Renderer cannot access Node.js APIs directly
const fs = require('fs'); // ❌ Blocked

// Must use IPC
await window.electron.ipcRenderer.invoke('read-file', path); // ✅ Allowed
```

### Preload Allowlist

Only explicitly allowed IPC channels can be called from renderer:

```typescript
const ALLOWED_CHANNELS = [
  'create-app',
  'list-apps',
  'get-app',
  // ... 100+ channels
];
```

### Sandboxing

Renderer process is sandboxed by Chromium - cannot access:
- File system
- Native modules
- System APIs
- Environment variables

## Performance Characteristics

**Advantages:**
- **Fast IPC** - in-process communication (< 1ms latency)
- **Direct file access** - no network overhead
- **Native performance** - full Node.js capabilities
- **Offline-first** - works without internet (except LLM calls)

**Disadvantages:**
- **Large bundle size** - Electron + Chromium (~200MB)
- **Memory usage** - Multiple processes
- **Platform-specific builds** - separate binaries for Mac/Windows/Linux
- **No web deployment** - desktop only

## Key Dependencies

```json
{
  "electron": "^38.2.2",
  "better-sqlite3": "^11.7.0",
  "@tanstack/react-router": "^1.77.3",
  "jotai": "^2.10.3",
  "simple-git": "^3.27.0",
  "openai": "^4.73.0",
  "@anthropic-ai/sdk": "^0.32.1"
}
```

## Summary

The Electron architecture provided a robust desktop application with:

✅ **Full system access** - files, git, processes  
✅ **Fast local operations** - no network latency  
✅ **Rich integrations** - GitHub, Supabase, Docker  
✅ **Offline capability** - works without internet  
✅ **Native features** - menu bars, system tray, notifications

❌ **Desktop only** - no web/mobile  
❌ **Large downloads** - 200MB+ installers  
❌ **Complex builds** - platform-specific packaging  
❌ **IPC overhead** - architecture complexity

This architecture served well for a desktop-focused AI coding assistant.

---
