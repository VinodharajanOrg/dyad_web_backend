import express from "express";
import { authService } from "../services/auth_service";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRoles } from "../middleware/roles.middleware";
import { logger } from "../utils/logger";
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
    
    res.cookie("user_id", tokenResponse.user.id, {
      httpOnly: false,
      secure: false,
      path: "/",
    });
    res.cookie("username", tokenResponse.user.username, {
      httpOnly: false,
      secure: false,
      path: "/",
    });
    res.cookie("email", tokenResponse.user.email, {
      httpOnly: false,
      secure: false,
      path: "/",
    });
    res.cookie("accessToken", tokenResponse.tokens.access_token, {
      httpOnly: false,
      secure: false,
      path: "/",
    });
    res.cookie("refreshToken", tokenResponse.tokens.refresh_token, {
      httpOnly: false,
      secure: false,
      path: "/",
    });
    res.cookie(
      "expiresAt",
      tokenResponse.tokens.expires_in,
      { httpOnly: false, secure: false, path: "/" }
    );
    return res.redirect(process.env.FRONTEND_URL || "http://localhost:3000/");
  } catch (error) {
    return res.status(500).send("Authentication failed");
  }
});

router.get("/logout", (req, res) => {
  try {
    // Clear session cookie
    res.clearCookie("session", { path: "/" });
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
        // Set cookies like callback
    res.cookie("accessToken", tokenResponse.access_token, {
      httpOnly: false,
      secure: false,
      path: "/",
    });
    res.cookie("refreshToken", tokenResponse.refresh_token, {
      httpOnly: false,
      secure: false,
      path: "/",
    });
    res.cookie(
      "expiresAt",
      tokenResponse.expires_in,
      { httpOnly: false, secure: false, path: "/" }
    );
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
