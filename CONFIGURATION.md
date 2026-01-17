# Configuration Summary - Unified Nginx Setup

## Overview

The unified nginx setup has been configured to run both frontend and backend services WITHOUT a PostgreSQL container. All services use their individual `.env` files for configuration, following the pattern from the existing docker-compose files.

## Key Changes

### ✅ PostgreSQL Removed
- No PostgreSQL container in docker-compose
- Backend connects to external database via `DATABASE_URL`
- Supports host database or remote database connections

### ✅ Environment Configuration Pattern
All environment variables are now loaded from individual service `.env` files:

```
github/
├── .env                        # Docker-compose level vars only
├── dyad_web_backend/.env      # All backend configuration
└── dyad-web/env.local         # All frontend configuration
```

### ✅ Backend Configuration
The backend mounts additional volumes matching the reference docker-compose:

```yaml
volumes:
  - ./ssl:/app/ssl:ro                              # Common SSL
  - ./dyad_web_backend/data:/app/data              # Data directory
  - ./dyad_web_backend/apps:/app/apps              # Apps directory
  - /var/run/docker.sock:/var/run/docker.sock      # Docker socket
```

Extra hosts for database connectivity:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### ✅ Frontend Configuration
Simplified frontend configuration using env_file pattern:

```yaml
env_file:
  - ./dyad-web/env.local
ports:
  - "0.0.0.0:3000:3000"
```

## Database Connection

### Option 1: Host Database (Recommended for Development)
Connect to PostgreSQL running on your host machine:

**In `dyad_web_backend/.env`:**
```env
DATABASE_URL=postgresql://user:password@host.docker.internal:5432/dyad
```

### Option 2: Remote Database
Connect to a remote PostgreSQL server:

**In `dyad_web_backend/.env`:**
```env
DATABASE_URL=postgresql://user:password@remote-host.example.com:5432/dyad
```

### Option 3: Cloud Database
Connect to cloud-hosted database (AWS RDS, Azure, etc.):

**In `dyad_web_backend/.env`:**
```env
DATABASE_URL=postgresql://user:password@db-instance.region.rds.amazonaws.com:5432/dyad
```

## File Structure

```
github/
├── .env                           # Compose-level vars (PORT, NODE_ENV)
├── .env.example                   # Template for .env
├── docker-compose.yml             # Main orchestration (3 services)
├── setup.sh                       # Setup script
├── manage.sh                      # Management script
│
├── ssl/                           # Common SSL certificates
│   ├── cert.pem
│   └── key.pem
│
├── nginx/
│   └── nginx.conf                 # Unified nginx config
│
├── logs/nginx/                    # Nginx logs
│
├── dyad_web_backend/
│   ├── .env                       # Backend config (DATABASE_URL, etc.)
│   ├── data/                      # Mounted to /app/data
│   └── apps/                      # Mounted to /app/apps
│
└── dyad-web/
    └── env.local                  # Frontend config
```

## Services

### 1. Backend (dyad-backend)
- **Image**: Built from `./dyad_web_backend/Dockerfile`
- **Ports**: 3001, 3443
- **Config**: `dyad_web_backend/.env`
- **Volumes**: SSL, data, apps, docker socket
- **Network**: dyad-network
- **Health**: https://localhost:3001/health

### 2. Frontend (dyad-frontend)
- **Image**: Built from `./dyad-web/Dockerfile`
- **Ports**: 3000
- **Config**: `dyad-web/env.local`
- **Volumes**: SSL
- **Network**: dyad-network
- **Health**: http://localhost:3000/api/health

### 3. Nginx (dyad-nginx)
- **Image**: nginx:alpine
- **Ports**: 80, 443
- **Config**: `nginx/nginx.conf`
- **Volumes**: Config, SSL, logs, certbot
- **Network**: dyad-network
- **Depends**: frontend, backend healthy

## Quick Start

```bash
# 1. Setup SSL and environment files
./setup.sh

# 2. Configure backend database connection
# Edit dyad_web_backend/.env and set DATABASE_URL

# 3. Start all services
./manage.sh start

# 4. Verify health
./manage.sh health

# 5. Access application
open https://localhost
```

## Environment Variables

### Root `.env` (docker-compose level)
```env
NODE_ENV=production
COMPOSE_PROJECT_NAME=dyad
PORT=3001
NEXT_PUBLIC_API_URL=https://localhost/api
```

### Backend `.env` (dyad_web_backend/.env)
Uses ALL variables from the backend's env.example including:
- Server config (PORT, NODE_ENV, USE_HTTPS)
- Database (DATABASE_URL)
- SSL paths (SSL_KEY_PATH, SSL_CERT_PATH)
- Rate limiting
- Container configuration
- Auth providers
- AI configuration
- Logging
- All other backend-specific settings

### Frontend `.env` (dyad-web/env.local)
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://localhost/api
NODE_TLS_REJECT_UNAUTHORIZED=0
# Plus any other frontend-specific variables
```

## Advantages

### ✅ Flexible Database Configuration
- Use existing database infrastructure
- No need to manage PostgreSQL container
- Easy to connect to cloud databases
- Supports database migrations separately

### ✅ Clean Separation of Concerns
- Each service has its own configuration
- Easy to override per environment
- Follows 12-factor app principles

### ✅ Simplified Docker Compose
- Only application services in compose
- Reduced complexity
- Faster startup times
- Less resource usage

### ✅ Matches Reference Architecture
- Follows patterns from existing docker-compose files
- Uses proven volume mount strategy
- Includes all necessary backend volumes (data, apps, docker socket)

## Troubleshooting

### Database Connection Issues

**Problem**: Backend can't connect to database

**Solution**:
```bash
# Check DATABASE_URL format
cat dyad_web_backend/.env | grep DATABASE_URL

# Test connection from host
psql "postgresql://user:pass@host:5432/dyad"

# Test from container
docker-compose exec backend sh -c 'wget -O- "$DATABASE_URL"'

# Verify network connectivity
docker-compose exec backend ping host.docker.internal
```

### Port Conflicts

**Problem**: Ports already in use

**Solution**:
```bash
# Check what's using the ports
lsof -i :80
lsof -i :443
lsof -i :3000
lsof -i :3001

# Stop conflicting services or modify ports in .env
```

### SSL Certificate Issues

**Problem**: SSL certificate errors

**Solution**:
```bash
# Regenerate certificates
cd ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Dyad/CN=localhost"

# Restart services
./manage.sh restart
```

## Migration Notes

### From Separate Docker Compose Files

If migrating from individual docker-compose files:

1. **Stop old services**:
   ```bash
   cd dyad_web_backend/nginx && docker-compose down
   cd dyad-web && docker-compose down
   ```

2. **Ensure environment files exist**:
   - `dyad_web_backend/.env` with all backend vars
   - `dyad-web/env.local` with frontend vars

3. **Configure database connection**:
   - Update `DATABASE_URL` in backend .env
   - Point to your existing database

4. **Start unified setup**:
   ```bash
   cd github/
   ./setup.sh
   ./manage.sh start
   ```

## Support

For detailed information, see:
- [README.md](README.md) - Complete documentation
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture

For issues:
```bash
./manage.sh logs       # View all logs
./manage.sh health     # Check service health
./manage.sh status     # Service status
```
