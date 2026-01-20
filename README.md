# Vibe Mastercard - AI App Builder Platform

A unified, containerized deployment of the Vibe Mastercard AI application platform. This setup includes a Next.js frontend, Express backend, and Nginx reverse proxy, all orchestrated with Docker for easy deployment and management.

## Quick Start with Docker

You can get the entire application stack running in about 5 minutes. Here's how:

```bash
# 1. Clone the repository
git clone <repository-url>
cd github

# 2. Set your server IP address (use your actual server IP)
export SERVER_IP="10.157.150.207"  # Replace with your server IP

# 3. Generate SSL certificates
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Mastercard/CN=${SERVER_IP}"

# Set proper permissions for SSL certificates
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem

# 4. Configure environment files
cp vibe_backend/env.example vibe_backend/.env
cp vibe_frontend/env.local vibe_frontend/.env.local

# Edit .env files and replace localhost with your SERVER_IP
sed -i.bak "s/localhost/${SERVER_IP}/g" vibe_backend/.env
sed -i.bak "s/localhost/${SERVER_IP}/g" vibe_frontend/.env.local

# 5. Start all services with Docker Compose
docker-compose up -d

# 6. Access the application
# Frontend: https://${SERVER_IP}
# API Docs: https://${SERVER_IP}/api-docs

# 7. Login to the application
# Username: vibe-admin
# Password: vibe-admin
```

The application should now be running and accessible.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          Client Browser                      │
│                 (https://<SERVER_IP>:443)                    │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ HTTPS (SSL/TLS)
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                      Nginx Reverse Proxy                     │
│                        (Port 80/443)                         │
│                                                              │
│  Routes:                                                     │
│  ┌──────────────────────────────────────────────────┐        │
│  │ /          → Frontend (Next.js)                  │        │
│  │ /api/*     → Backend (Express)                   │        │
│  │ /api-docs  → Swagger API Documentation           │        │
│  │ /health    → Health Check Endpoint               │        │
│  └──────────────────────────────────────────────────┘        │
└───────────────────┬────────────────────┬─────────────────────┘
                    │                    │
        ┌───────────┘                    └───────────┐
        │                                            │
┌───────▼─────────┐                        ┌─────────▼──────────┐
│  Frontend       │                        │  Backend           │
│  Container      │                        │  Container         │
│  Next.js:3000   │                        │  Express:3001      │
│                 │                        │                    │
│  • React UI     │                        │  • REST API        │
│  • SSR/SSG      │                        │  • Docker Engine   │
│  • Keycloak Auth│                        │  • Container Mgmt  │
│  • Responsive   │                        │  • PostgreSQL      │
└─────────────────┘                        └────────────────────┘
                                           
```

### Component Overview

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| **Nginx** | Nginx Alpine | 80, 443 | Reverse proxy, SSL termination, routing |
| **Frontend** | Next.js 15 | 3000 | React-based UI application |
| **Backend** | Express + Node.js 20 | 3001 | REST API, WebSocket, container orchestration |
| **Database** | PostgreSQL | 5432 | Application data storage |
| **Auth** | Keycloak | External | Identity and access management |

## Prerequisites

### Required Software

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+ (included with Docker Desktop)
- **Git**: For cloning the repository

### Network Ports

Ensure these ports are available:
- `80` - HTTP (redirects to HTTPS)
- `443` - HTTPS
- `3000` - Frontend (internal)
- `3001` - Backend (internal)

## Docker Deployment

### Complete Setup Guide

#### Step 1: Generate SSL Certificates

```bash
# Create SSL directory
mkdir -p ssl

# Set your server IP
export SERVER_IP="10.157.150.207"  # Replace with your actual server IP

# Generate self-signed certificates (for development)
cd ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Mastercard/CN=${SERVER_IP}"

# Set proper permissions for SSL certificates
chmod 600 key.pem
chmod 644 cert.pem
cd ..
```

#### Step 2: Configure Environment Variables

**Backend Configuration** (`vibe_backend/.env`):

```bash
# Copy example file
cp vibe_backend/env.example vibe_backend/.env

# Edit configuration
nano vibe_backend/.env
```

Key configurations (replace `<SERVER_IP>` with your actual server IP):
```env
# Server
PORT=3001
NODE_ENV=production
USE_HTTPS=false  # Nginx handles SSL

# Database
DATABASE_URL=postgresql://user:password@host.docker.internal:5432/vibe-db

# Authentication (Keycloak)
AUTH_PROVIDER=keycloak
AUTH_ISSUER_URL=https://10.157.147.235/realms/vibe-web
AUTH_CLIENT_ID=vibe-backend
AUTH_CLIENT_SECRET=your-client-secret
AUTH_REDIRECT_URI=https://<SERVER_IP>/api/auth/callback

# Frontend URL
FRONTEND_URL=https://<SERVER_IP>

# Containerization
CONTAINERIZATION_ENABLED=true
CONTAINERIZATION_ENGINE=docker
DOCKER_NETWORK=vibe-network

# GitHub OAuth Configuration (for Git integration)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=https://<SERVER_IP>/api/auth/git/callback
GIT_TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key
```

**Frontend Configuration** (`vibe_frontend/.env.local`):

```bash
# Copy example file
cp vibe_frontend/env.local vibe_frontend/.env.local

# Edit configuration
nano vibe_frontend/.env.local
```

Key configurations (replace `<SERVER_IP>` with your actual server IP):
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://<SERVER_IP>/api
NEXT_PUBLIC_WS_URL=wss://<SERVER_IP>/api

# Keycloak
NEXT_PUBLIC_KEYCLOAK_URL=https://10.157.147.235
NEXT_PUBLIC_KEYCLOAK_REALM=vibe-web
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=vibe-mastercard-frontend

# Features
NEXT_PUBLIC_ENABLE_AUTH=true
```

#### Step 3: Build and Start Services

```bash
# Build all containers
docker-compose build

# Start in detached mode
docker-compose up -d

# Or start with logs visible
docker-compose up
```

#### Step 4: Verify Deployment

```bash
# Check container status
docker-compose ps

# Check health endpoints (replace <SERVER_IP> with your actual IP)
curl -k https://<SERVER_IP>/health
curl -k https://<SERVER_IP>/api/health

# View logs
docker-compose logs -f
```

#### Step 5: Login to Application

Once the application is running, access it at `https://<SERVER_IP>` and login with:

**Default Admin Credentials:**
- **Username**: `vibe-admin`
- **Password**: `vibe-admin`

**Note**: For production deployments, change these credentials immediately after first login.

### Docker Compose Services

The `docker-compose.yml` defines three main services:

```yaml
services:
  backend:      # Express API server
  frontend:     # Next.js application
  nginx:        # Reverse proxy
```

All services are connected via the `vibe-network` bridge network.

## Configuration

### Environment Files

| File | Purpose | Required |
|------|---------|----------|
| `vibe_backend/.env` | Backend configuration | Yes |
| `vibe_frontend/.env.local` | Frontend configuration | Yes |
| `nginx/nginx.conf` | Nginx routing rules | Yes (auto-created) |

### SSL Certificates

Place certificates in the `ssl/` directory:
- `ssl/cert.pem` - SSL certificate
- `ssl/key.pem` - Private key

All services share these certificates via Docker volumes.

### Database Setup

The backend requires PostgreSQL. Options:

1. **External Database** (Recommended for production):
   ```env
   DATABASE_URL=postgresql://user:pass@remote-host:5432/vibe-db
   ```

2. **Local Docker Database**:
   ```env
   DATABASE_URL=postgresql://user:pass@host.docker.internal:5432/vibe-db
   ```

Run migrations after first setup:
```bash
docker-compose exec backend npm run migrate
```

### AI Provider Configuration

Configure AI providers through the UI or environment variables:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=...

# Azure Foundry
AZURE_FOUNDRY_API_KEY=...
CUSTOM_API_ENDPOINT=https://...
```

See [AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md) for detailed setup.

### GitHub Integration Configuration

The platform supports GitHub OAuth for repository integration. To enable this feature:

1. **Create a GitHub OAuth App:**
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Set Application name: `Vibe Mastercard`
   - Set Homepage URL: `https://<SERVER_IP>`
   - Set Authorization callback URL: `https://<SERVER_IP>/api/auth/git/callback`
   - Note the Client ID and generate a Client Secret

2. **Configure Backend Environment Variables:**
   ```env
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   GITHUB_REDIRECT_URI=https://<SERVER_IP>/api/auth/git/callback
   GIT_TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key
   ```

3. **Generate Encryption Key:**
   ```bash
   # Generate a secure 32-character key
   openssl rand -base64 32 | head -c 32
   ```

This enables users to authenticate with GitHub and access their repositories within the platform.

## Management

### Docker Compose Commands

```bash
# View running containers
docker-compose ps

# View logs (follow mode)
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart a specific service
docker-compose restart backend

# Execute command in container
docker-compose exec backend npm run migrate
docker-compose exec backend sh

# Rebuild specific service
docker-compose build --no-cache backend

# Scale services (if configured)
docker-compose up -d --scale backend=2
```

### Health Checks

All services have built-in health checks:

```bash
# Replace <SERVER_IP> with your actual server IP

# Nginx health
curl -k https://<SERVER_IP>/health

# Backend health
curl -k https://<SERVER_IP>/api/health

# Frontend health (internal)
docker-compose exec frontend wget -q -O- http://localhost:3000/api/health
```

## Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production deployment guide
- **[KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md)** - Keycloak authentication setup
- **[AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md)** - AI provider configuration

### Component Documentation

- **[vibe_backend/README.md](./vibe_backend/README.md)** - Backend API documentation
- **[vibe_frontend/README.md](./vibe_frontend/README.md)** - Frontend application documentation


## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check port conflicts
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :3000
sudo lsof -i :3001

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### 502 Bad Gateway

This means backend/frontend isn't ready:

```bash
# Check service health
docker-compose ps

# Wait for all services to be healthy
docker-compose logs -f backend
docker-compose logs -f frontend

# Check backend directly
curl http://localhost:3001/health
```

#### SSL Certificate Errors

```bash
# Verify certificates exist
ls -la ssl/

# Regenerate certificates (replace with your server IP)
export SERVER_IP="10.157.150.207"
cd ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Mastercard/CN=${SERVER_IP}"

# Set proper permissions
chmod 600 key.pem
chmod 644 cert.pem
cd ..

# Restart nginx
docker-compose restart nginx
```

#### Database Connection Failed

```bash
# Check DATABASE_URL
docker-compose exec backend env | grep DATABASE_URL

# Test database connectivity
docker-compose exec backend psql $DATABASE_URL

# For host.docker.internal issues on Linux:
# Add to docker-compose.yml under backend service:
extra_hosts:
  - "host.docker.internal:host-gateway"
```

#### Container Build Fails

```bash
# Clear Docker cache
docker system prune -a

# Remove all containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

#### Port Already in Use

```bash
# Find process using port
sudo lsof -i :443
sudo lsof -i :80

# Kill process (example)
sudo kill -9 <PID>

# Or change ports in docker-compose.yml
ports:
  - "8080:80"
  - "8443:443"
```

### Debug Mode

Enable verbose logging:

```bash
# Backend debug logs
# Edit vibe_backend/.env
LOG_LEVEL=debug
LOG_FORMAT=console

# Restart services
docker-compose restart backend

# View debug logs
docker-compose logs -f backend
```

### Getting Help

1. **Check logs first**: `docker-compose logs -f`
2. **Review documentation**: See files above
3. **Check service health**: `docker-compose ps` and health endpoints
4. **Verify configuration**: Ensure .env files are correct
5. **Network connectivity**: Test connections between services

## Access URLs

After successful deployment (replace `<SERVER_IP>` with your actual server IP):

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | https://&lt;SERVER_IP&gt; | Main application UI |
| **Backend API** | https://&lt;SERVER_IP&gt;/api | REST API endpoints |
| **API Documentation** | https://&lt;SERVER_IP&gt;/api-docs | Swagger/OpenAPI docs |
| **Health Check** | https://&lt;SERVER_IP&gt;/health | System health status |
| **Keycloak** | https://10.157.147.235 | Authentication server |

**Example for server at 10.157.150.207:**
- Frontend: https://10.157.150.207
- API: https://10.157.150.207/api
- API Docs: https://10.157.150.207/api-docs

## Monitoring

### Service Status

```bash
# Check container status
docker-compose ps

# Detailed container info
docker stats
```

### Logs

```bash
# Stream all logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Logs since timestamp
docker-compose logs --since 2026-01-20T10:00:00
```

### Metrics

Access metrics endpoints:
- Backend: `https://localhost/api/health`
- Nginx: Check `logs/nginx/access.log`

## Updates and Maintenance

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Run migrations if needed
docker-compose exec backend npm run migrate
```

### Backup

```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Backup configuration
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
  vibe_backend/.env \
  vibe_frontend/.env.local \
  ssl/

# Backup application data
tar -czf data_backup_$(date +%Y%m%d).tar.gz vibe_backend/apps/
```
