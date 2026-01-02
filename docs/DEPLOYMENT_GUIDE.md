# Production Deployment Guide

This guide covers multiple deployment options for the Dyad backend application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Options](#deployment-options)
   - [Docker Deployment (Recommended)](#docker-deployment-recommended)
   - [VPS/Cloud Server (Traditional)](#vpscloud-server-traditional)
   - [Platform as a Service (PaaS)](#platform-as-a-service-paas)
   - [Kubernetes](#kubernetes)
4. [Production Checklist](#production-checklist)
5. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### Required Services
- **PostgreSQL Database** (v14+)
- **Docker/Podman** (for containerization)
- **Node.js** (v22+) if not using Docker
- **pnpm** (v8+) package manager
- **AI API Keys** (OpenAI, Google Gemini, or Anthropic)

### Domain & SSL
- Domain name configured
- SSL certificate (Let's Encrypt recommended)
- Reverse proxy (nginx/Caddy)

---

## Environment Configuration

### 1. Create Production `.env`

```bash
# DO NOT commit this file to version control
cp env.example .env.production
```

### 2. Configure Production Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# Database - PostgreSQL (Use managed service in production)
DATABASE_URL=postgresql://username:password@your-db-host:5432/dyad_prod

# Apps Directory
APPS_BASE_DIR=/var/lib/dyad/apps

# Containerization
CONTAINERIZATION_ENABLED=true
DEFAULT_PACKAGE_MANAGER=pnpm
AUTO_KILL_PORT=false
CONTAINER_INACTIVITY_TIMEOUT=600000
CONTAINER_CPU_LIMIT=2
CONTAINER_MEMORY_LIMIT=2g

# Logging (Use JSON format for production)
LOG_LEVEL=info
LOG_FORMAT=json
LOG_HTTP_ENDPOINT=https://your-log-aggregator.com/api/logs
LOG_HTTP_AUTH=Bearer your-token

# Container Engine
CONTAINERIZATION_ENGINE=docker
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_IMAGE=dyad-vite-dev:latest
DOCKER_DEFAULT_PORT=32100

# AI Configuration
DEFAULT_AI_MODEL=google:gemini-2.5-flash
FALLBACK_AI_MODEL=openai:gpt-4o
DEFAULT_CHAT_MODE=auto-code

# API Keys (Store in secrets manager in production)
OPENAI_API_KEY=sk-proj-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Deployment Options

### Docker Deployment (Recommended)

#### Step 1: Create Production Dockerfile

Create `Dockerfile.prod`:

```dockerfile
FROM node:22-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (production only)
RUN pnpm install --prod --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm run build

# Create non-root user
RUN useradd -r -u 1001 -g root dyad && \
    chown -R dyad:root /app

USER dyad

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

#### Step 2: Create Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.prod
    container_name: dyad-backend-prod
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - PORT=3001
    env_file:
      - .env.production
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./apps:/var/lib/dyad/apps
      - ./data:/app/data
    depends_on:
      - postgres
    networks:
      - dyad-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    image: postgres:16-alpine
    container_name: dyad-postgres-prod
    restart: unless-stopped
    environment:
      POSTGRES_USER: dyad_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: dyad_prod
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - dyad-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dyad_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: dyad-nginx-prod
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
    networks:
      - dyad-network

volumes:
  postgres-data:

networks:
  dyad-network:
    driver: bridge
```

#### Step 3: Create nginx Configuration

Create `nginx/nginx.prod.conf`:

```nginx
upstream backend {
    server backend:3001;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # API routes
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # SSE support
        proxy_buffering off;
        proxy_cache off;
    }

    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    location /api/chats {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend;
    }
}
```

#### Step 4: Deploy

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend pnpm run db:migrate
```

---

### VPS/Cloud Server (Traditional)

#### Supported Providers
- AWS EC2
- Google Cloud Compute Engine
- DigitalOcean Droplets
- Linode
- Hetzner

#### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y
```

#### Step 2: Database Setup

```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE dyad_prod;
CREATE USER dyad_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE dyad_prod TO dyad_user;
\q
```

#### Step 3: Deploy Application

```bash
# Clone repository
cd /var/www
sudo git clone https://github.com/your-org/dyad_backend.git
cd dyad_backend

# Install dependencies
pnpm install --prod

# Copy and configure environment
cp env.example .env.production
nano .env.production

# Build application
pnpm run build:prod

# Run migrations
pnpm run db:migrate
```

#### Step 4: Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'dyad-backend',
    script: 'dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 4000
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

#### Step 5: nginx Reverse Proxy

```bash
# Install nginx
sudo apt install nginx -y

# Create configuration
sudo nano /etc/nginx/sites-available/dyad-backend

# Use the nginx configuration from Docker section above

# Enable site
sudo ln -s /etc/nginx/sites-available/dyad-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: SSL with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

---

### Platform as a Service (PaaS)

#### Railway.app

1. **Connect Repository**
   - Go to railway.app
   - New Project → Deploy from GitHub repo

2. **Add PostgreSQL**
   - Add New → Database → PostgreSQL

3. **Environment Variables**
   - Settings → Variables → Add all from `.env.production`

4. **Build Command**
   ```bash
   pnpm install && pnpm run build:prod
   ```

5. **Start Command**
   ```bash
   node dist/index.js
   ```

#### Render.com

1. **Create Web Service**
   - New → Web Service → Connect repository

2. **Configuration**
   - Environment: Node
   - Build Command: `pnpm install && pnpm run build`
   - Start Command: `pnpm run start:prod`

3. **Add PostgreSQL**
   - Dashboard → New → PostgreSQL

4. **Environment Variables**
   - Environment → Add variables

#### Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login and create app
heroku login
heroku create dyad-backend-prod

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set OPENAI_API_KEY=your-key
# ... set all other env vars

# Deploy
git push heroku main

# Run migrations
heroku run pnpm run db:migrate
```

---

### Kubernetes

#### Step 1: Create Deployment

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dyad-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dyad-backend
  template:
    metadata:
      labels:
        app: dyad-backend
    spec:
      containers:
      - name: backend
        image: your-registry/dyad-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: dyad-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: dyad-backend-service
  namespace: production
spec:
  selector:
    app: dyad-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

#### Step 2: Deploy

```bash
# Create namespace
kubectl create namespace production

# Create secrets
kubectl create secret generic dyad-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=openai-api-key="sk-..." \
  -n production

# Apply deployment
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -n production
kubectl logs -f deployment/dyad-backend -n production
```

---

## Production Checklist

### Security
- [ ] All sensitive data in environment variables
- [ ] API keys stored in secrets manager (AWS Secrets Manager, HashiCorp Vault)
- [ ] Database credentials rotated regularly
- [ ] SSL/TLS enabled
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Authentication implemented (KeyCloak/Auth0)
- [ ] Input validation on all endpoints
- [ ] Security headers configured
- [ ] Regular security updates

### Database
- [ ] Automated backups configured
- [ ] Connection pooling enabled
- [ ] Database indexes optimized
- [ ] Read replicas for scaling (if needed)
- [ ] Monitoring and alerting

### Application
- [ ] Health check endpoint working
- [ ] Logging configured (JSON format)
- [ ] Log aggregation setup (ELK/Grafana/Datadog)
- [ ] Error tracking (Sentry/Rollbar)
- [ ] Performance monitoring (New Relic/AppDynamics)
- [ ] Auto-restart on failure
- [ ] Graceful shutdown handling

### Infrastructure
- [ ] Load balancer configured
- [ ] Auto-scaling enabled
- [ ] CDN for static assets (if applicable)
- [ ] DDoS protection
- [ ] Regular backups
- [ ] Disaster recovery plan
- [ ] CI/CD pipeline setup

### Container
- [ ] Docker image built and optimized
- [ ] Container resource limits set
- [ ] Docker socket security configured
- [ ] Container registry configured
- [ ] Image scanning for vulnerabilities

---

## Monitoring & Maintenance

### Health Check Endpoint

Add to `src/index.ts`:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV
  });
});
```

### Logging Best Practices

```typescript
// Already using logger utility
logger.info('Server started', {
  port: PORT,
  env: NODE_ENV,
  version: process.env.npm_package_version
});
```

### Monitoring Tools

**APM (Application Performance Monitoring)**
- New Relic
- Datadog
- AppDynamics
- Dynatrace

**Logging**
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- Splunk

**Error Tracking**
- Sentry
- Rollbar
- Bugsnag

### Database Backups

```bash
# Automated PostgreSQL backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgresql"
pg_dump -U dyad_user dyad_prod | gzip > $BACKUP_DIR/dyad_prod_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup-script.sh
```

### Update Strategy

```bash
# Zero-downtime deployment with PM2
pm2 reload ecosystem.config.js

# Docker deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --no-deps --build backend

# Kubernetes rolling update
kubectl set image deployment/dyad-backend \
  backend=your-registry/dyad-backend:v2.0.0 \
  -n production
```

---

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find process using port
lsof -i :3001
# Kill process
kill -9 <PID>
```

**Database Connection Failed**
- Check `DATABASE_URL` is correct
- Verify PostgreSQL is running
- Check firewall rules
- Verify user permissions

**Container Not Starting**
```bash
# Check logs
docker logs dyad-backend-prod
# Check resource usage
docker stats
```

**High Memory Usage**
- Increase `CONTAINER_MEMORY_LIMIT`
- Check for memory leaks
- Implement connection pooling

---

## Support

For issues and questions:
- GitHub Issues: [your-repo/issues]
- Documentation: [docs/]
- Email: support@your-domain.com
