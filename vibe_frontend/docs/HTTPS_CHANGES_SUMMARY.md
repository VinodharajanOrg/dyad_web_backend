# HTTPS Setup - Changes Summary

This document summarizes all changes made to enable HTTPS support with Nginx reverse proxy in production mode.

## Files Created

### 1. Nginx Configuration Files

- **`nginx/Dockerfile`**
  - Creates Nginx container from official Alpine image
  - Sets up SSL certificate directories
  - Exposes ports 80 and 443

- **`nginx/nginx.conf`**
  - Main Nginx configuration with:
    - HTTP to HTTPS redirect
    - SSL/TLS 1.2 and 1.3 support
    - Reverse proxy to Next.js frontend
    - WebSocket support
    - Static file caching
    - Security headers
    - Gzip compression
    - Health check endpoint

- **`nginx/ssl/.gitkeep`**
  - Placeholder to ensure SSL directory exists in git
  - Actual certificates are ignored via .gitignore

- **`nginx/README.md`**
  - Quick reference for nginx directory

### 2. Scripts

- **`scripts/generate-ssl-certs.sh`** (executable)
  - Generates self-signed SSL certificates for development
  - Creates cert.pem and key.pem in nginx/ssl/
  - Valid for 365 days

### 3. Documentation

- **`docs/HTTPS_SETUP.md`**
  - Comprehensive guide for HTTPS setup
  - Covers both development and production scenarios
  - Includes Let's Encrypt setup instructions
  - Troubleshooting section
  - Security best practices
  - Performance optimization tips

### 4. Docker Compose Files

- **`docker-compose.dev.yml`**
  - Override file for development mode
  - Disables nginx and exposes frontend directly
  - Allows HTTP-only access on port 3000

## Files Modified

### 1. `docker-compose.yml`

**Changes:**
- Updated `frontend` service:
  - Changed from `ports` to `expose` (not directly accessible from host)
  - Added health check
  - Removed direct port 3000 exposure

- Added `nginx` service:
  - Exposes ports 80 and 443
  - Mounts nginx configuration and SSL certificates
  - Depends on frontend health check
  - Includes its own health check

- Added optional `certbot` service (commented out):
  - For Let's Encrypt certificate management
  - Auto-renewal every 12 hours

- Added volumes:
  - `certbot-www`: For Let's Encrypt challenges
  - `certbot-conf`: For Let's Encrypt certificates

### 2. `.gitignore`

**Changes:**
- Added section for SSL certificates:
  ```
  # SSL Certificates (never commit private keys)
  nginx/ssl/*.pem
  nginx/ssl/*.key
  nginx/ssl/*.crt
  ```

### 3. `README.md`

**Changes:**
- Added new section: "🔒 Production Deployment with HTTPS"
- Links to HTTPS_SETUP.md documentation
- Quick start commands for HTTPS setup

## Directory Structure After Changes

```
dyad-web/
├── docker-compose.yml          (modified)
├── docker-compose.dev.yml      (new)
├── .gitignore                  (modified)
├── README.md                   (modified)
├── nginx/                      (new directory)
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── README.md
│   └── ssl/
│       └── .gitkeep
├── scripts/                    (new directory)
│   └── generate-ssl-certs.sh
└── docs/
    └── HTTPS_SETUP.md          (new)
```

## Usage Scenarios

### Scenario 1: Local Development (HTTP)

```bash
# Option 1: Use dev override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Option 2: Direct npm commands (not using Docker)
npm install
npm run dev
```

Access: http://localhost:3000

### Scenario 2: Production Development/Testing (HTTPS with self-signed certs)

```bash
# Generate self-signed certificates
./scripts/generate-ssl-certs.sh

# Start all services
docker-compose up -d
```

Access: https://localhost (you'll see browser warning for self-signed cert)

### Scenario 3: Production Deployment (HTTPS with Let's Encrypt)

```bash
# 1. Update nginx.conf to use Let's Encrypt paths
# 2. Uncomment certbot service in docker-compose.yml
# 3. Update your domain in nginx configuration
# 4. Obtain certificates
docker-compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  -d yourdomain.com

# 5. Start services
docker-compose up -d
```

Access: https://yourdomain.com

## Security Considerations

1. **Private Keys**: Never commit SSL private keys to version control
2. **Self-signed Certificates**: Only use for development/testing
3. **Production Certificates**: Use Let's Encrypt or trusted CA
4. **File Permissions**: Certificate files should have restricted permissions
5. **Regular Updates**: Keep nginx and Node.js images updated

## Testing the Setup

```bash
# 1. Check services are running
docker-compose ps

# 2. Check health status
docker-compose ps | grep healthy

# 3. Test HTTP redirect to HTTPS
curl -I http://localhost

# 4. Test HTTPS (ignore cert verification for self-signed)
curl -k -I https://localhost

# 5. View logs
docker-compose logs nginx
docker-compose logs frontend
```

## Rollback

To revert to HTTP-only setup:

```bash
# Stop and remove containers
docker-compose down

# Use development override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Or restore the original docker-compose.yml from git history.

## Next Steps

1. **Customize nginx configuration** for your specific needs
2. **Set up monitoring** and logging aggregation
3. **Configure backups** for SSL certificates
4. **Implement CI/CD** for automated deployments
5. **Set up rate limiting** in nginx for API protection
6. **Add WAF rules** if needed for additional security

## Support

For issues or questions:
- Check [docs/HTTPS_SETUP.md](./HTTPS_SETUP.md) for detailed documentation
- Review nginx logs: `docker-compose logs nginx`
- Test nginx configuration: `docker-compose exec nginx nginx -t`
- Verify SSL certificates: `openssl x509 -in nginx/ssl/cert.pem -text -noout`
