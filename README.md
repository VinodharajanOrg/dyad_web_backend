# Dyad Backend Server

A standalone Express.js backend for Dyad, migrated from Electron IPC architecture to a web-based REST API with WebSocket support.

## 🚀 Features

- ✅ **PostgreSQL Database** - Using Drizzle ORM with postgres.js driver
- ✅ **REST API** - Express.js endpoints for apps, chats, files, and git operations
- ✅ **SSE Streaming** - Server-Sent Events for real-time AI responses
- ✅ **Docker Support** - Run generated apps in isolated containers (same as Dyad Desktop)
- ✅ **Git Integration** - isomorphic-git for version control
- ✅ **File Management** - Secure file operations with path traversal protection
- ✅ **Multi-AI Provider** - OpenAI, Anthropic, Google Gemini support
- ✅ **TypeScript** - Full type safety

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL 14+ with Drizzle ORM
- **WebSocket**: ws 8.14
- **Git**: isomorphic-git 1.25
- **TypeScript**: 5.3

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up PostgreSQL

See [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) for detailed PostgreSQL setup instructions.

**Quick version:**
```bash
# Create database
psql postgres -c "CREATE DATABASE dyad;"
psql postgres -c "CREATE USER dyad_user WITH PASSWORD 'your_password';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE dyad TO dyad_user;"
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://dyad_user:your_password@localhost:5432/dyad
PORT=3001
CORS_ORIGIN=http://localhost:5173
DATA_DIR=./data/apps
```

### 4. Initialize Database

```bash
# Push schema to PostgreSQL (quickest)
npm run db:push

# OR generate and run migrations
npm run db:generate
npm run db:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3001` ✨

## 📡 API Endpoints

### Apps
- `GET /api/apps` - List all apps
- `GET /api/apps/:id` - Get app by ID
- `POST /api/apps` - Create new app
- `PUT /api/apps/:id` - Update app
- `DELETE /api/apps/:id` - Delete app
- `POST /api/apps/:id/favorite` - Toggle favorite

### Chats
- `GET /api/chats?appId=xxx` - List chats for app
- `GET /api/chats/:id` - Get chat with messages
- `POST /api/chats` - Create new chat
- `DELETE /api/chats/:id` - Delete chat
- `POST /api/chats/:chatId/messages` - Create message
- `PUT /api/chats/:chatId/messages/:messageId` - Update message

### Files
- `GET /api/files/:appId?path=xxx` - List files in app
- `GET /api/files/:appId/read?path=xxx` - Read file
- `POST /api/files/:appId/write` - Write file
- `DELETE /api/files/:appId?path=xxx` - Delete file
- `POST /api/files/:appId/mkdir` - Create directory

### Git
- `POST /api/git/:appId/init` - Initialize git repo
- `POST /api/git/:appId/clone` - Clone repository
- `POST /api/git/:appId/add` - Stage files
- `POST /api/git/:appId/commit` - Create commit
- `GET /api/git/:appId/log` - Get commit history
- `GET /api/git/:appId/status` - Get git status
- `POST /api/git/:appId/checkout` - Checkout branch

### Docker
- `POST /api/apps/:appId/run` - Run app in Docker container
- `POST /api/apps/:appId/stop` - Stop Docker container
- `GET /api/apps/:appId/status` - Check if app is running
- `POST /api/apps/:appId/cleanup` - Remove Docker volumes
- `GET /api/docker/status` - Get Docker service status

### Streaming
- `POST /api/stream/chat` - SSE endpoint for AI responses
- `POST /api/stream/chat/:chatId/cancel` - Cancel active stream

## 🐳 Docker/Podman Integration

The backend supports running generated apps in containers (Docker or Podman), identical to Dyad Desktop.

### Quick Setup

**Basic configuration (.env):**
```env
CONTAINERIZATION_ENABLED=true
CONTAINERIZATION_ENGINE=podman  # or docker
PODMAN_IMAGE=node:22-bookworm-slim
CONTAINER_INACTIVITY_TIMEOUT=300000  # 5 minutes
```

### ⚡ Performance Optimization (Recommended)

For **95% faster container startup** (3-5s instead of 30-40s), build the optimized image:

```bash
# Build custom image with pre-cached dependencies (one-time, 3-5 min)
./scripts/build-optimized-image.sh

# Update .env to use optimized image
PODMAN_IMAGE=dyad-vite-dev:latest
```

**Performance comparison:**
- First start: **3-5s** (was 30-40s) ⚡
- Restart: **2-3s** (was 5-10s) ⚡
- Zero dependency installation for new apps!

### Documentation

- [Container Startup Optimization](./docs/CONTAINER_STARTUP_OPTIMIZATION.md) - Full optimization guide
- [Custom Image README](./docs/CUSTOM_IMAGE_README.md) - Pre-cached image details
- [Quick Start](./docs/CONTAINER_STARTUP_QUICKSTART.md) - Setup and testing
- [Container Auto-shutdown](./docs/CONTAINER_AUTO_SHUTDOWN.md) - Lifecycle management
- [Docker Integration](./docs/DOCKER.md) - Detailed Docker/Podman setup

### Test Container System
```bash
node test_docker.js
```

## 🗄️ Database Management

### Drizzle Studio (Visual Editor)
```bash
npm run db:studio
```
Opens at `https://local.drizzle.studio`

### Migrations
```bash
# Generate migration files from schema
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Push schema directly (dev only)
npm run db:push
```

### Migrate from SQLite

If you have existing SQLite data from the Electron app:

1. Install better-sqlite3 temporarily:
   ```bash
   npm install better-sqlite3
   ```

2. Edit `scripts/migrate-sqlite-to-postgres.ts`:
   - Update `SQLITE_PATH` to your SQLite database
   - Adjust field mappings to match your schema

3. Run migration:
   ```bash
   npx tsx scripts/migrate-sqlite-to-postgres.ts
   ```

4. Remove better-sqlite3:
   ```bash
   npm uninstall better-sqlite3
   ```

## 📁 Project Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── index.ts           # PostgreSQL connection
│   │   └── schema.ts          # Drizzle schema
│   ├── routes/
│   │   ├── app_routes.ts      # App CRUD endpoints
│   │   ├── chat_routes.ts     # Chat & message endpoints
│   │   ├── file_routes.ts     # File operations
│   │   └── git_routes.ts      # Git operations
│   ├── services/
│   │   ├── app_service.ts     # App business logic
│   │   ├── chat_service.ts    # Chat business logic
│   │   ├── file_service.ts    # File system operations
│   │   └── git_service.ts     # Git operations
│   ├── websocket/
│   │   └── index.ts           # WebSocket server
│   ├── middleware/
│   │   └── errorHandler.ts    # Error handling
│   └── index.ts               # Express app entry
├── scripts/
│   └── migrate-sqlite-to-postgres.ts
├── drizzle.config.ts          # Drizzle Kit config
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── POSTGRESQL_SETUP.md
```

## 🔧 Development

### Run Development Server
```bash
npm run dev
```
Uses `tsx watch` for hot reload

### Build for Production
```bash
npm run build
```
Outputs to `dist/`

### Run Production Build
```bash
npm start
```

### Type Check
```bash
npm run typecheck
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | **Required** |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:5173` |
| `DATA_DIR` | File storage directory | `./data/apps` |

## ⚠️ Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Error message",
  "statusCode": 400
}
```

Common status codes:
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## 🔒 Security

- ✅ CORS enabled for specified origin
- ✅ Path traversal protection in file operations
- ✅ SQL injection protection (Drizzle ORM)
- ✅ Foreign key constraints for data integrity
- ⚠️ No authentication yet (add as needed)

## 📝 Migration Notes

### SQLite → PostgreSQL Changes

1. **ID Generation**
   - Before: Manual UUID generation
   - After: PostgreSQL `serial` (auto-increment)

2. **Timestamps**
   - Before: Unix epoch integers
   - After: PostgreSQL `timestamp` with `Date` objects

3. **Booleans**
   - Before: Integer (0/1)
   - After: Native PostgreSQL `boolean`

4. **JSON Data**
   - Before: TEXT with JSON strings
   - After: `jsonb` for better querying

5. **Foreign Keys**
   - Before: No enforcement
   - After: Enforced with cascading deletes

### Electron IPC → REST API Mapping

| Electron IPC | Backend API |
|--------------|-------------|
| `app:list` | `GET /api/apps` |
| `app:create` | `POST /api/apps` |
| `chat:stream` | WebSocket event |
| `file:read` | `GET /api/files/:appId/read` |
| `git:commit` | `POST /api/git/:appId/commit` |

All business logic from `src/ipc/handlers/*` has been migrated to `src/services/*`.

## 🐛 Troubleshooting

### Cannot connect to PostgreSQL
- Check if PostgreSQL is running: `brew services list`
- Verify credentials in `.env`
- Test connection: `psql -U dyad_user -d dyad`

### Port already in use
Change `PORT` in `.env` or kill process:
```bash
lsof -ti:3001 | xargs kill -9
```

### Database schema out of sync
```bash
npm run db:push
```

### Drizzle Studio won't open
Make sure database is accessible and `DATABASE_URL` is correct.

## 🛣️ Roadmap

- ✅ Basic REST API for apps, chats, files, git
- ✅ WebSocket for real-time communication  
- ✅ PostgreSQL database with Drizzle ORM
- ⏳ Implement actual LLM streaming
- ⏳ Add process management for running apps
- ⏳ Add settings, providers, MCP routes
- ⏳ Add authentication (optional)
- ⏳ Add tests
- ⏳ Add Docker support

## 📄 License

Same as Dyad main project.
