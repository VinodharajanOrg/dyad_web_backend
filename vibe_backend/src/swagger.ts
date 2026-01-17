import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dyad Backend API',
      version: '1.0.0',
      description: `REST API for Dyad - AI-powered application development platform
      
**Features:**
- App management (create, update, delete applications)
- Chat & message management with AI streaming
- Container orchestration (Docker/Podman/Tanzu/Kubernetes) for running apps
- File operations (read, write, delete)
- Git operations (init, clone, commit, push)
- User settings & AI model configuration
- Real-time streaming via Server-Sent Events (SSE)

**Documentation:**
- Full API docs: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Container integration: [CONTAINER.md](./CONTAINER.md)`,
      contact: {
        name: 'Dyad Team',
        url: 'https://github.com/dyad-sh/dyad',
      },
      license: {
        name: 'MIT',
        url: 'https://github.com/dyad-sh/dyad/blob/main/LICENSE',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' ? 'http://localhost' : 'http://localhost:3001',
        description: process.env.NODE_ENV === 'production' ? 'Production server (Nginx proxy)' : 'Development server',
      },
    ],
    tags: [
      { 
        name: 'Apps', 
        description: 'Application management - Create, read, update, delete applications with template scaffolding support',
      },
      { 
        name: 'Chats', 
        description: 'Chat and message management - Manage conversations, messages, and AI chat history',
      },
      { 
        name: 'Container', 
        description: 'Container orchestration - Docker/Podman/Kubernetes container lifecycle management with hot-reload support',
      },
      { 
        name: 'Files', 
        description: 'File system operations - Secure read, write, delete operations scoped to app directories',
      },
      { 
        name: 'Git', 
        description: 'Version control - Complete Git workflow (init, clone, commit, push, branch management)',
      },
      { 
        name: 'Settings', 
        description: 'User preferences - AI model selection, API key management, and feature flags',
      },
      { 
        name: 'Stream', 
        description: 'Real-time streaming - Server-Sent Events (SSE) for AI chat with file operations and container events',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT Bearer token in the format **Bearer &lt;token&gt;**',
        },
      },
      schemas: {
        App: {
          type: 'object',
          required: ['id', 'name', 'path'],
          properties: {
            id: { type: 'integer', description: 'Unique app identifier', example: 1 },
            name: { type: 'string', description: 'App name', example: 'my-react-app', minLength: 1 },
            path: { type: 'string', description: 'File system path (relative to APPS_BASE_DIR or absolute)', example: './apps/my-react-app' },
            template: { 
              type: 'string', 
              nullable: true,
              enum: ['vite-react-shadcn', 'blank'],
              example: 'vite-react-shadcn',
              description: 'Template used for app scaffolding (defaults to vite-react-shadcn)'
            },
            createdAt: { type: 'string', format: 'date-time', example: '2025-11-17T10:00:00Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2025-11-17T10:00:00Z' },
            githubOrg: { type: 'string', nullable: true, example: 'myorg', description: 'GitHub organization for imports' },
            githubRepo: { type: 'string', nullable: true, example: 'my-react-app', description: 'GitHub repository name' },
            githubBranch: { type: 'string', nullable: true, example: 'main', description: 'GitHub branch' },
            supabaseProjectId: { type: 'string', nullable: true, description: 'Supabase project ID for database integration' },
            neonProjectId: { type: 'string', nullable: true, description: 'Neon project ID for PostgreSQL' },
            vercelProjectId: { type: 'string', nullable: true, description: 'Vercel project ID for deployment' },
            installCommand: { 
              type: 'string', 
              nullable: true, 
              example: 'pnpm install',
              description: 'Command to install dependencies (overrides template default)'
            },
            startCommand: { 
              type: 'string', 
              nullable: true, 
              example: 'pnpm dev',
              description: 'Command to start dev server (overrides template default)'
            },
            chatContext: { 
              type: 'object', 
              nullable: true,
              description: 'Contextual information for AI chats (file structure, dependencies, etc.)'
            },
            isFavorite: { 
              type: 'boolean', 
              default: false, 
              example: false,
              description: 'Whether app is marked as favorite'
            },
          },
        },
        Chat: {
          type: 'object',
          required: ['id', 'appId'],
          properties: {
            id: { type: 'integer', description: 'Chat ID', example: 1 },
            appId: { type: 'integer', description: 'Associated app ID', example: 1 },
            title: { type: 'string', nullable: true, example: 'Create Express Server' },
            initialCommitHash: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time', example: '2025-11-17T10:00:00Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2025-11-17T10:00:00Z' },
          },
        },
        Message: {
          type: 'object',
          required: ['id', 'chatId', 'role', 'content'],
          properties: {
            id: { type: 'integer', example: 1 },
            chatId: { type: 'integer', example: 1 },
            role: { 
              type: 'string', 
              enum: ['user', 'assistant'],
              example: 'user',
              description: 'Message sender role',
            },
            content: { 
              type: 'string',
              example: 'Create a simple Express server with /hello endpoint',
              description: 'Message content',
            },
            model: { 
              type: 'string', 
              nullable: true,
              example: 'claude-3-5-sonnet-20241022',
              description: 'AI model used for generation',
            },
            isStreaming: { type: 'boolean', default: false },
            approvalState: { 
              type: 'string', 
              enum: ['approved', 'rejected'], 
              nullable: true,
            },
            sourceCommitHash: { type: 'string', nullable: true },
            commitHash: { type: 'string', nullable: true },
            requestId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time', example: '2025-11-17T10:00:00Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2025-11-17T10:00:00Z' },
          },
        },
        FileInfo: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'index.ts' },
            type: { type: 'string', enum: ['file', 'directory'], example: 'file' },
            size: { type: 'integer', example: 1024 },
            modifiedAt: { type: 'string', format: 'date-time' },
          },
        },
        FileStats: {
          type: 'object',
          properties: {
            size: { type: 'integer', example: 1024 },
            isFile: { type: 'boolean', example: true },
            isDirectory: { type: 'boolean', example: false },
            modifiedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        GitStatus: {
          type: 'object',
          properties: {
            branch: { type: 'string', example: 'main' },
            modified: { type: 'array', items: { type: 'string' }, example: ['src/index.ts'] },
            added: { type: 'array', items: { type: 'string' }, example: ['src/new-file.ts'] },
            deleted: { type: 'array', items: { type: 'string' }, example: [] },
            untracked: { type: 'array', items: { type: 'string' }, example: ['temp.txt'] },
          },
        },
        GitBranch: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'main' },
            current: { type: 'boolean', example: true },
          },
        },
        GitCommit: {
          type: 'object',
          properties: {
            sha: { type: 'string', example: 'abc123def456' },
            message: { type: 'string', example: 'Add authentication feature' },
            author: { type: 'string', example: 'John Doe' },
            date: { type: 'string', format: 'date-time' },
          },
        },
        Settings: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            userId: { type: 'string', example: 'user123' },
            selectedModel: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'claude-3-5-sonnet-20241022' },
                name: { type: 'string', example: 'Claude 3.5 Sonnet' },
                providerId: { type: 'string', example: 'anthropic' },
              },
            },
            apiKeys: { 
              type: 'object',
              additionalProperties: { type: 'string' },
              example: { openai: 'sk-proj...abc123', anthropic: 'sk-ant-...xyz789' },
            },
            selectedChatMode: {
              type: 'string',
              enum: ['auto-code', 'agent', 'ask', 'custom'],
              example: 'auto-code',
            },
            smartContextEnabled: { type: 'boolean', example: true },
            turboEditsV2Enabled: { type: 'boolean', example: false },
          },
        },
        ContainerConfig: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true, description: 'Whether containerization is enabled' },
            port: { type: 'integer', example: 32100, description: 'Default port for running containers' },
            nodeImage: { type: 'string', example: 'node:22-alpine', description: 'Container image for Node.js apps' },
          },
        },
        ContainerStatusLegacy: {
          type: 'object',
          description: 'Legacy container status (deprecated, use ContainerStatus)',
          properties: {
            appId: { type: 'string', example: '1', description: 'Application ID' },
            isRunning: { type: 'boolean', example: true, description: 'Whether container is currently running' },
            isReady: { type: 'boolean', example: true, description: 'Whether container is ready to serve requests' },
            hasDependenciesInstalled: { type: 'boolean', example: true, description: 'Whether dependencies are installed' },
            containerizationEnabled: { type: 'boolean', example: true, description: 'Whether containerization is enabled in config' },
            containerName: { type: 'string', nullable: true, example: 'dyad-app-1', description: 'Container name if running' },
            port: { type: 'integer', nullable: true, example: 32100, description: 'Port if container is running' },
          },
        },
        ContainerizationConfig: {
          type: 'object',
          description: 'Containerization factory configuration',
          properties: {
            enabled: { type: 'boolean', example: true, description: 'Enable/disable containerization' },
            engine: { 
              type: 'string', 
              enum: ['docker', 'podman', 'tanzu', 'kubernetes'],
              example: 'docker',
              description: 'Container engine to use'
            },
            docker: {
              type: 'object',
              properties: {
                socket: { type: 'string', example: '/var/run/docker.sock' },
                image: { type: 'string', example: 'node:22-alpine' },
                defaultPort: { type: 'integer', example: 32100 },
              },
            },
            podman: {
              type: 'object',
              properties: {
                socket: { type: 'string', example: '/run/user/1000/podman/podman.sock' },
                image: { type: 'string', example: 'node:22-alpine' },
                defaultPort: { type: 'integer', example: 32100 },
              },
            },
          },
        },
        ContainerStatus: {
          type: 'object',
          description: 'Detailed container status from containerization service',
          properties: {
            appId: { type: 'string', example: '123' },
            isRunning: { type: 'boolean', example: true },
            isReady: { type: 'boolean', example: true },
            hasDependenciesInstalled: { type: 'boolean', example: true },
            containerName: { type: 'string', nullable: true, example: 'dyad-app-123' },
            port: { type: 'integer', nullable: true, example: 32100 },
            status: { 
              type: 'string', 
              enum: ['running', 'stopped', 'starting', 'error'],
              example: 'running'
            },
            health: {
              type: 'string',
              enum: ['healthy', 'unhealthy', 'starting', 'none'],
              example: 'healthy'
            },
            uptime: { type: 'number', example: 3600, description: 'Container uptime in seconds' },
            error: { type: 'string', nullable: true, description: 'Error message if any' },
          },
        },
        StreamEvent: {
          type: 'object',
          description: 'Server-Sent Event for chat streaming',
          properties: {
            type: {
              type: 'string',
              enum: ['content', 'file_write', 'file_read', 'search_replace', 'container_restart', 'done', 'error'],
              example: 'content',
              description: 'Event type'
            },
            data: { type: 'string', description: 'Event data (JSON string or text content)' },
          },
        },
        Attachment: {
          type: 'object',
          description: 'File attachment for chat messages',
          properties: {
            name: { type: 'string', example: 'screenshot.png' },
            type: { type: 'string', example: 'image/png' },
            data: { type: 'string', description: 'Base64 encoded file data' },
            attachmentType: { type: 'string', enum: ['image', 'file'], example: 'image' },
          },
        },
        Template: {
          type: 'object',
          description: 'App template for scaffolding',
          properties: {
            id: { type: 'string', example: 'vite-react-shadcn' },
            name: { type: 'string', example: 'Vite + React + shadcn/ui' },
            description: { type: 'string', example: 'Modern React app with Vite, TypeScript, Tailwind CSS, and shadcn/ui components' },
            technologies: { 
              type: 'array', 
              items: { type: 'string' },
              example: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'shadcn/ui']
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Resource not found' },
            message: { type: 'string', example: 'Detailed error message' },
            statusCode: { type: 'integer', example: 404 },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad request - Invalid input parameters',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'appId query parameter is required' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'App not found' },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { 
                error: 'Internal server error',
                message: 'An unexpected error occurred',
              },
            },
          },
        },
      },
    },
  },
  // In production (Docker), compiled files are in dist/routes/*.js
  // In development, source files are in src/routes/*.ts
  apis: process.env.NODE_ENV === 'production' 
    ? ['./dist/routes/*.js']
    : ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
