import express from "express";
import { authService } from "../services/auth_service";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/roles.middleware";
import { logger } from "../utils/logger";
import { getCookieOptions, getClearCookieOptions } from "../config/cookie.config";
const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   get:
 *     tags: [Auth]
 *     summary: Initiate Keycloak login
 *     description: Redirects user to Keycloak login page for authentication
 *     responses:
 *       302:
 *         description: Redirect to Keycloak login
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
//redirect login
router.get("/login", (req, res) => {
  try {
    const url = authService.getLoginUrl();
    logger.info('Auth login redirect', { service: 'auth', redirectUrl: url });
    return res.redirect(url);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Error generating login URL', error, { service: 'auth' });
    return res.status(500).json({ error: 'Failed to generate login URL', message: error.message });
  }
});

/**
 * @swagger
 * /api/auth/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Handle Keycloak OAuth callback
 *     description: Processes Keycloak authentication callback, exchanges code for tokens, and sets authentication cookies
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth authorization code from Keycloak
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication cookies set
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *             description: Authentication cookies (user_id, username, email, accessToken, refreshToken, expiresAt)
 *       500:
 *         description: Authentication failed
 */
//callback
router.get("/callback", async (req: any, res) => {
  try {
    const { code } = req.query;
    
    // Comprehensive request logging
    logger.info('🔍 Auth Callback - Full Request Analysis', {
      service: 'auth',
      code: code ? '***' : 'missing',
      protocol: req.protocol,
      secure: req.secure,
      forwardedProto: req.headers['x-forwarded-proto'],
      host: req.headers.host,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent'],
      connection: req.headers.connection,
      upgradeInsecure: req.headers['upgrade-insecure-requests'],
      acceptLanguage: req.headers['accept-language'],
      existingCookies: req.headers.cookie || 'none',
      url: req.url,
      baseUrl: req.baseUrl,
      originalUrl: req.originalUrl,
    });
    
    logger.info('Auth callback received', {
      service: 'auth',
      code: code ? '***' : 'missing',
      protocol: req.protocol,
      secure: req.secure,
      forwardedProto: req.headers['x-forwarded-proto'],
      host: req.headers.host,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
    });
    
    const tokenResponse = await authService.handleCallback(code);
    
    logger.info('Token response received', {
      service: 'auth',
      hasAccessToken: !!tokenResponse.tokens.access_token,
      hasRefreshToken: !!tokenResponse.tokens.refresh_token,
      userId: tokenResponse.user.id,
      username: tokenResponse.user.username,
    });
    
    // Get cookie options for cross-origin requests (auto-detects HTTPS)
    const cookieOptions = getCookieOptions(req);
    
    // Set cookies with detailed logging
    const cookiesToSet = [
      { name: 'user_id', value: tokenResponse.user.id },
      { name: 'username', value: tokenResponse.user.username },
      { name: 'email', value: tokenResponse.user.email },
      { name: 'accessToken', value: tokenResponse.tokens.access_token },
      { name: 'refreshToken', value: tokenResponse.tokens.refresh_token },
      { name: 'expiresAt', value: tokenResponse.tokens.expires_in },
    ];
    
    cookiesToSet.forEach(({ name, value }) => {
      res.cookie(name, value, cookieOptions);
      logger.info(`Setting cookie: ${name}`, {
        service: 'auth',
        cookieName: name,
        valueLength: String(value).length,
        options: cookieOptions,
      });
    });
    
    // Log actual Set-Cookie headers before redirect
    const setCookieHeaders = res.getHeader('Set-Cookie');
    logger.info('🔍 Actual Set-Cookie Headers Before Redirect', {
      service: 'auth',
      headers: setCookieHeaders,
      headerCount: Array.isArray(setCookieHeaders) ? setCookieHeaders.length : (setCookieHeaders ? 1 : 0),
    });
    
    // Log all response headers for debugging
    const allHeaders = {
      'set-cookie': res.getHeader('Set-Cookie'),
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials'),
      'location': res.getHeader('Location'),
      'content-type': res.getHeader('Content-Type'),
      'cache-control': res.getHeader('Cache-Control'),
    };
    
    logger.info('🔍 All Response Headers Before Redirect', {
      service: 'auth',
      statusCode: res.statusCode || 302,
      headers: allHeaders,
    });
    
    // Validate cookie format
    if (Array.isArray(setCookieHeaders)) {
      setCookieHeaders.forEach((header, index) => {
        const hasSecure = header.includes('Secure');
        const hasSameSite = header.includes('SameSite');
        const sameSiteValue = header.match(/SameSite=(\w+)/)?.[1];
        const hasPath = header.includes('Path=/');
        const hasMaxAge = header.includes('Max-Age');
        const cookieName = header.split('=')[0];
        
        logger.info(`🔍 Cookie Header Validation [${index + 1}/${setCookieHeaders.length}]`, {
          service: 'auth',
          cookieName,
          hasSecure,
          hasSameSite,
          sameSiteValue,
          hasPath,
          hasMaxAge,
          headerLength: header.length,
          headerPreview: header.substring(0, 100) + '...',
        });
      });
    }
    
    const redirectUrl = process.env.FRONTEND_URL || "http://localhost:3000/";
    logger.info('Redirecting after auth', {
      service: 'auth',
      redirectUrl,
      cookiesSet: cookiesToSet.length,
    });
    
    // Check for potential cross-origin issues
    const requestOrigin = req.headers.origin || req.headers.referer;
    const redirectOrigin = new URL(redirectUrl).origin;
    const isCrossOrigin = requestOrigin && !requestOrigin.includes(redirectOrigin);
    
    if (isCrossOrigin) {
      logger.warn('⚠️  Cross-Origin Redirect Detected', {
        service: 'auth',
        requestOrigin,
        redirectOrigin,
        warning: 'Cookies may be blocked by browser. CRITICAL: User must trust the SSL certificate by visiting the backend URL directly first!',
        solution: `Visit https://10.157.150.207:3001/health in browser and accept the certificate warning before testing login.`,
      });
    }
    
    // Check if this is likely to fail
    const backendHost = req.headers.host;
    const frontendHost = new URL(redirectUrl).host;
    if (backendHost !== frontendHost) {
      logger.error(
        '🚨 COOKIE BLOCKING LIKELY - Different Hosts',
        undefined,
        { service: 'auth' },
        {
          backendHost,
          frontendHost,
          issue: 'Cookies set on one host cannot be read by another host',
          solution: 'User MUST visit backend URL and trust certificate: https://' + backendHost + '/health',
        }
      );
    }
    
    logger.info('🚀 Sending Redirect Response', {
      service: 'auth',
      statusCode: 302,
      location: redirectUrl,
      cookieCount: cookiesToSet.length,
    });
    
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Auth callback error', error instanceof Error ? error : new Error(String(error)), { service: 'auth' });
    return res.status(500).send("Authentication failed");
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   get:
 *     tags: [Auth]
 *     summary: Logout user
 *     description: Clears all authentication cookies and redirects to frontend
 *     responses:
 *       302:
 *         description: Redirect to frontend after clearing cookies
 *       500:
 *         description: Logout failed
 */
router.get("/logout", (req, res) => {
  try {
    logger.info('Logout requested', {
      service: 'auth',
      existingCookies: Object.keys(req.cookies || {}),
      protocol: req.protocol,
      secure: req.secure,
    });
    
    // Clear all authentication cookies (auto-detects HTTPS)
    const clearOptions = getClearCookieOptions(req);
    const cookiesToClear = ['session', 'user_id', 'username', 'email', 'accessToken', 'refreshToken', 'expiresAt'];
    
    cookiesToClear.forEach(cookieName => {
      res.clearCookie(cookieName, clearOptions);
      logger.info(`Clearing cookie: ${cookieName}`, {
        service: 'auth',
        cookieName,
        clearOptions,
      });
    });
    
    const redirectUrl = process.env.FRONTEND_URL || "http://localhost:5173/";
    logger.info('Redirecting after logout', {
      service: 'auth',
      redirectUrl,
      cookiesCleared: cookiesToClear.length,
    });
    
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error("Error during logout", error as Error, { service: 'auth' });
    return res.status(500).send("Logout failed");
  }
});

/**
 * @swagger
 * /api/auth/refreshToken:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Exchanges refresh token for new access and refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: New tokens generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *                     expires_in:
 *                       type: integer
 *       400:
 *         description: Refresh token missing
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/refreshToken", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    logger.info('Token refresh requested', {
      service: 'auth',
      hasRefreshToken: !!refreshToken,
      existingCookies: Object.keys(req.cookies || {}),
      protocol: req.protocol,
      secure: req.secure,
    });
    
    if (!refreshToken) {
      logger.warn('Refresh token missing', { service: 'auth' });
      return res.status(400).json({ error: "Refresh token is required" });
    }
    
    const tokenResponse = await authService.refreshToken(refreshToken);
    
    logger.info('New tokens generated', {
      service: 'auth',
      hasAccessToken: !!tokenResponse.access_token,
      hasRefreshToken: !!tokenResponse.refresh_token,
    });
    
    // Get cookie options for cross-origin requests (auto-detects HTTPS)
    const cookieOptions = getCookieOptions(req);
    
    res.cookie("accessToken", tokenResponse.access_token, cookieOptions);
    res.cookie("refreshToken", tokenResponse.refresh_token, cookieOptions);
    res.cookie("expiresAt", tokenResponse.expires_in, cookieOptions);
    
    logger.info('Refresh tokens set as cookies', {
      service: 'auth',
      cookiesSet: ['accessToken', 'refreshToken', 'expiresAt'],
      options: cookieOptions,
    });
    
    return res.json({ data: tokenResponse });
  } catch (error) {
    logger.error("Error refreshing token", error as Error, { service: 'auth' });
    return res.status(500).json({ error: "Failed to refresh token" });
  }
});

/**
 * @swagger
 * /api/auth/userinfo:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user information
 *     description: Retrieves authenticated user details from Keycloak
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/AuthUser'
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Access token required
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
//user info
router.get("/userinfo", requireAuth, async (req: any, res) => {
  try {
    const accessToken = req.headers.authorization?.split(" ")[1] || req.cookies["accessToken"];
    if (!accessToken) {
      return res.status(401).json({ error: "Access token is required" });
    }
    const roles = (req as any).user?.roles || [];
    const userInfo = await authService.getUserInfo(accessToken);
    return res.json({ data: userInfo, roles });
  } catch (error) {
    logger.error("Error fetching user info", error as Error, { service: 'auth' });
    return res.status(500).json({ error: "Failed to fetch user info" });
  }
});

export default router;
