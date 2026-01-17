# Next.js Migration Guide

---

## Overview

This document explains the new Next.js + separate backend architecture that replaced the Electron desktop app. The migration introduces a web-first platform with REST APIs.

**Important:** This repository contains only the **Next.js frontend**. The backend API server is maintained in a **separate repository** and must be run independently on port 3001.

## Repository Structure

- **This repo (dyad):** Next.js 16 frontend (port 3000)
- **Backend repo (separate):** Express.js API server (port 3001)
- **Migration status:** Ongoing - features are progressively being migrated from IPC stubs to REST API

## Architecture Comparison

### Old (Electron Desktop)

```
┌─────────────────────────────────────────────────────┐
│               Electron Application                   │
│                                                      │
│  ┌──────────────────┐      ┌────────────────────┐  │
│  │   Renderer       │      │   Main Process     │  │
│  │   (Chromium)     │◄────►│   (Node.js)        │  │
│  │                  │ IPC  │                    │  │
│  │  • React UI      │      │  • File System     │  │
│  │  • TanStack      │      │  • SQLite DB       │  │
│  │    Router        │      │  • Git Operations  │  │
│  │  • Jotai State   │      │  • LLM API Calls   │  │
│  └──────────────────┘      └────────────────────┘  │
│                                                      │
│  Single-user, local data, offline-capable           │
└─────────────────────────────────────────────────────┘
```

### New (Next.js + Backend)

```
┌──────────────────────────────────────────────────────────────────┐
│           THIS REPOSITORY (dyad - Frontend)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          Next.js Frontend (Port 3000)                    │    │
│  │                                                           │    │
│  │  • React 19 with App Router                              │    │
│  │  • TanStack Query (data fetching)                        │    │
│  │  • Jotai (state management)                              │    │
│  │  • REST API client (src/api/client.ts)                   │    │
│  │  • IPC stub (src/api/ipc_client.ts) for fallback        │    │
│  └─────────────────────┬────────────────────────────────────┘    │
│                        │ HTTP/REST (axios)                        │
│                        │ NEXT_PUBLIC_API_URL=                     │
│                        │ http://localhost:3001/api                │
└────────────────────────┴──────────────────────────────────────────┘
                         │
                         │
                         │
┌────────────────────────┴──────────────────────────────────────────┐
│        SEPARATE REPOSITORY (Backend)                              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │        Backend API Server (Port 3001)                    │    │
│  │                                                           │    │
│  │  • Express.js REST API                                   │    │
│  │  • JWT Authentication                                    │    │
│  │  • Server-Sent Events (SSE) for streaming               │    │
│  │  • Database ORM (implementation details in backend)     │    │
│  └─────────────┬──────────────────┬─────────────────────────┘    │
│                │                  │                               │
│                ▼                  ▼                               │
│  ┌──────────────────────┐  ┌─────────────────────┐              │
│  │  Database            │  │  File Storage       │              │
│  │  (backend impl)      │  │  (backend impl)     │              │
│  └──────────────────────┘  └─────────────────────┘              │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Note:** Database and file storage implementation details are in the backend repository.

---

## Frontend: Next.js 15 App Router

### Project Structure

```
src/
├── app/                      # Next.js App Router (file-based routing)
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Home page (redirects to /home)
│   ├── (auth)/              # Auth route group
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── home/                # Main app pages
│   │   ├── page.tsx         # App list
│   │   └── [id]/page.tsx    # App details (dynamic route)
│   ├── chat/page.tsx        # Chat interface
│   ├── settings/page.tsx    # Settings
│   └── api/                 # API routes (if needed for SSR)
│       └── auth/callback/route.ts
│
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── chat/                # Chat-specific components
│   ├── apps/                # App-specific components
│   └── layout/              # Layout components
│
├── hooks/                   # Custom React hooks
│   ├── useStreamChat.ts     # SSE chat streaming
│   ├── useApps.ts           # App CRUD operations
│   ├── useChats.ts          # Chat operations
│   └── useSettings.ts       # Settings operations
│
├── api/                     # Backend API client
│   ├── client.ts            # Base ApiClient class
│   └── endpoints/           # API endpoint modules
│       ├── auth.ts
│       ├── apps.ts
│       ├── chats.ts
│       ├── prompts.ts
│       ├── settings.ts
│       └── language-models.ts
│
├── lib/                     # Utilities
│   ├── atoms.ts             # Jotai atoms
│   ├── utils.ts             # Helper functions
│   └── constants.ts         # Constants
│
└── types/                   # TypeScript types
    ├── ipc_types.ts         # Legacy types (stubs)
    └── api_types.ts         # API request/response types
```

### Key Next.js Features Used

#### 1. App Router (File-Based Routing)

**Before (TanStack Router):**
```typescript
// src/router.ts
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

const rootRoute = createRootRoute({ component: Root });
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/home',
  component: HomePage
});

const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute]) });
```

**After (Next.js App Router):**
```typescript
// src/app/home/page.tsx
export default function HomePage() {
  return <div>Home Page</div>;
}

// Routing is automatic based on file structure:
// /home → src/app/home/page.tsx
// /home/123 → src/app/home/[id]/page.tsx
// /chat?id=456 → src/app/chat/page.tsx
```

#### 2. Server Components & Client Components

```typescript
// src/app/layout.tsx - Server Component (default)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Runs on server, can fetch data securely
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// src/components/chat/ChatInput.tsx - Client Component
'use client';  // Explicit directive required

import { useState } from 'react';

export function ChatInput() {
  const [message, setMessage] = useState('');
  // Uses hooks, event handlers - must be client component
  return <input value={message} onChange={(e) => setMessage(e.target.value)} />;
}
```

#### 3. Authentication via Backend (Keycloak SSO)

The frontend doesn't have Next.js middleware for auth. Instead, authentication is handled entirely by the backend:

```typescript
// src/page-components/login.tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function LoginPage() {
  const handleSSOLogin = () => {
    // Redirect to backend SSO login - backend handles Keycloak and sets session cookie
    window.location.href = `${API_URL}/auth/login`;
  };
  // ...
}
```

**Backend Authentication Flow:**
1. User clicks "Login with SSO"
2. Frontend redirects to `${API_URL}/auth/login`
3. Backend redirects to Keycloak for authentication
4. After Keycloak auth, backend sets cookies:
   - `accessToken` - JWT access token
   - `refreshToken` - JWT refresh token
   - `expiresAt` - Token expiration duration
   - (or single `session` cookie with all data)
5. Backend redirects back to frontend
6. Frontend's `ApiClient` automatically reads cookies and attaches tokens to requests

```typescript
// src/api/client.ts - Automatically restores tokens from cookies
class ApiClient {
  private restoreTokensFromCookies(): void {
    // Reads accessToken, refreshToken, expiresAt from cookies
    let accessToken = this.getCookie("accessToken");
    let refreshToken = this.getCookie("refreshToken");
    let expiresAt = this.getCookie("expiresAt");
    
    // Also supports legacy session cookie format
    const cookieSession = this.getCookie("session");
    if (cookieSession && !accessToken) {
      const sessionObj = JSON.parse(cookieSession);
      accessToken = sessionObj.accessToken;
      refreshToken = sessionObj.refreshToken;
      expiresAt = sessionObj.expiresAt;
    }
    
    if (accessToken && refreshToken && expiresAt) {
      this.setTokens(accessToken, refreshToken, durationSeconds);
    }
  }
}
```

**Note:** No Next.js middleware is used. Authentication is stateless via JWT tokens in cookies, managed by the backend.

#### 4. Dynamic Routes

```typescript
// src/app/home/[id]/page.tsx
interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function AppDetailsPage({ params }: PageProps) {
  const appId = params.id;  // From URL: /home/abc-123
  
  return <AppDetails appId={appId} />;
}
```

---

## Backend: Express.js REST API

**Note:** The backend is maintained in a **separate repository**. This section provides an overview of the backend architecture for context. For detailed implementation, refer to the backend repository.

### Communication

- **Base URL:** `http://localhost:3001/api` (configured in `.env.local`)
- **Protocol:** REST API over HTTP
- **Streaming:** Server-Sent Events (SSE) for chat responses
- **Authentication:** JWT tokens in Authorization headers

### Technology Stack (Backend Repo)

- **Framework:** Express.js (Node.js)
- **Authentication:** JWT tokens
- **Validation:** Request validation (implementation in backend)
- **Streaming:** Server-Sent Events (SSE)
- **Database & File Storage:** Implementation details in backend repository

### REST API Endpoints (Backend)

The backend exposes REST APIs that the frontend consumes. Key endpoint categories:

#### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login, returns JWT tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

#### Apps
- `GET /api/apps` - List user's apps
- `POST /api/apps` - Create new app
- `GET /api/apps/:id` - Get app details
- `PATCH /api/apps/:id` - Update app
- `DELETE /api/apps/:id` - Delete app

#### Chats
- `GET /api/chats` - List chats for app
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get chat with messages
- `DELETE /api/chats/:id` - Delete chat
- `POST /api/chats/:id/stream` - Stream chat (SSE)

#### Files, Settings, Language Models, Prompts, MCP Servers
- See `src/api/endpoints/` for all frontend API client modules

### Hybrid Architecture: IPC Stubs + REST API

During the migration, the frontend uses a **hybrid approach**:

```typescript
// src/api/ipc_client.ts - Stub for features not yet migrated
export class IpcClient {
  public static getInstance(): IpcClient | null {
    return null;  // Returns null in web mode
  }
  
  async getUserBudget(): Promise<any> {
    throw new Error("IPC not available in web mode");
  }
  
  // ... other stub methods
}
```

Many hooks check for IPC availability and fall back gracefully:

```typescript
// Example from src/hooks/useSettings.ts
const ipcClient = IpcClient.getInstance();
if (!ipcClient) {
  // Use REST API instead
  return settingsApi.getUserSettings();
}
// Legacy IPC path (not used in web)
return (ipcClient as any).getUserSettings();
```

This allows:
- Frontend to run in web mode (IPC always returns `null`)
- Progressive migration of features to REST API
- Graceful degradation for features not yet migrated

---

## Frontend Implementation Examples

### REST API Client

The frontend communicates with the backend using axios-based API client:
```typescript
// src/api/endpoints/apps.ts
import { apiClient } from '../client';

export interface CreateAppParams {
  name: string;
  type: string;
  description?: string;
  path: string;
}

export interface App {
  id: string;
  userId: string;
  name: string;
  type: string;
  description?: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export const appsApi = {
  list: async (): Promise<{ apps: App[] }> => {
    return apiClient.get<{ apps: App[] }>('/apps');
  },
  
  create: async (params: CreateAppParams): Promise<App> => {
    return apiClient.post<App>('/apps', params);
  },
  
  getById: async (id: string): Promise<App> => {
    return apiClient.get<App>(`/apps/${id}`);
  },
  
  update: async (id: string, params: Partial<App>): Promise<App> => {
    return apiClient.patch<App>(`/apps/${id}`, params);
  },
  
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/apps/${id}`);
  }
};
```

#### React Hook with TanStack Query
```typescript
// src/hooks/useApps.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appsApi } from '@/api/endpoints/apps';

export const appsKeys = {
  all: ['apps'] as const,
  lists: () => [...appsKeys.all, 'list'] as const,
  list: (filters?: any) => [...appsKeys.lists(), filters] as const,
  details: () => [...appsKeys.all, 'detail'] as const,
  detail: (id: string) => [...appsKeys.details(), id] as const,
};

export function useApps() {
  return useQuery({
    queryKey: appsKeys.lists(),
    queryFn: async () => {
      const result = await appsApi.list();
      return result.apps;
    }
  });
}

export function useCreateApp() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: appsApi.create,
    onSuccess: () => {
      // Invalidate apps list to trigger refetch
      queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
    }
  });
}

export function useAppById(id: string) {
  return useQuery({
    queryKey: appsKeys.detail(id),
    queryFn: () => appsApi.getById(id),
    enabled: !!id
  });
}
```

#### Usage in Component
```typescript
// src/app/home/page.tsx
'use client';

import { useApps, useCreateApp } from '@/hooks/useApps';

export default function HomePage() {
  const { data: apps, isLoading, error } = useApps();
  const createApp = useCreateApp();
  
  const handleCreate = () => {
    createApp.mutate({
      name: 'My New App',
      type: 'nextjs',
      path: '/apps/my-new-app'
    });
  };
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <button onClick={handleCreate}>Create App</button>
      <ul>
        {apps?.map((app) => (
          <li key={app.id}>{app.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Real-Time Streaming: Server-Sent Events (SSE)

### Why SSE vs WebSocket?

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| **Direction** | Server → Client only | Bi-directional |
| **Protocol** | HTTP | WebSocket (ws://) |
| **Reconnect** | Automatic | Manual |
| **Use Case** | LLM streaming, notifications | Real-time chat, games |

For LLM streaming, SSE is simpler and sufficient (server only sends, client doesn't need to send during stream).

### SSE Implementation

#### Backend: Streaming Endpoint
```typescript
// backend/src/routes/chats.routes.ts
import { Router } from 'express';
import { streamChat } from '../services/llm.service';

const router = Router();

router.post('/chats/:chatId/stream', async (req, res) => {
  const { chatId } = req.params;
  const { messages, model, temperature } = req.body;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Disable nginx buffering
  
  try {
    // Stream from OpenAI or other LLM provider
    const stream = await openai.chat.completions.create({
      model: model || 'gpt-4',
      messages,
      temperature: temperature || 0.7,
      stream: true
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      
      if (content) {
        // Send SSE message
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          chatId,
          content
        })}\n\n`);
      }
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'done',
      chatId
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

export default router;
```

#### Frontend: SSE Client
```typescript
// src/hooks/useStreamChat.ts
import { useState, useCallback } from 'react';
import { apiClient } from '@/api/client';

export function useStreamChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  
  const streamMessage = useCallback(async (
    chatId: string,
    messages: Message[],
    onChunk: (content: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ) => {
    setIsStreaming(true);
    setStreamingChatId(chatId);
    
    try {
      // Get streaming URL with auth token
      const token = apiClient.getAccessToken();
      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const url = `${baseURL}/api/chats/${chatId}/stream?token=${token}`;
      
      // Create EventSource
      const eventSource = new EventSource(url);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'chunk':
            onChunk(data.content);
            break;
            
          case 'done':
            eventSource.close();
            setIsStreaming(false);
            setStreamingChatId(null);
            onComplete();
            break;
            
          case 'error':
            eventSource.close();
            setIsStreaming(false);
            setStreamingChatId(null);
            onError(new Error(data.error));
            break;
        }
      };
      
      eventSource.onerror = (error) => {
        eventSource.close();
        setIsStreaming(false);
        setStreamingChatId(null);
        onError(new Error('Stream connection error'));
      };
      
      // Return cleanup function
      return () => {
        eventSource.close();
        setIsStreaming(false);
        setStreamingChatId(null);
      };
      
    } catch (error) {
      setIsStreaming(false);
      setStreamingChatId(null);
      onError(error as Error);
    }
  }, []);
  
  return {
    streamMessage,
    isStreaming,
    streamingChatId
  };
}
```

#### Usage in Chat Component
```typescript
// src/components/chat/ChatInterface.tsx
'use client';

import { useState } from 'react';
import { useStreamChat } from '@/hooks/useStreamChat';

export function ChatInterface({ chatId }: { chatId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const { streamMessage, isStreaming } = useStreamChat();
  
  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMessage]);
    
    // Create assistant message placeholder
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, assistantMessage]);
    
    // Stream response
    await streamMessage(
      chatId,
      [...messages, userMessage],
      // onChunk
      (chunk) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      // onComplete
      () => {
        console.log('Stream complete');
      },
      // onError
      (error) => {
        console.error('Stream error:', error);
      }
    );
  };
  
  return (
    <div>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      
      <input
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isStreaming) {
            handleSendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        disabled={isStreaming}
        placeholder="Type a message..."
      />
    </div>
  );
}
```

---

## Database & Storage (Backend)

**Note:** Database and storage implementation is in the backend repository. This section is for reference only.

The backend handles:
- **Database:** User data, apps, chats, messages, settings
- **File Storage:** App files, uploaded attachments
- **Authentication:** User sessions, JWT tokens

For implementation details, refer to the backend repository.

---

## Authentication: JWT Tokens (Frontend)

### Flow

```
1. User registers/logs in
   ↓
2. Backend generates JWT tokens:
   - Access token (15 min expiry)
   - Refresh token call before Access token expires
   ↓
3. Frontend stores tokens:
   - Access token in memory (or cookie)
   - Refresh token in httpOnly cookie
   ↓
4. Frontend attaches access token to requests:
   Authorization: Bearer <access_token>
   ↓
5. Backend middleware verifies token
   ↓
6. If expired, frontend uses refresh token
   ↓
7. Backend issues new access token
```

### Implementation

#### Backend: Token Generation
```typescript
// backend/src/utils/jwt.ts
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

export function generateAccessToken(userId: number, email: string): string {
  return jwt.sign(
    { userId, email },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );
}

export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { userId },
    REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAccessToken(token: string): { userId: number; email: string } {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as { userId: number; email: string };
}
```

#### Backend: Auth Middleware
```typescript
// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;  // Attach user to request
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

#### Frontend: API Client with Token Management
```typescript
// src/api/client.ts
import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
      timeout: 30000
    });
    
    // Add auth header to requests
    this.axiosInstance.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
    
    // Handle 401 errors (token expired)
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          const newToken = await this.refreshAccessToken();
          if (newToken) {
            // Retry original request with new token
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return this.axiosInstance.request(error.config);
          } else {
            // Redirect to login
            window.location.href = '/login';
          }
        }
        throw error;
      }
    );
  }
  
  setAccessToken(token: string) {
    this.accessToken = token;
  }
  
  getAccessToken(): string | null {
    return this.accessToken;
  }
  
  private async refreshAccessToken(): Promise<string | null> {
    try {
      const response = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true  // Send httpOnly cookie
      });
      const newToken = response.data.data.accessToken;
      this.setAccessToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }
  
  async get<T>(url: string): Promise<T> {
    const response = await this.axiosInstance.get(url);
    return response.data.data;
  }
  
  async post<T>(url: string, data: any): Promise<T> {
    const response = await this.axiosInstance.post(url, data);
    return response.data.data;
  }
}

export const apiClient = new ApiClient();
```

---

## Deployment

**Note:** Deployment configuration is in the backend repository. The frontend (this repo) is a standard Next.js application.

### Frontend Deployment

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start

# Frontend runs on: http://localhost:3000
```

### Environment Configuration

```bash
# env.local (frontend)
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://localhost:3001/api  # Backend API URL
```

For backend deployment details, refer to the backend repository.

---

## Dependencies (Frontend)

### Current package.json

This repository uses:

```json
{
  "dependencies": {
    "next": "^16.1.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.90.10",
    "axios": "^1.13.2",
    "jotai": "^2.12.2",
    "zod": "^4.1.13",
    // ... see package.json for full list
  },
  "devDependencies": {
    "@types/node": "^22.19.1",
    "@types/react": "^19.2.7",
    "typescript": "^5.8.3",
    "prettier": "^3.6.2",
    "playwright": "^1.52.0",
    "vitest": "^4.0.13"
  }
}
```

Key additions for web migration:
- `axios` - HTTP client for REST API calls
- `@tanstack/react-query` - Data fetching and caching
- `next` - React framework with App Router
- No Electron dependencies

---

## Migration Summary

### What Changed

| Aspect | Electron | Next.js + Backend |
|--------|----------|-------------------|
| **Architecture** | Desktop app, 2 processes | Web app + API server (separate repos) |
| **Communication** | IPC (invoke/send) | REST API + SSE (axios) |
| **Routing** | TanStack Router | Next.js App Router |
| **Deployment** | Platform builds (dmg, exe) | Standard Next.js deployment |
| **Updates** | Auto-updater | Git pull + redeploy |
| **Bundle Size** | ~200MB | ~2MB (97% smaller) |

### Benefits

✅ **Web-first** - Deploy to Vercel, Netlify, or any Node.js host  
✅ **Smaller bundle** - 2MB vs 200MB (97% reduction)  
✅ **Standard stack** - No Electron-specific knowledge needed  
✅ **Easier updates** - Git-based deployment  
✅ **Better DX** - Next.js Fast Refresh, browser DevTools  
✅ **Simpler** - Standard HTTP instead of IPC  
✅ **Smaller bundle** - 2MB vs 200MB  
✅ **Better DX** - Hot reload, browser DevTools  

### Trade-offs

⚠️ **Backend required** - Can't run offline  
⚠️ **Network latency** - HTTP overhead vs IPC  
⚠️ **Complex deployment** - Must manage database, storage  
⚠️ **Auth overhead** - JWT management, CORS  

---

## End-to-End Flow: Chat Streaming (New)

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. FRONTEND (Next.js)                                           │
│     • User types message in ChatInput.tsx                        │
│     • Calls useStreamChat hook                                   │
│     • Hook creates EventSource for SSE                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌─────────────────────────────────────────────────────────────────┐
│  2. BACKEND API (Express)                                        │
│     • POST /api/chats/:chatId/stream                             │
│     • Auth middleware verifies JWT token                         │
│     • Controller receives { messages, model }                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. LLM SERVICE                                                  │
│     • Calls OpenAI/Anthropic API with stream: true               │
│     • Receives streaming chunks                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. STREAM RESPONSE (SSE)                                        │
│     • For each chunk:                                            │
│       res.write(`data: {"content": "..."}\n\n`)                  │
│     • On complete:                                               │
│       res.write(`data: {"type": "done"}\n\n`)                    │
│     • On error:                                                  │
│       res.write(`data: {"type": "error"}\n\n`)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ SSE events
┌─────────────────────────────────────────────────────────────────┐
│  5. FRONTEND UPDATE                                              │
│     • EventSource.onmessage receives chunks                      │
│     • Updates message state: content += chunk                    │
│     • React re-renders with new content                          │
│     • User sees response appear word-by-word                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. PERSISTENCE (Backend)                                        │
│     • On stream complete, save message to database               │
│     • TanStack Query invalidates cache                           │
│     • UI shows final saved message                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

The migration to Next.js + separate backend architecture transforms Dyad from a desktop app to a web-first platform. Key improvements include:

### Frontend (This Repository)
- **Next.js 16** - Modern React framework with App Router
- **Standard web stack** - No Electron-specific code
- **97% smaller bundle** - 2MB vs 200MB
- **Better DX** - Fast Refresh, browser DevTools, hot reload
- **Easier deployment** - Standard Next.js hosting

### Architecture Benefits
- **Web-first** - Deploy to any Next.js-compatible host
- **Easier updates** - Git-based deployment, no app reinstalls
- **Standard HTTP** - REST API + SSE streaming replace IPC
- **Hybrid migration** - IPC stubs allow progressive feature migration

### Migration Status
This repository contains the frontend only. The backend (database, file storage, authentication) is in a separate repository. The frontend uses:
- REST API client (`src/api/client.ts`) for migrated features
- IPC stub (`src/api/ipc_client.ts`) for graceful fallbacks
- Hybrid hooks that check for IPC availability and adapt

---
