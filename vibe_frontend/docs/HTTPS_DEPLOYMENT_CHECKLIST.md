# HTTPS Production Setup Checklist

Use this checklist to ensure your HTTPS setup is complete and secure.

## Pre-Deployment Checklist

### 1. Prerequisites
- [ ] Docker and Docker Compose installed
- [ ] Ports 80 and 443 available (or configured in docker-compose.yml)
- [ ] Backend API server configured and accessible
- [ ] Domain name configured (for production with Let's Encrypt)

### 2. Initial Setup
- [ ] Clone/pull latest repository
- [ ] Review `docker-compose.yml` configuration
- [ ] Update environment variables in `env.local`
- [ ] Set `NEXT_PUBLIC_API_URL` to use HTTPS

### 3. SSL Certificates

#### Option A: Self-Signed (Development/Testing)
- [ ] Run `./scripts/validate-https-setup.sh` to check setup
- [ ] Run `./scripts/generate-ssl-certs.sh` to create certificates
- [ ] Verify certificates exist: `ls -la nginx/ssl/`

#### Option B: Let's Encrypt (Production)
- [ ] Update `nginx/nginx.conf` to use Let's Encrypt certificate paths
- [ ] Uncomment certbot service in `docker-compose.yml`
- [ ] Update domain name in nginx configuration
- [ ] Request certificate:
  ```bash
  docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    -d yourdomain.com
  ```
- [ ] Verify certificate renewal is configured

#### Option C: Custom Certificates
- [ ] Place certificates in `nginx/ssl/` directory:
  - `cert.pem` - SSL certificate
  - `key.pem` - Private key
- [ ] Verify file permissions (cert: 644, key: 600)
- [ ] Update paths in `nginx/nginx.conf` if needed

### 4. Configuration Validation
- [ ] Run `./scripts/validate-https-setup.sh`
- [ ] Validate docker-compose: `docker-compose config`
- [ ] Review nginx configuration for your environment
- [ ] Check firewall rules (ports 80, 443 open)

### 5. Deployment
- [ ] Build and start services: `docker-compose up -d`
- [ ] Check service status: `docker-compose ps`
- [ ] Verify all services are healthy
- [ ] Check logs for errors:
  ```bash
  docker-compose logs nginx
  docker-compose logs frontend
  ```

### 6. Testing
- [ ] Test HTTP redirect: `curl -I http://localhost`
- [ ] Test HTTPS access: `curl -k -I https://localhost`
- [ ] Test in browser: `https://localhost`
- [ ] Verify SSL certificate in browser
- [ ] Test API endpoints through nginx
- [ ] Test WebSocket connections (if applicable)
- [ ] Verify static assets load correctly
- [ ] Check response headers include security headers

### 7. Security Verification
- [ ] SSL certificates are NOT in version control
- [ ] Private keys have restricted permissions
- [ ] Security headers are present in responses
- [ ] HTTPS redirect is working
- [ ] TLS 1.2+ is enforced
- [ ] Strong cipher suites are configured
- [ ] Review nginx logs for anomalies

### 8. Performance Checks
- [ ] Gzip compression is working
- [ ] Static assets are being cached
- [ ] HTTP/2 is enabled
- [ ] Response times are acceptable
- [ ] Test under load (if applicable)

### 9. Monitoring Setup
- [ ] Configure log rotation
- [ ] Set up health check monitoring
- [ ] Configure alerts for service failures
- [ ] Set up SSL certificate expiry monitoring
- [ ] Configure backup procedures

### 10. Documentation
- [ ] Document any custom configuration changes
- [ ] Update deployment procedures
- [ ] Document SSL certificate renewal process
- [ ] Create runbooks for common issues

## Post-Deployment Checklist

### Immediate (First 24 Hours)
- [ ] Monitor logs continuously
- [ ] Check error rates
- [ ] Verify certificate is trusted by browsers
- [ ] Test all major user flows
- [ ] Verify backend connectivity

### Short Term (First Week)
- [ ] Review access logs
- [ ] Check SSL Labs rating: https://www.ssllabs.com/ssltest/
- [ ] Verify certificate auto-renewal (if using Let's Encrypt)
- [ ] Test failover scenarios
- [ ] Review performance metrics

### Ongoing
- [ ] Regular security updates for Docker images
- [ ] Monitor certificate expiry dates
- [ ] Review and rotate logs
- [ ] Keep nginx configuration updated
- [ ] Backup certificates and configuration

## Rollback Plan

If issues occur:

1. **Immediate Rollback to HTTP**
   ```bash
   docker-compose down
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

2. **Investigate Issues**
   ```bash
   docker-compose logs --tail=100 nginx
   docker-compose logs --tail=100 frontend
   ```

3. **Test nginx configuration**
   ```bash
   docker-compose exec nginx nginx -t
   ```

4. **Restore from backup** (if available)

## Common Issues and Solutions

### Issue: Certificate not trusted
**Solution:** For production, use Let's Encrypt or trusted CA. For development, accept the self-signed certificate warning.

### Issue: Port already in use
**Solution:** 
- Stop conflicting service
- Or change port mapping in docker-compose.yml

### Issue: Cannot connect to frontend
**Solution:**
- Check frontend health: `docker-compose ps`
- Verify frontend logs: `docker-compose logs frontend`
- Test direct access: `docker-compose exec nginx curl http://frontend:3000`

### Issue: SSL handshake failures
**Solution:**
- Verify certificate files exist and have correct permissions
- Check nginx error logs
- Validate certificate: `openssl x509 -in nginx/ssl/cert.pem -text -noout`

## Validation Commands

```bash
# Validate entire setup
./scripts/validate-https-setup.sh

# Check docker-compose configuration
docker-compose config

# Test nginx configuration
docker-compose exec nginx nginx -t

# Check certificate details
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect localhost:443 -servername localhost

# Check security headers
curl -I -k https://localhost

# Monitor logs in real-time
docker-compose logs -f nginx frontend
```

## Useful Resources

- [HTTPS Setup Guide](./HTTPS_SETUP.md) - Comprehensive documentation
- [Changes Summary](./HTTPS_CHANGES_SUMMARY.md) - What was modified
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [SSL Labs Testing](https://www.ssllabs.com/ssltest/)

## Support

For issues or questions:
1. Review logs: `docker-compose logs nginx frontend`
2. Check documentation in `docs/` directory
3. Run validation: `./scripts/validate-https-setup.sh`
4. Test nginx config: `docker-compose exec nginx nginx -t`

---

**Note:** Keep this checklist updated as your infrastructure evolves.
