# HTTPS Cookie Configuration Guide

## Issue
Cookies are not being stored in browser when using HTTPS.

## Root Cause
For cookies to work with HTTPS in cross-origin scenarios, they need:
- `secure: true` flag
- `sameSite: 'none'` attribute
- HTTPS connection for both frontend and backend

## Solution Implemented

### 1. Updated Cookie Configuration
The cookie configuration now auto-detects HTTPS based on:
- Request protocol (`req.protocol`)
- `X-Forwarded-Proto` header (for proxied requests)
- `req.secure` flag
- `USE_HTTPS` environment variable

### 2. Environment Configuration

Add to your `.env` file:
```env
USE_HTTPS=true
```

Update URLs to use HTTPS:
```env
AUTH_ISSUER_URL=https://localhost:8080/realms/vibe-web
AUTH_REDIRECT_URI=https://localhost:3001/api/auth/callback
FRONTEND_URL=https://localhost:3000
```

### 3. Setup HTTPS

You have three options:

#### Option A: Use HTTPS Proxy (Recommended for Development)
If using nginx, add SSL configuration:

```nginx
server {
    listen 443 ssl;
    server_name localhost;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Proxy settings...
}
```

#### Option B: Express HTTPS Server
Create self-signed certificate:
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

Then update your server:
```typescript
import https from 'https';
import fs from 'fs';

const httpsOptions = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

const server = https.createServer(httpsOptions, app);
```

#### Option C: Use localhost with HTTP (Development Only)
For `localhost`, browsers allow cookies without HTTPS:
- Keep URLs as `http://localhost:*`
- Set `USE_HTTPS=false`
- Cookies will work with `sameSite: 'lax'`

### 4. Verify Cookie Settings

Check browser DevTools → Network → Response Headers for Set-Cookie:
```
Set-Cookie: accessToken=...; Path=/; Max-Age=86400; Secure; SameSite=None
```

For HTTPS, you should see:
- ✅ `Secure` flag
- ✅ `SameSite=None`

For HTTP localhost, you should see:
- ✅ `SameSite=Lax`
- ❌ No `Secure` flag

### 5. Frontend Requirements

Ensure your frontend sends credentials:

**Fetch API:**
```javascript
fetch('https://localhost:3001/api/...', {
  credentials: 'include'
})
```

**Axios:**
```javascript
axios.get('https://localhost:3001/api/...', {
  withCredentials: true
})
```

### 6. Debug Logging

Debug middleware has been added. Check your server logs for:
```
Cookie Debug Info:
  protocol: https
  isSecure: true
  forwardedProto: https
  host: localhost:3001
  origin: https://localhost:3000
```

## Testing

1. **Clear existing cookies**:
   - Open DevTools → Application → Cookies
   - Delete all cookies for localhost

2. **Test authentication**:
   ```bash
   curl -v https://localhost:3001/api/auth/login
   ```
   Check for `Set-Cookie` headers in response

3. **Verify cookie storage**:
   - After login, check DevTools → Application → Cookies
   - Should see: user_id, username, email, accessToken, refreshToken, expiresAt

4. **Test cookie sending**:
   ```bash
   curl -v --cookie "accessToken=..." https://localhost:3001/api/auth/userinfo
   ```

## Common Issues

### Issue: "Cookie has been rejected because it is in a cross-site context"
**Solution**: Ensure both frontend and backend use HTTPS with `sameSite: 'none'`

### Issue: Certificate warnings in browser
**Solution**: 
- Accept self-signed certificate warning (Development only)
- Or add certificate to system trust store
- Or use valid SSL certificate

### Issue: Cookies work in Postman but not browser
**Solution**: 
- Check CORS origin includes your frontend URL
- Ensure frontend sends `credentials: 'include'`
- Verify `sameSite` attribute matches your setup

### Issue: Mixed content warning
**Solution**: Ensure ALL resources (frontend, backend, API calls) use HTTPS

## Environment Variable Summary

```env
# Enable HTTPS mode
USE_HTTPS=true

# Or for localhost development without SSL
USE_HTTPS=false

# Node environment
NODE_ENV=development  # Uses config from USE_HTTPS
NODE_ENV=production   # Always uses HTTPS settings
```

## Rollback to HTTP (Development Only)

If HTTPS is causing issues in development:

1. Update `.env`:
```env
USE_HTTPS=false
AUTH_ISSUER_URL=http://localhost:8080/realms/vibe-web
AUTH_REDIRECT_URI=http://localhost:3001/api/auth/callback
FRONTEND_URL=http://localhost:3000
```

2. Restart server

3. Cookies will use `sameSite: 'lax'` and `secure: false`
