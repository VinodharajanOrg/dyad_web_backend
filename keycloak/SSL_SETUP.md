# SSL Setup for Keycloak

## Option 1: Self-Signed Certificate (Development/Testing)

Generate a self-signed certificate:

```bash
cd keycloak/ssl

# Generate private key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=10.157.150.207"
```

## Option 2: Let's Encrypt (Production)

### Using Certbot:

```bash
# Install certbot
sudo apt-get install certbot  # Ubuntu/Debian
# or
brew install certbot  # macOS

# Stop nginx temporarily
docker-compose stop nginx-keycloak

# Generate certificate (replace your-domain.com)
sudo certbot certonly --standalone \
  -d your-domain.com \
  --preferred-challenges http

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem keycloak/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem keycloak/ssl/key.pem
sudo chmod 644 keycloak/ssl/*.pem

# Restart services
docker-compose up -d
```

### Auto-renewal with Certbot:

```bash
# Add to crontab
0 0 1 * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/keycloak/ssl/cert.pem && \
  cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/keycloak/ssl/key.pem && \
  docker-compose -f /path/to/keycloak/docker-compose.yml restart nginx-keycloak
```

## Option 3: Existing Certificate

If you have existing SSL certificates:

```bash
cd keycloak/ssl

# Copy your certificate files
cp /path/to/your/certificate.crt cert.pem
cp /path/to/your/private.key key.pem

# Set proper permissions
chmod 644 cert.pem
chmod 600 key.pem
```

## Update Keycloak Configuration

After setting up HTTPS, update the Keycloak hostname:

1. Edit `.env`:
   ```
   KC_HOSTNAME=your-domain.com  # or 10.157.150.207
   ```

2. Restart services:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. Access Keycloak:
   - **HTTPS**: https://your-domain.com
   - **Admin Console**: https://your-domain.com/admin

## Verify HTTPS

```bash
# Test HTTPS connection
curl -I https://your-domain.com

# Check certificate
openssl s_client -connect your-domain.com:443 -showcerts
```

## Troubleshooting

### Port already in use:
```bash
# Check what's using port 443
sudo lsof -i :443
```

### Certificate issues:
```bash
# Verify certificate
openssl x509 -in keycloak/ssl/cert.pem -text -noout
```

### Browser security warning:
- Self-signed certificates will show a warning in browsers
- For production, use a proper CA-signed certificate (Let's Encrypt is free)
