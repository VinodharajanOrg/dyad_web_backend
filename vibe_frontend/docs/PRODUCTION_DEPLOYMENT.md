# Production Server Deployment Guide

## Server Information
- **Production IP**: 10.157.139.104
- **Docker Deployment**: Yes, running on production server

## Deployment Steps

### 1. Push Code to Production Server

From your local machine, push/sync the code to the production server:

```bash
# Option A: Using git
git add .
git commit -m "Add HTTPS support with nginx"
git push

# Then on production server:
# ssh user@10.157.139.104
# cd /path/to/dyad-web
# git pull

# Option B: Using rsync
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /Users/hardik.hadvani/Hardik.Hadvani/Projects/Mastercard_POC/github/dyad-web/ \
  user@10.157.139.104:/path/to/dyad-web/

# Option C: Using scp
scp -r . user@10.157.139.104:/path/to/dyad-web/
```

### 2. On Production Server (10.157.139.104)

SSH into the production server:

```bash
ssh user@10.157.139.104
cd /path/to/dyad-web
```

### 3. Generate SSL Certificates (On Production Server)

```bash
# Make script executable (if needed)
chmod +x scripts/generate-ssl-certs.sh

# Generate SSL certificates
./scripts/generate-ssl-certs.sh
```

This will create:
- `nginx/ssl/cert.pem`
- `nginx/ssl/key.pem`

### 4. Verify Configuration (On Production Server)

```bash
# Validate setup
./scripts/validate-https-setup.sh

# Check docker-compose configuration
docker compose config
```

### 5. Deploy Services (On Production Server)

```bash
# Stop existing services (if running)
docker compose down

# Build and start services
docker compose up -d

# Or to see logs:
docker compose up
```

### 6. Verify Deployment

```bash
# Check service status
docker compose ps

# Check logs
docker compose logs nginx
docker compose logs frontend

# Test from production server
curl -I http://localhost
curl -k -I https://localhost

# Test health check
curl http://localhost/health
```

### 7. Access from External Machines

From any machine on the network:
- **HTTPS**: https://10.157.139.104
- **HTTP**: http://10.157.139.104 (redirects to HTTPS)

## Firewall Configuration

Ensure ports are open on production server:

```bash
# For Ubuntu/Debian with ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# For CentOS/RHEL with firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Check if ports are listening
sudo netstat -tlnp | grep -E ':(80|443)'
```

## Troubleshooting

### Issue: Cannot access from external machine

```bash
# On production server, check if nginx is listening on all interfaces
docker compose exec nginx netstat -tlnp | grep nginx

# Should show 0.0.0.0:80 and 0.0.0.0:443
```

### Issue: SSL certificate errors

```bash
# On production server, verify certificates exist
ls -la nginx/ssl/

# Re-generate if needed
./scripts/generate-ssl-certs.sh
docker compose restart nginx
```

### Issue: Service won't start

```bash
# On production server
docker compose logs nginx
docker compose logs frontend

# Test nginx configuration
docker compose exec nginx nginx -t
```

## Update Workflow

For future updates:

```bash
# LOCAL: Make changes and commit
git add .
git commit -m "Your changes"
git push

# PRODUCTION SERVER: Pull and redeploy
ssh user@10.157.139.104
cd /path/to/dyad-web
git pull
docker compose up -d --build
```

## Monitoring

```bash
# On production server - Monitor logs in real-time
docker compose logs -f

# Check resource usage
docker stats

# Check certificate expiry
openssl x509 -enddate -noout -in nginx/ssl/cert.pem
```

## Security Notes

1. **SSL Certificates**: Self-signed certificates will show browser warnings. For production, consider:
   - Using Let's Encrypt (see HTTPS_SETUP.md)
   - Getting certificates from a trusted CA

2. **SSH Access**: Secure your SSH access to the production server

3. **Regular Updates**: Keep Docker images updated:
   ```bash
   docker compose pull
   docker compose up -d --build
   ```

4. **Backup**: Regularly backup:
   - SSL certificates (nginx/ssl/)
   - Configuration files
   - Application data

## Quick Reference Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View logs
docker compose logs -f nginx

# Check status
docker compose ps

# Rebuild and restart
docker compose up -d --build --force-recreate
```
