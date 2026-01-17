# HTTPS Setup with Nginx

This document describes how to run the Dyad web application with HTTPS using Nginx as a reverse proxy.

## Architecture Overview

The production setup uses the following architecture:

```
Client (Browser)
    ↓ HTTPS (443) / HTTP (80)
Nginx Reverse Proxy
    ↓ HTTP (3000)
Next.js Frontend Application
```

### Components

- **Nginx**: Acts as a reverse proxy, handles SSL/TLS termination, and forwards requests to the Next.js application
- **Frontend**: Next.js application running in production mode
- **Docker Compose**: Orchestrates both services

## Quick Start

### Development Mode (HTTP Only)

If you want to run without HTTPS for local development:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This will:
- Expose the frontend directly on port 3000
- Skip the nginx reverse proxy
- Run in development mode

Access at: http://localhost:3000

### Production Mode (HTTPS with Nginx)

For production deployment with HTTPS:

### 1. Generate SSL Certificates

For development or testing, generate self-signed certificates:

```bash
chmod +x scripts/generate-ssl-certs.sh
./scripts/generate-ssl-certs.sh
```

For production, see the [Production SSL Setup](#production-ssl-setup) section below.

### 2. Start the Application

```bash
docker-compose up -d
```

### 3. Access the Application

- **HTTPS**: https://localhost
- **HTTP**: http://localhost (automatically redirects to HTTPS)

### 4. Stop the Application

```bash
docker-compose down
```

## Directory Structure

```
dyad-web/
├── docker-compose.yml          # Docker Compose configuration
├── nginx/
│   ├── Dockerfile              # Nginx container definition
│   ├── nginx.conf              # Nginx configuration
│   └── ssl/                    # SSL certificates directory
│       ├── cert.pem            # SSL certificate (generated)
│       └── key.pem             # SSL private key (generated)
└── scripts/
    └── generate-ssl-certs.sh   # Script to generate self-signed certs
```

## Configuration Details

### Nginx Configuration

The nginx configuration ([nginx/nginx.conf](nginx/nginx.conf)) includes:

- **HTTP to HTTPS redirect**: All HTTP requests are automatically redirected to HTTPS
- **SSL/TLS settings**: Modern TLS 1.2 and 1.3 protocols with secure cipher suites
- **Reverse proxy**: Forwards requests to the Next.js application
- **WebSocket support**: Enables real-time features if needed
- **Static file caching**: Optimizes Next.js static assets
- **Security headers**: Adds protective HTTP headers
- **Gzip compression**: Reduces bandwidth usage

### Docker Compose Configuration

The updated docker-compose.yml includes:

- **Frontend service**: 
  - Runs Next.js in production mode
  - Exposes port 3000 internally (not to host)
  - Includes health checks

- **Nginx service**:
  - Exposes ports 80 (HTTP) and 443 (HTTPS)
  - Mounts SSL certificates and configuration
  - Depends on frontend service health check
  - Includes health checks

- **Certbot service** (optional):
  - Commented out by default
  - Enables Let's Encrypt certificate auto-renewal

## Production SSL Setup

### Option 1: Let's Encrypt (Recommended for Public Domains)

1. **Update nginx configuration**

   Edit `nginx/nginx.conf` and uncomment the Let's Encrypt certificate paths:

   ```nginx
   ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
   ```

   Comment out the self-signed certificate paths:

   ```nginx
   # ssl_certificate /etc/nginx/ssl/cert.pem;
   # ssl_certificate_key /etc/nginx/ssl/key.pem;
   ```

2. **Enable Certbot service**

   Edit `docker-compose.yml` and uncomment the certbot service section.

3. **Obtain certificates**

   First, temporarily disable HTTPS in nginx to allow Let's Encrypt validation:

   ```bash
   # Comment out the HTTPS server block in nginx.conf temporarily
   docker-compose up -d nginx
   
   # Request certificate
   docker-compose run --rm certbot certonly \
     --webroot \
     --webroot-path=/var/www/certbot \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email \
     -d yourdomain.com \
     -d www.yourdomain.com
   
   # Re-enable HTTPS server block and restart
   docker-compose restart nginx
   ```

4. **Auto-renewal**

   The certbot service automatically renews certificates every 12 hours.

### Option 2: Custom Certificates

If you have certificates from a trusted Certificate Authority:

1. Place your certificates in the `nginx/ssl/` directory:
   ```
   nginx/ssl/cert.pem       # Your certificate
   nginx/ssl/key.pem        # Your private key
   ```

2. Ensure the paths in `nginx/nginx.conf` point to these files:
   ```nginx
   ssl_certificate /etc/nginx/ssl/cert.pem;
   ssl_certificate_key /etc/nginx/ssl/key.pem;
   ```

3. Restart the services:
   ```bash
   docker-compose restart nginx
   ```

## Environment Variables

The application uses the following environment variables (in `env.local`):

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

Update `NEXT_PUBLIC_API_URL` to use `https://` when running with SSL.

## Troubleshooting

### Certificate Errors in Browser

**Problem**: Browser shows "Your connection is not private" or similar warning.

**Solution**: 
- For development with self-signed certificates: Click "Advanced" → "Proceed to localhost"
- For production: Ensure you're using properly signed certificates from a trusted CA

### Nginx Container Fails to Start

**Problem**: Nginx container exits immediately after starting.

**Solutions**:
1. Check that SSL certificate files exist:
   ```bash
   ls -la nginx/ssl/
   ```

2. Validate nginx configuration:
   ```bash
   docker-compose run --rm nginx nginx -t
   ```

3. Check nginx logs:
   ```bash
   docker-compose logs nginx
   ```

### Frontend Not Accessible

**Problem**: Nginx starts but cannot reach frontend.

**Solutions**:
1. Check frontend health:
   ```bash
   docker-compose ps
   docker-compose logs frontend
   ```

2. Verify frontend is listening on port 3000:
   ```bash
   docker-compose exec frontend netstat -tlnp
   ```

3. Test direct access to frontend (from within nginx container):
   ```bash
   docker-compose exec nginx wget -O- http://frontend:3000
   ```

### Permission Issues with Certificates

**Problem**: Nginx cannot read certificate files.

**Solution**:
```bash
chmod 644 nginx/ssl/cert.pem
chmod 600 nginx/ssl/key.pem
```

## Security Best Practices

1. **Never commit private keys**: Add `nginx/ssl/*.pem` to `.gitignore`
2. **Use strong certificates**: For production, use certificates from trusted CAs
3. **Keep certificates updated**: Regularly renew certificates (automated with Let's Encrypt)
4. **Restrict access**: Ensure certificate files have appropriate permissions
5. **Monitor logs**: Regularly check nginx and application logs for security issues
6. **Update regularly**: Keep nginx and Node.js Docker images updated

## Performance Optimization

The nginx configuration includes several performance optimizations:

- **Gzip compression**: Reduces response sizes
- **Static asset caching**: Caches Next.js static files for 60 minutes
- **HTTP/2**: Enabled for better performance over HTTPS
- **Connection keep-alive**: Reduces connection overhead
- **Worker processes**: Automatically scaled to CPU cores

## Monitoring

### Health Checks

Both services include health checks:

```bash
# Check service health
docker-compose ps

# View health check logs
docker-compose logs nginx | grep health
docker-compose logs frontend | grep health
```

### Access Logs

```bash
# View nginx access logs
docker-compose exec nginx tail -f /var/log/nginx/access.log

# View nginx error logs
docker-compose exec nginx tail -f /var/log/nginx/error.log
```

## Additional Resources

- [Nginx documentation](https://nginx.org/en/docs/)
- [Let's Encrypt documentation](https://letsencrypt.org/docs/)
- [Next.js deployment documentation](https://nextjs.org/docs/deployment)
- [Docker Compose documentation](https://docs.docker.com/compose/)

## Support

For issues related to:
- **Nginx configuration**: Check [nginx/nginx.conf](nginx/nginx.conf)
- **Docker setup**: Check [docker-compose.yml](docker-compose.yml)
- **SSL certificates**: See the [Production SSL Setup](#production-ssl-setup) section
- **Application errors**: Check application logs with `docker-compose logs frontend`
