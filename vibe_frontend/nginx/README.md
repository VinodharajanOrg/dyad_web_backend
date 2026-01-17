# Nginx Configuration

This directory contains the Nginx reverse proxy configuration for HTTPS support.

## Files

- **Dockerfile**: Nginx container build configuration
- **nginx.conf**: Main Nginx configuration with SSL/TLS and reverse proxy settings
- **ssl/**: Directory for SSL certificates (generated, not in version control)

## Quick Setup

1. Generate SSL certificates:
   ```bash
   cd ..
   ./scripts/generate-ssl-certs.sh
   ```

2. Start with Docker Compose:
   ```bash
   cd ..
   docker-compose up -d
   ```

## SSL Directory

After running the certificate generation script, the `ssl/` directory will contain:

- `cert.pem`: SSL certificate
- `key.pem`: Private key

**Important**: These files are in `.gitignore` and should never be committed to version control.

## Configuration Highlights

- HTTP to HTTPS redirect on port 80
- HTTPS on port 443 with TLS 1.2/1.3
- Reverse proxy to Next.js app on port 3000
- WebSocket support
- Static file caching
- Security headers
- Gzip compression

For detailed documentation, see [../docs/HTTPS_SETUP.md](../docs/HTTPS_SETUP.md).
