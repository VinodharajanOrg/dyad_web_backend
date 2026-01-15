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
    const tokenResponse = await authService.handleCallback(code);
    
    // Get cookie options for cross-origin requests
    const cookieOptions = getCookieOptions();
    
    res.cookie("user_id", tokenResponse.user.id, cookieOptions);
    res.cookie("username", tokenResponse.user.username, cookieOptions);
    res.cookie("email", tokenResponse.user.email, cookieOptions);
    res.cookie("accessToken", tokenResponse.tokens.access_token, cookieOptions);
    res.cookie("refreshToken", tokenResponse.tokens.refresh_token, cookieOptions);
    res.cookie("expiresAt", tokenResponse.tokens.expires_in, cookieOptions);
    
    return res.redirect(process.env.FRONTEND_URL || "http://localhost:3000/");
  } catch (error) {
    return res.status(500).send("Authentication failed");
  }
});

router.get("/logout", (req, res) => {
  try {
    // Clear all authentication cookies
    const clearOptions = getClearCookieOptions();
    res.clearCookie("session", clearOptions);
    res.clearCookie("user_id", clearOptions);
    res.clearCookie("username", clearOptions);
    res.clearCookie("email", clearOptions);
    res.clearCookie("accessToken", clearOptions);
    res.clearCookie("refreshToken", clearOptions);
    res.clearCookie("expiresAt", clearOptions);
    return res.redirect(process.env.FRONTEND_URL || "http://localhost:5173/");
  } catch (error) {
    logger.error("Error during logout", error as Error, { service: 'auth' });
    return res.status(500).send("Logout failed");
  }
});

router.post("/refreshToken", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }
    const tokenResponse = await authService.refreshToken(refreshToken);
    
    // Get cookie options for cross-origin requests
    const cookieOptions = getCookieOptions();
    
    res.cookie("accessToken", tokenResponse.access_token, cookieOptions);
    res.cookie("refreshToken", tokenResponse.refresh_token, cookieOptions);
    res.cookie("expiresAt", tokenResponse.expires_in, cookieOptions);
    
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
