# Vibe Mastercard - Deployment Guide

## Server Architecture

This document describes the production deployment of Vibe Mastercard across two servers.

### Infrastructure Overview

```
                        HTTPS Communication

┌─────────────────────────────────────────────────────────────────┐
│                     Server 2: 10.157.150.207                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Nginx Reverse Proxy                        │   │
│  │               Ports: 80 (HTTP) → 443 (HTTPS)             │   │
│  │                                                          │   │
│  │  Routes:                                                 │   │
│  │    https://10.157.150.207/          → Frontend           │   │
│  │    https://10.157.150.207/api/*     → Backend API        │   │
│  │    https://10.157.150.207/api-docs  → API Docs           │   │
│  └────────────┬──────────────────────┬──────────────────────┘   │
│               │                      │                          │
│    ┌──────────▼──────────┐   ┌──────▼──────────────┐            │
│    │  Frontend Container │   │  Backend Container. │            │
│    │  Next.js (Port 3000)│   │  Express (Port 3001)│            │
│    │                     │   │                     │            │
│    │  • React UI         │   │  • REST API         │            │
│    │  • SSR/SSG          │   │  • WebSocket        │            │
│    │  • Auth Integration │   │  • Container Mgmt   │            │
│    └─────────────────────┘   │  • PostgreSQL DB    │            │
│                              │  • Docker Engine    │            │
│                              └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Server Configuration

### Server 1: Keycloak Authentication (10.157.147.235)

**Purpose:** Identity and Access Management (IAM)

**Services:**
- Keycloak Authentication Server
- Realm: `vibe-web`
- HTTPS endpoint: `https://10.157.147.235`

**Keycloak Clients:**

1. **vibe-backend** (Backend Service Account)
   - Client ID: `vibe-backend`
   - Client Secret: `kU9tMQzpmDjC2f6KkA4haxkzw0S5jVz4`
   - Access Type: Confidential
   - Service Account Enabled: Yes
   - Redirect URIs: `https://10.157.150.207/api/auth/callback`

2. **vibe-mastercard-frontend** (Frontend Public Client)
   - Client ID: `vibe-mastercard-frontend`
   - Access Type: Public
   - Valid Redirect URIs: `https://10.157.150.207/*`
   - Web Origins: `https://10.157.150.207`

**Endpoints:**
- Authorization: `https://10.157.147.235/realms/vibe-web/protocol/openid-connect/auth`
- Token: `https://10.157.147.235/realms/vibe-web/protocol/openid-connect/token`
- User Info: `https://10.157.147.235/realms/vibe-web/protocol/openid-connect/userinfo`
- Logout: `https://10.157.147.235/realms/vibe-web/protocol/openid-connect/logout`

### Server 2: Application Server (10.157.150.207)

**Purpose:** Frontend and Backend Application Hosting

**Services:**
- Nginx Reverse Proxy
- Frontend (Next.js)
- Backend (Express API)
- PostgreSQL Database
- Docker Container Engine

**Network Configuration:**
- External HTTPS: `https://10.157.150.207`
- Internal Frontend: `http://localhost:3000`
- Internal Backend: `http://localhost:3001`
- Docker Network: `dyad-network`

## Deployment Steps

### Prerequisites

- Docker and Docker Compose installed on 10.157.150.207
- PostgreSQL database running
- Valid SSL certificates for 10.157.150.207
- Network connectivity between both servers
- Keycloak realm and clients configured on 10.157.147.235

### Step 1: Keycloak Configuration (10.157.147.235)

1. **Create Realm:**
   ```
   Realm Name: vibe-web
   Enabled: true
   ```

2. **Create Backend Client:**
   ```
   Client ID: vibe-backend
   Access Type: Confidential
   Service Accounts Enabled: true
   Valid Redirect URIs: https://10.157.150.207/api/auth/callback
   ```
   
   Generate and save the client secret.

3. **Create Frontend Client:**
   ```
   Client ID: vibe-mastercard-frontend
   Access Type: Public
   Valid Redirect URIs: https://10.157.150.207/*
   Web Origins: https://10.157.150.207
   ```

4. **Configure User Federation** (if needed):
   - LDAP/Active Directory integration
   - User attributes mapping

### Step 2: SSL Certificate Setup (10.157.150.207)

Generate or obtain SSL certificates:

```bash
cd /path/to/project/ssl

# For self-signed (development):
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Mastercard/CN=10.157.150.207"

# For production, use certificates from your CA
```

### Step 3: Backend Configuration (10.157.150.207)

Navigate to backend directory:
```bash
cd vibe_backend
```

Create/update `.env` file:
```env
# Server Configuration
PORT=3001
NODE_ENV=production
USE_HTTPS=false  # Nginx handles SSL termination

# Database
DATABASE_URL=postgresql://user:password@host.docker.internal:5432/vibe-db

# Authentication - Keycloak on Server 1
AUTH_PROVIDER=keycloak
AUTH_ISSUER_URL=https://10.157.147.235/realms/vibe-web
AUTH_CLIENT_ID=vibe-backend
AUTH_CLIENT_SECRET=kU9tMQzpmDjC2f6KkA4haxkzw0S5jVz4
AUTH_REDIRECT_URI=https://10.157.150.207/api/auth/callback
AUTH_LOGOUT_ENDPOINT=/protocol/openid-connect/logout
AUTH_TOKEN_ENDPOINT=/protocol/openid-connect/token
AUTH_USERINFO_ENDPOINT=/protocol/openid-connect/userinfo

# Frontend URL
FRONTEND_URL=https://10.157.150.207

# Containerization
CONTAINERIZATION_ENABLED=true
CONTAINERIZATION_ENGINE=docker
DOCKER_NETWORK=dyad-network
DOCKER_IMAGE=dyad-vite-dev:latest

# Apps Directory
APPS_BASE_DIR=/app/apps
HOST_APPS_BASE_DIR=/path/to/vibe_backend/apps

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# TLS Configuration (disable validation for self-signed certs in dev)
NODE_TLS_REJECT_UNAUTHORIZED=0  # Remove for production with valid certs
```

### Step 4: Frontend Configuration (10.157.150.207)

Navigate to frontend directory:
```bash
cd ../vibe_frontend
```

Create `.env.local` file:
```env
# API Configuration - Backend on same server
NEXT_PUBLIC_API_URL=https://10.157.150.207/api
NEXT_PUBLIC_WS_URL=wss://10.157.150.207/api

# Keycloak Configuration - Server 1
NEXT_PUBLIC_KEYCLOAK_URL=https://10.157.147.235
NEXT_PUBLIC_KEYCLOAK_REALM=vibe-web
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=vibe-mastercard-frontend

# Feature Flags
NEXT_PUBLIC_ENABLE_AUTH=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Environment
NODE_ENV=production
```

### Step 5: Nginx Configuration (10.157.150.207)

The unified nginx configuration at root level handles:

```nginx
# Key configuration in nginx/nginx.conf:

upstream frontend {
    server vibe_frontend:3000;
}

upstream backend {
    server vibe_backend:3001;
}

server {
    listen 443 ssl http2;
    server_name 10.157.150.207;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name 10.157.150.207;
    return 301 https://$server_name$request_uri;
}
```

### Step 6: Deploy with Docker Compose (10.157.150.207)

From the project root:

```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 7: Database Migration (10.157.150.207)

Run database migrations:

```bash
cd vibe_backend

# Run migrations
npm run migrate

# Or using Docker
docker-compose exec vibe_backend npm run migrate
```

### Step 8: Verify Deployment

1. **Check Services:**
   ```bash
   docker-compose ps
   ```
   All services should show "Up" status.

2. **Test Endpoints:**
   ```bash
   # Frontend
   curl -k https://10.157.150.207/
   
   # Backend Health
   curl -k https://10.157.150.207/api/health
   
   # API Docs
   curl -k https://10.157.150.207/api-docs
   ```

3. **Test Authentication:**
   - Navigate to `https://10.157.150.207`
   - Click login
   - Should redirect to Keycloak on `https://10.157.147.235`
   - After login, should redirect back to application

4. **Check Logs:**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f vibe_backend
   docker-compose logs -f vibe_frontend
   docker-compose logs -f nginx
   ```

## Network Security

### Firewall Rules

**Server 1 (10.157.147.235 - Keycloak):**
```
Inbound:
- Port 443 (HTTPS) from 10.157.150.207
- Port 443 (HTTPS) from user networks

Outbound:
- All allowed
```

**Server 2 (10.157.150.207 - Application):**
```
Inbound:
- Port 80 (HTTP) from user networks (redirects to 443)
- Port 443 (HTTPS) from user networks
- Port 22 (SSH) from admin networks

Outbound:
- Port 443 (HTTPS) to 10.157.147.235 (Keycloak)
- Port 5432 (PostgreSQL) to database server
- All other outbound allowed
```

### Security Considerations

1. **TLS/SSL:**
   - Use valid certificates from trusted CA in production
   - Enforce TLS 1.2 minimum
   - Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` with valid certificates

2. **Keycloak:**
   - Use strong client secrets
   - Enable MFA for admin accounts
   - Regular security updates
   - Configure session timeouts

3. **Network:**
   - Use internal network between servers if possible
   - Implement rate limiting
   - Enable DDoS protection
   - Regular security audits

4. **Application:**
   - Keep dependencies updated
   - Enable security headers (CSP, HSTS, etc.)
   - Regular vulnerability scanning
   - Implement proper logging and monitoring

## Monitoring and Maintenance

### Health Checks

**Backend Health Endpoint:**
```bash
curl -k https://10.157.150.207/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T...",
  "services": {
    "database": "connected",
    "keycloak": "reachable",
    "docker": "running"
  }
}
```

### Log Locations

```bash
# Application logs
./logs/nginx/access.log
./logs/nginx/error.log
./vibe_backend/logs/

# Docker logs
docker-compose logs vibe_backend
docker-compose logs vibe_frontend
docker-compose logs nginx
```

### Backup Procedures

1. **Database Backup:**
   ```bash
   pg_dump -h localhost -U postgres vibe-db > backup_$(date +%Y%m%d).sql
   ```

2. **Configuration Backup:**
   ```bash
   tar -czf config_backup_$(date +%Y%m%d).tar.gz \
     vibe_backend/.env \
     vibe_frontend/.env.local \
     nginx/nginx.conf \
     ssl/
   ```

3. **Application Data:**
   ```bash
   tar -czf apps_backup_$(date +%Y%m%d).tar.gz vibe_backend/apps/
   ```

### Update Procedure

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild containers:**
   ```bash
   docker-compose build --no-cache
   ```

3. **Run migrations:**
   ```bash
   docker-compose exec vibe_backend npm run migrate
   ```

4. **Restart services:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Troubleshooting

### Common Issues

**1. Keycloak Connection Failed:**
```bash
# Test connectivity
curl -k https://10.157.147.235/realms/vibe-web/.well-known/openid-configuration

# Check firewall
telnet 10.157.147.235 443
```

**2. Authentication Redirect Loop:**
- Verify redirect URIs match exactly in Keycloak client
- Check FRONTEND_URL in backend .env
- Verify client secret is correct

**3. Container Won't Start:**
```bash
# Check logs
docker-compose logs vibe_backend

# Check port conflicts
netstat -tuln | grep -E '3000|3001'

# Rebuild
docker-compose down
docker-compose up --build
```

**4. SSL Certificate Errors:**
- Ensure certificates are readable: `chmod 644 ssl/*.pem`
- Verify certificate paths in docker-compose.yml
- Check certificate validity: `openssl x509 -in ssl/cert.pem -text -noout`

**5. Database Connection Issues:**
- Verify DATABASE_URL in .env
- Check database is accessible: `psql $DATABASE_URL`
- Ensure database exists and migrations ran

## Access URLs

- **Application**: `https://10.157.150.207`
- **API Documentation**: `https://10.157.150.207/api-docs`
- **Backend Health**: `https://10.157.150.207/api/health`
- **Keycloak Admin**: `https://10.157.147.235/admin`
- **Keycloak Realm**: `https://10.157.147.235/realms/vibe-web`

## Support Contacts

For deployment issues:
1. Check logs first
2. Review this documentation
3. Contact DevOps team
4. Escalate to development team if needed

---

**Document Version:** 1.0  
**Last Updated:** January 20, 2026  
**Maintained By:** DevOps Team
