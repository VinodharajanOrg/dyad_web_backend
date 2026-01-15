import express from "express";
import { authService } from "../services/auth_service";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/roles.middleware";
import { logger } from "../utils/logger";
import { getCookieOptions, getClearCookieOptions } from "../config/cookie.config";
const router = express.Router();

//redirect logind:\work\POC\dyad\backend\src\routes\auth.ts
router.get("/login", (req, res) => {
  const url = authService.getLoginUrl();
  return res.redirect(url);
});
//callback
router.get("/callback", async (req: any, res) => {
  try {
    const { code } = req.query;
    
    logger.info('Auth callback received', null, {
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
    
    logger.info('Token response received', null, {
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
      logger.info(`Setting cookie: ${name}`, null, {
        service: 'auth',
        cookieName: name,
        valueLength: String(value).length,
        options: cookieOptions,
      });
    });
    
    const redirectUrl = process.env.FRONTEND_URL || "http://localhost:3000/";
    logger.info('Redirecting after auth', null, {
      service: 'auth',
      redirectUrl,
      cookiesSet: cookiesToSet.length,
    });
    
    return res.redirect(redirectUrl);
  } catch (error) {
    return res.status(500).send("Authentication failed");
  }
});

router.get("/logout", (req, res) => {
  try {
    logger.info('Logout requested', null, {
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
      logger.info(`Clearing cookie: ${cookieName}`, null, {
        service: 'auth',
        cookieName,
        clearOptions,
      });
    });
    
    const redirectUrl = process.env.FRONTEND_URL || "http://localhost:5173/";
    logger.info('Redirecting after logout', null, {
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

router.post("/refreshToken", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    logger.info('Token refresh requested', null, {
      service: 'auth',
      hasRefreshToken: !!refreshToken,
      existingCookies: Object.keys(req.cookies || {}),
      protocol: req.protocol,
      secure: req.secure,
    });
    
    if (!refreshToken) {
      logger.warn('Refresh token missing', null, { service: 'auth' });
      return res.status(400).json({ error: "Refresh token is required" });
    }
    
    const tokenResponse = await authService.refreshToken(refreshToken);
    
    logger.info('New tokens generated', null, {
      service: 'auth',
      hasAccessToken: !!tokenResponse.access_token,
      hasRefreshToken: !!tokenResponse.refresh_token,
    });
    
    // Get cookie options for cross-origin requests (auto-detects HTTPS)
    const cookieOptions = getCookieOptions(req);
    
    res.cookie("accessToken", tokenResponse.access_token, cookieOptions);
    res.cookie("refreshToken", tokenResponse.refresh_token, cookieOptions);
    res.cookie("expiresAt", tokenResponse.expires_in, cookieOptions);
    
    logger.info('Refresh tokens set as cookies', null, {
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
