# Unified Nginx Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Browser                          │
│                    (https://localhost:443)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTPS (SSL/TLS)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      Nginx Reverse Proxy                         │
│                        (Port 80/443)                             │
│                                                                   │
│  Features:                                                        │
│  • SSL Termination (shared certificates)                         │
│  • HTTP → HTTPS redirect                                         │
│  • Request routing                                               │
│  • Rate limiting                                                 │
│  • Gzip compression                                              │
│  • Static file caching                                           │
│  • WebSocket support                                             │
│                                                                   │
│  Routes:                                                          │
│  ┌──────────────────────────────────────────────────┐           │
│  │ /          → Frontend (Next.js)                  │           │
│  │ /api/*     → Backend (Express)                   │           │
│  │ /api-docs  → Backend API Docs                    │           │
│  │ /app/preview/* → Backend Container Previews      │           │
│  │ /health    → Health Check                        │           │
│  └──────────────────────────────────────────────────┘           │
└───────────────────┬────────────────────┬────────────────────────┘
                    │                    │
        ┌───────────┘                    └───────────┐
        │                                            │
        │ HTTP                                       │ HTTP
        │ (internal)                                 │ (internal)
        │                                            │
┌───────▼─────────┐                        ┌─────────▼──────────┐
│  Frontend       │                        │  Backend           │
│  Next.js App    │                        │  Express API       │
│  Port: 3000     │                        │  Port: 3001        │
│                 │                        │                    │
│  • React UI     │                        │  • REST API        │
│  • SSR/SSG      │                        │  • WebSocket       │
│  • Static files │                        │  • SSE Streaming   │
│  • HMR (dev)    │                        │  • Container Mgmt  │
└─────────────────┘                        └────────────────────┘
                                                     
Note: Database is configured externally via DATABASE_URL
```

## SSL Certificate Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Common SSL Directory                        │
│                        ./ssl/                                    │
│                                                                   │
│                    ┌──────────────┐                              │
│                    │  cert.pem    │  (Public certificate)        │
│                    │  key.pem     │  (Private key)               │
│                    └──────┬───────┘                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                ┌───────────┴────────────┬────────────────┐
                │                        │                │
        ┌───────▼────────┐     ┌────────▼──────┐  ┌─────▼──────┐
        │     Nginx      │     │    Backend    │  │  Frontend  │
        │                │     │               │  │            │
        │ Mounted at:    │     │ Mounted at:   │  │ Mounted at:│
        │ /etc/nginx/ssl │     │ /app/ssl      │  │ /app/ssl   │
        └────────────────┘     └───────────────┘  └────────────┘
```

## Request Flow Examples

### Frontend Request (/)
```
1. Browser → https://localhost/
2. Nginx receives request on port 443
3. Nginx terminates SSL
4. Nginx forwards to http://frontend:3000/
5. Frontend returns HTML
6. Nginx returns response with SSL to browser
```

### API Request (/api/*)
```
1. Browser → https://localhost/api/users
2. Nginx receives request on port 443
3. Nginx terminates SSL
4. Nginx forwards to http://backend:3001/api/users
5. Backend processes request, queries database
6. Backend returns JSON
7. Nginx returns response with SSL to browser
```

### WebSocket Connection
```
1. Browser → wss://localhost/api/chat
2. Nginx receives WebSocket upgrade request
3. Nginx upgrades connection and proxies to backend
4. Backend maintains WebSocket connection
5. Bidirectional communication established
```

## Network Topology

```
┌──────────────────────────────────────────────────────────────┐
│                    Docker Network: dyad-network              │
│                         Bridge Mode                          │
│                                                              │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐        │
│  │    nginx     │  │  frontend  │  │   backend    │        │
│  │              │  │            │  │              │        │
│  │ External:    │  │ External:  │  │ External:    │        │
│  │ 80, 443      │  │ 3000       │  │ 3001, 3443   │        │
│  │              │  │            │  │              │        │
│  │ Internal:    │  │ Internal:  │  │ Internal:    │        │
│  │ nginx        │  │ frontend   │  │ backend      │        │
│  └──────────────┘  └────────────┘  └──────────────┘        │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Note: Backend connects to external database via DATABASE_URL
      - Host database: use host.docker.internal
      - Remote database: use database hostname/IP
```

## File Structure

```
github/
├── docker-compose.yml          # Main orchestration file
├── setup.sh                    # Setup script (executable)
├── manage.sh                   # Management script (executable)
├── README.md                   # Comprehensive documentation
├── QUICKSTART.md              # Quick start guide
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
│
├── ssl/                       # Shared SSL certificates
│   ├── .gitkeep
│   ├── cert.pem               # SSL certificate
│   └── key.pem                # SSL private key
│
├── nginx/                     # Nginx configuration
│   └── nginx.conf             # Unified nginx config
│
├── logs/                      # Application logs
│   └── nginx/
│       ├── .gitkeep
│       ├── access.log         # HTTP access logs
│       └── error.log          # Error logs
│
├── dyad_web_backend/          # Backend application
│   ├── Dockerfile
│   ├── .env                   # Backend environment
│   └── ...
│
└── dyad-web/                  # Frontend application
    ├── Dockerfile
    ├── env.local              # Frontend environment
    └── ...
```

## Benefits of Unified Architecture

### ✅ Simplified SSL Management
- Single set of certificates for all services
- Easier certificate renewal and rotation
- Consistent SSL configuration

### ✅ Centralized Routing
- Single entry point for all traffic
- Easier to configure load balancing
- Simplified DNS and firewall rules

### ✅ Better Performance
- Single SSL handshake point
- Shared connection pooling
- Optimized caching strategy

### ✅ Enhanced Security
- Centralized rate limiting
- Unified security headers
- Single point for security monitoring

### ✅ Easier Operations
- Single nginx instance to manage
- Unified logging
- Simplified deployment

### ✅ Development Friendly
- Consistent local and production setup
- No CORS issues between frontend/backend
- Hot reload support maintained

## Comparison: Before vs After

### Before (Separate Nginx Instances)
```
Browser → Frontend Nginx (443) → Frontend (3000)
Browser → Backend Nginx (443)  → Backend (3001)

Issues:
- Two SSL certificates to manage
- Two nginx configurations to maintain
- Potential CORS issues
- More complex deployment
```

### After (Unified Nginx)
```
Browser → Unified Nginx (443) ─┬→ Frontend (3000)
                                └→ Backend (3001)

Benefits:
✅ One SSL certificate
✅ One nginx configuration
✅ No CORS issues
✅ Simpler deployment
```

## Port Allocation

| Service    | Internal Port | External Port | Protocol | Purpose          |
|------------|--------------|---------------|----------|------------------|
| Nginx      | 80           | 80            | HTTP     | Redirect to HTTPS|
| Nginx      | 443          | 443           | HTTPS    | Main entry point |
| Frontend   | 3000         | 3000          | HTTP     | Next.js (dev)    |
| Backend    | 3001         | 3001          | HTTP     | Express (dev)    |
| Backend    | 3443         | 3443          | HTTPS    | Express SSL (opt)|
| PostgreSQL | 5432         | 5432          | TCP      | Database         |

**Note**: In production, only ports 80 and 443 should be exposed externally. Internal ports are for development and debugging.

**Note**: In production, only ports 80 and 443 should be exposed externally. Internal ports are for development and debugging. Database is configured externally