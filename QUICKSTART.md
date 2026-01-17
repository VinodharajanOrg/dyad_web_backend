# Quick Start Guide - Unified Nginx Setup

Get your Dyad application running with a single nginx instance serving both frontend and backend in under 5 minutes!

## Prerequisites

- Docker and Docker Compose installed
- Ports 80, 443, 3000, and 3001 available
- Database connection configured (if using external database)

## Step-by-Step Setup

### 1️⃣ Run the Setup Script

```bash
cd /path/to/github
./setup.sh
```

This script will:
- ✅ Create necessary directories
- ✅ Set up SSL certificates (copy existing or generate new)
- ✅ Create environment files if missing

### 2️⃣ Configure Environment (Optional)

Edit the environment files if needed:

**Backend**: `dyad_web_backend/.env`
```env
DATABASE_URL=postgresql://user:password@your-db-host:5432/dyad
PORT=3001
# See dyad_web_backend/env.example for all available options
```

**Frontend**: `dyad-web/env.local`
```env
NEXT_PUBLIC_API_URL=https://localhost/api
```

### 3️⃣ Start All Services

```bash
docker-compose up -d
```

Or use the management script:
```bash
./manage.sh start
```

### 4️⃣ Verify Everything is Running

```bash
./manage.sh health
```

Or manually:
```bash
# Check service status
docker-compose ps

# Test endpoints
curl -k https://localhost/health
curl -k https://localhost/api/health
```

### 5️⃣ Access Your Application

Open your browser:
- **Frontend**: https://localhost
- **Backend API**: https://localhost/api
- **API Documentation**: https://localhost/api-docs

⚠️ **Note**: You'll see a certificate warning with self-signed certificates. Click "Advanced" → "Proceed to localhost"

## Common Commands

```bash
# View logs
./manage.sh logs           # All services
./manage.sh logs-nginx     # Just nginx
./manage.sh logs-backend   # Just backend
./manage.sh logs-frontend  # Just frontend

# Restart services
./manage.sh restart        # All services
./manage.sh restart-nginx  # Just nginx

# Stop everything
./manage.sh stop

# Check service health
./manage.sh health

# View service status
./manage.sh status

# Test nginx config
./manage.sh test-nginx

# View SSL certificate info
./manage.sh ssl-info
```

## Architecture Overview

```
Browser Request (https://localhost)
         ↓
    Nginx (Port 443)
         ↓
    ┌────┴────┐
    ↓         ↓
Frontend   Backend
         (5432)
```

### Routing Rules

| URL Pattern | Destination | Purpose |
|------------|-------------|---------|
| `https://localhost/` | Frontend:3000 | Next.js app |
| `https://localhost/api/*` | Backend:3001 | REST API |
| `https://localhost/api-docs` | Backend:3001 | Swagger docs |
| `https://localhost/app/preview/*` | Backend:3001 | Container previews |
| `https://localhost/health` | Nginx | Health check |

## Troubleshooting

### ❌ Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting service
sudo systemctl stop nginx  # If system nginx is running
```

### ❌ Services Won't Start

```bash
# Check logs
./manage.sh logs

# Check specific service
docker-compose logs backend
docker-compose logs frontend

# Rebuild if needed
./manage.sh rebuild
```

### ❌ 502 Bad Gateway

This usually means the backend/frontend isn't ready yet:

```bash
# Check service status
./manage.sh health

# Wait for services to be healthy
docker-compose ps

# Check backend directly
curl http://localhost:3001/health

# Check frontend directly
curl http://localhost:3000
```

### ❌ Database Connection Errors

```bash
# Check if PostgreSQL is running
docker-compose ps postgres
The backend expects a database connection. Make sure:

```bash
# Verify DATABASE_URL in backend .env
cat dyad_web_backend/.env | grep DATABASE_URL

# If using external database, ensure it's accessible
# If using host database: postgresql://user:pass@host.docker.internal:5432/dyad
# If using remote database: postgresql://user:pass@remote-host:5432/dyad

For development with self-signed certificates:
- **Chrome/Edge**: Click "Advanced" → "Proceed to localhost (unsafe)"
- **Firefox**: Click "Advanced" → "Accept the Risk and Continue"

For production, use Let's Encrypt (see main README.md).

## Next Steps

- [ ] Review [README.md](README.md) for detailed documentation
- [ ] Configure rate limiting in [nginx/nginx.conf](nginx/nginx.conf)
- [ ] Set up proper SSL certificates for production
- [ ] Configure monitoring and logging
- [ ] Review security settings

## Support

If you encounter issues:

1. Check logs: `./manage.sh logs`
2. Verify health: `./manage.sh health`
3. Test nginx config: `./manage.sh test-nginx`
4. Review error logs: `tail -f logs/nginx/error.log`

## File Locations

- **Nginx Config**: `nginx/nginx.conf`
- **SSL Certificates**: `ssl/`
- **Logs**: `logs/nginx/`
- **Docker Compose**: `docker-compose.yml`
- **Backend**: `dyad_web_backend/`
- **Frontend**: `dyad-web/`

---

🎉 **You're all set!** Your unified nginx setup is running both frontend and backend with shared SSL certificates.
