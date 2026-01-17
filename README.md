# Unified Nginx Setup for Dyad Frontend & Backend

This directory contains a unified nginx configuration that serves both the Dyad frontend (Next.js) and backend (Express) applications through a single reverse proxy with shared SSL certificates.

## Architecture

```
                                    ┌─────────────────┐
                                    │   Nginx Proxy   │
                                    │   Port 80/443   │
                                    └────────┬────────┘
                                            │
                        ┌───────────────────┴───────────────────┐
                        │                                       │
                   ┌────▼─────┐                          ┌─────▼────┐
                   │ Frontend │                          │ Backend  │
                   │ Next.js  │                          │ Express  │
                   │ Port 3000│                          │ Port 3001│
                   └──────────┘                          └──────────┘
```

## Directory Structure

```
github/
├── docker-compose.yml          # Unified docker compose for all services
├── ssl/                        # Common SSL certificates directory
│   ├── cert.pem
│   └── key.pem
├── nginx/
│   └── nginx.conf             # Unified nginx configuration
├── logs/
│   └── nginx/                 # Nginx access and error logs
├── dyad_web_backend/          # Backend application
└── dyad-web/                  # Frontend application
```

## Features

### Unified Routing
- **Frontend**: `https://localhost/` - Serves the Next.js application
- **Backend API**: `https://localhost/api/*` - Proxies to backend Express API
- **API Docs**: `https://localhost/api-docs` - Swagger documentation
- **Container Previews**: `https://localhost/app/preview/:id` - Container preview endpoints
- **Health Check**: `https://localhost/health` - System health status

### Security Features
- ✅ Automatic HTTP to HTTPS redirect
- ✅ SSL/TLS 1.2 and 1.3 support
- ✅ Strong cipher configuration
- ✅ Security headers (HSTS, X-Frame-Options, CSP, etc.)
- ✅ Rate limiting for API endpoints
- ✅ Shared SSL certificate management

### Performance Optimization
- ✅ Gzip compression for all text-based content
- ✅ Static asset caching for Next.js files
- ✅ HTTP/2 support
- ✅ Connection keepalive
- ✅ Optimized buffer sizes

### WebSocket Support
- ✅ WebSocket connections for real-time features
- ✅ Hot Module Replacement (HMR) for development
- ✅ Server-Sent Events (SSE) for streaming

## Quick Start

### 1. Setup SSL Certificates

Generate self-signed certificates for development:

```bash
cd ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

Or copy existing certificates:

```bash
# Copy from backend SSL directory
cp dyad_web_backend/ssl/cert.pem ssl/
cp dyad_web_backend/ssl/key.pem ssl/

# Or from frontend SSL directory
cp dyad-web/nginx/ssl/cert.pem ssl/
cp dyad-web/nginx/ssl/key.pem ssl/
```

### 2. Configure Environment Variables

Create environment files if they don't exist:

**Backend (.env in dyad_web_backend/):**
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@your-db-host:5432/dyad
USE_HTTPS=true
SSL_KEY_PATH=/app/ssl/key.pem
SSL_CERT_PATH=/app/ssl/cert.pem
# Add other backend environment variables as needed
```

**Frontend (env.local in dyad-web/):**
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://localhost/api
# Add other frontend environment variables as needed
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### 3. Start All Services

From the root directory (`github/`):

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 4. Access the Application

- **Frontend**: https://localhost
- **Backend API**: https://localhost/api
- **API Documentation**: https://localhost/api-docs
- **Health Check**: https://localhost/health

## Service Management

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Restart Nginx Only
```bash
docker-compose restart nginx
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f nginx
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Rebuild Services
```bash
# Rebuild all
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

## Configuration Details

### Rate Limiting

The nginx configuration includes rate limiting to protect your services:

- **API endpoints** (`/api/*`): 10 requests/second with burst of 20
- **Container previews** (`/app/preview/*`): 30 requests/second with burst of 50
- **General traffic** (`/*`): 50 requests/second with burst of 100

### SSL Configuration

The unified setup uses a common SSL directory (`ssl/`) mounted to all services:
- Nginx: `/etc/nginx/ssl`
- Backend: `/app/ssl`
- Frontend: `/app/ssl`

This ensures all services use the same certificates, simplifying management.

### Logging

Nginx logs are stored in `logs/nginx/`:
- `access.log` - All HTTP requests
- `error.log` - Errors and warnings

## Production Deployment

### Using Let's Encrypt

For production, use Let's Encrypt for free SSL certificates:

1. Uncomment the `certbot` service in `docker-compose.yml`

2. Update the nginx configuration to use Let's Encrypt certificates:
```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

3. Obtain certificates:
```bash
docker-compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com
```

### Security Checklist

- [ ] Replace self-signed certificates with valid SSL certificates
- [ ] Update `server_name` in nginx.conf with your domain
- [ ] Set strong database passwords
- [ ] Enable firewall rules (allow only 80, 443)
- [ ] Set `NODE_TLS_REJECT_UNAUTHORIZED=1` in production
- [ ] Review and adjust rate limiting thresholds
- [ ] Configure proper CORS settings in backend
- [ ] Enable nginx access log rotation
- [ ] Set up monitoring and alerts

## Troubleshooting

### Port Conflicts

If you get port binding errors:
```bash
# Check what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop other nginx instances
sudo systemctl stop nginx

# Or change ports in docker-compose.yml
ports:
  - "8080:80"   # Changed from 80:80
  - "8443:443"  # Changed from 443:443
```

### SSL Certificate Errors

If browsers show certificate warnings:
- **Development**: This is normal with self-signed certificates. Click "Advanced" and "Proceed to localhost"
- **Production**: Ensure you're using valid certificates from a trusted CA

### Service Connection Issues

Check if all services are healthy:
```bash
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
```

Test endpoints individually:
```bash
# Test backend directly
curl http://localhost:3001/health

# Test frontend directly
curl http://localhost:3000

# Test through nginx
curl -k https://localhost/health
curl -k https://localhost/api/health
```

### Nginx Configuration Syntax

Test nginx configuration before restarting:
```bash
docker-compose exec nginx nginx -t
```

Reload nginx without downtime:
```bash
docker-compose exec nginx nginx -s reload
```

## Migration from Separate Nginx Instances

If you're migrating from the separate nginx setups:

1. **Backup existing configurations**:
```bash
cp dyad_web_backend/nginx/nginx.conf dyad_web_backend/nginx/nginx.conf.backup
cp dyad-web/nginx/nginx.conf dyad-web/nginx/nginx.conf.backup
```

2. **Stop old services**:
```bash
cd dyad_web_backend/nginx && docker-compose down
cd dyad-web && docker-compose down
```

3. **Use the unified setup**:
```bash
cd github/
docker-compose up -d
```

## Performance Tuning

### For High Traffic

Adjust these values in `nginx/nginx.conf`:

```nginx
worker_processes auto;  # Or specific number based on CPU cores
worker_connections 2048;  # Increase from 1024

# Adjust rate limits
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;
```

### For Large File Uploads

```nginx
client_max_body_size 500M;  # Default is 100M
```

### Connection Pooling

```nginx
upstream backend_api {
    server backend:3001;
    keepalive 64;  # Increase from 32
}
```

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Verify all services are healthy: `docker-compose ps`
3. Test the health endpoint: `curl -k https://localhost/health`
4. Review nginx error logs: `tail -f logs/nginx/error.log`

## Related Documentation

- [Backend Architecture](dyad_web_backend/docs/ARCHITECTURE.md)
- [Docker Setup](dyad_web_backend/docs/DOCKER_QUICK_START_GUIDE.md)
- [API Documentation](dyad_web_backend/docs/API_DOCUMENTATION.md)
- [Frontend Setup](dyad-web/README.md)
