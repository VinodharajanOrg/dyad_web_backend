# Nginx Reverse Proxy for Dyad Backend

This directory contains Nginx configuration for reverse proxying the Dyad backend API and container preview endpoints.

## Features

- ✅ **Reverse proxy** for backend API on port 3001
- ✅ **Container preview** routing via `/app/preview/:appId`
- ✅ **Rate limiting** for API and preview endpoints
- ✅ **WebSocket support** for HMR and SSE streaming
- ✅ **Health checks** and monitoring
- ✅ **Security headers** (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ **CORS handling** for cross-origin requests
- ✅ **Static asset caching** for performance
- ✅ **Error handling** with JSON responses

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx :80                            │
│                    (Reverse Proxy)                           │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐    ┌────────▼─────────┐
        │  Backend :3001  │    │  Preview Routing │
        │   (Express)     │    │  /app/preview/*  │
        └────────┬────────┘    └────────┬─────────┘
                 │                      │
                 │              ┌───────▼──────────┐
                 │              │  Dynamic Routing │
                 │              │   to Container   │
                 │              │   Ports 32100-   │
                 │              │      32200       │
                 │              └──────────────────┘
                 │
         ┌───────┴────────┐
         │   Container    │
         │   Lifecycle    │
         │   Management   │
         └────────────────┘
```

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Start Nginx and backend together
cd nginx
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Local Nginx

```bash
# Copy configuration to Nginx config directory
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf

# Test configuration
sudo nginx -t

# Reload Nginx
sudo nginx -s reload

# Start backend separately
cd ..
pnpm run dev
```

### Option 3: macOS (Homebrew)

```bash
# Install Nginx
brew install nginx

# Copy configuration
cp nginx/nginx.conf /usr/local/etc/nginx/nginx.conf

# Test and start
nginx -t
nginx

# Reload after changes
nginx -s reload

# Stop
nginx -s stop
```

## Endpoints

### Via Nginx (Port 80)

| Endpoint | Proxy To | Description |
|----------|----------|-------------|
| `http://localhost/health` | `:3001/health` | Health check |
| `http://localhost/api/*` | `:3001/api/*` | Backend API |
| `http://localhost/api-docs` | `:3001/api-docs` | Swagger docs |
| `http://localhost/app/preview/:appId` | `:3001/app/preview/:appId` | Container preview |
| `http://localhost/app/preview/:appId/*` | Container `:32100+` | Direct files |

### Direct Backend (Port 3001)

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3001/health` | Health check |
| `http://localhost:3001/api/*` | Backend API |
| `http://localhost:3001/app/preview/:appId` | Container preview |

## Container Preview Flow

```
1. Browser Request:
   GET http://localhost/app/preview/55

2. Nginx receives and routes to:
   http://localhost:3001/app/preview/55

3. Backend determines container port:
   - Checks lifecycle service for app 55
   - Gets assigned port (e.g., 32101)
   - Starts container if not running

4. Backend proxies to container:
   http://localhost:32101

5. Response flows back:
   Container → Backend → Nginx → Browser
```

## Configuration Options

### Rate Limiting

Edit `nginx.conf` to adjust rate limits:

```nginx
# API endpoints: 10 requests/second
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Preview endpoints: 30 requests/second
limit_req_zone $binary_remote_addr zone=preview_limit:10m rate=30r/s;
```

### Timeouts

Adjust timeouts for long-running requests:

```nginx
proxy_read_timeout 3600s;  # 1 hour for SSE/WebSocket
proxy_send_timeout 3600s;
keepalive_timeout 65;
```

### Static Asset Caching

Configure caching for preview assets:

```nginx
location ~ ^/app/preview/(?<app_id>[0-9]+)/assets/ {
    proxy_cache_valid 200 1h;  # Cache successful responses for 1 hour
    add_header X-Cache-Status $upstream_cache_status;
}
```

## SSL/HTTPS Setup

### Generate Self-Signed Certificate (Development)

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=localhost"
```

### Enable HTTPS in nginx.conf

Uncomment the HTTPS server block at the bottom of `nginx.conf`.

### Update Docker Compose

Uncomment the SSL volume mount and port 443:

```yaml
ports:
  - "443:443"
volumes:
  - ./ssl:/etc/nginx/ssl:ro
```

## Monitoring

### View Access Logs

```bash
# Docker
docker-compose logs -f nginx

# Local
tail -f /var/log/nginx/access.log
tail -f nginx/logs/access.log
```

### Check Status

```bash
# Health check
curl http://localhost/health

# Nginx status (if configured)
curl http://localhost/nginx_status

# Backend status
curl http://localhost/api/containers/info
```

## Troubleshooting

### 502 Bad Gateway

```bash
# Check backend is running
curl http://localhost:3001/health

# Check Nginx can reach backend
docker exec dyad-nginx-proxy curl http://backend:3001/health

# Check logs
docker-compose logs backend
```

### Container Preview Not Loading

```bash
# Check container is running
docker ps | grep dyad-app

# Check port allocation
curl http://localhost/api/containers/info/55

# Check backend logs
docker-compose logs -f backend

# Test direct container access
curl http://localhost:32101  # Replace with actual port
```

### Permission Denied

```bash
# Docker socket permissions (for containerization)
sudo chmod 666 /var/run/docker.sock

# Nginx log directory
sudo chmod 755 nginx/logs
```

### Port Already in Use

```bash
# Check what's using port 80
sudo lsof -i :80

# Stop conflicting service
sudo nginx -s stop
# or
sudo systemctl stop nginx
```

## Performance Tuning

### Worker Processes

Adjust based on CPU cores:

```nginx
worker_processes auto;  # Uses all available cores
# or
worker_processes 4;     # Specific number
```

### Connection Limits

For high traffic:

```nginx
events {
    worker_connections 2048;  # Default: 1024
    use epoll;                # Linux optimization
}
```

### Backend Keepalive

```nginx
upstream backend_api {
    server localhost:3001;
    keepalive 64;  # Increase for more concurrent connections
}
```

## Security Best Practices

1. **Enable HTTPS** in production
2. **Use strong SSL ciphers** (TLSv1.3)
3. **Implement rate limiting** (already configured)
4. **Add authentication** for sensitive endpoints
5. **Restrict CORS origins** in production
6. **Enable fail2ban** for brute force protection
7. **Regular updates** of Nginx and dependencies

## Production Deployment

### Environment Variables

```bash
# .env
NGINX_WORKER_PROCESSES=auto
NGINX_WORKER_CONNECTIONS=2048
NGINX_RATE_LIMIT_API=10r/s
NGINX_RATE_LIMIT_PREVIEW=30r/s
```

### Load Balancing (Multiple Backends)

```nginx
upstream backend_api {
    least_conn;  # or ip_hash
    server backend1:3001;
    server backend2:3001;
    server backend3:3001;
    keepalive 32;
}
```

### Health Checks

```nginx
upstream backend_api {
    server localhost:3001 max_fails=3 fail_timeout=30s;
}
```

## Integration with Existing Setup

The Nginx proxy is **optional** and works alongside direct backend access:

- **With Nginx**: Access via `http://localhost` (port 80)
- **Without Nginx**: Access via `http://localhost:3001` (direct)
- **Container Ports**: `32100-32200` (accessible with or without Nginx)

Both methods work simultaneously!

## References

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Nginx Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)
- [Rate Limiting](https://www.nginx.com/blog/rate-limiting-nginx/)
