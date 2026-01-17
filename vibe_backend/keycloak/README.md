# Keycloak Setup

Production-ready Keycloak setup with PostgreSQL and Nginx proxy.

## Files

- `docker-compose.yml` - Main compose configuration
- `nginx.conf` - Nginx proxy configuration (hides COOP headers)
- `.env.example` - Environment variables template

## Quick Start

1. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Start services:**
   ```bash
   docker-compose up -d
   ```

3. **Disable SSL requirement:**
   ```bash
   sleep 60
   docker exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
     --server http://localhost:8080 --realm master --user admin --password <your-password>
   docker exec keycloak /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE
   ```

4. **Access Keycloak:**
   - URL: http://10.157.147.235:8080 (or your configured hostname)
   - Admin Console: http://10.157.147.235:8080/admin

## Services

- **PostgreSQL** - Port 5432 (internal only)
- **Keycloak** - Port 8080 (internal only)
- **Nginx** - Port 8080 (exposed on 0.0.0.0)

## Production Features

- ✅ Health checks on all services
- ✅ Resource limits configured
- ✅ Persistent volumes for data
- ✅ Log rotation enabled
- ✅ Optimized Keycloak build
- ✅ Nginx proxy hides COOP headers
- ✅ Restart policies for high availability
