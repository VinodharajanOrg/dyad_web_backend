import axios from "axios";
import jwt from "jsonwebtoken";
import { IAuthProvider } from "../IAuthProvider";
import { Request, Response, NextFunction } from "express";
import { AuthConfig } from "../../types/auth.config.interface";
import { logger } from "../../utils/logger";
import jwksRsa from "jwks-rsa";

export class OAuthProvider implements IAuthProvider {
  private readonly config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  getLoginUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.azureAdClientId,
      response_type: "code",
      redirect_uri: this.config.azureAdRedirectUri,
      response_mode: "query",
      scope: [
        "openid",
        "profile",
        "offline_access",
        `api://${this.config.azureAdBackendClientId}/.default`,
      ].join(" "),
      state: "xyz",
    });

    return `${this.config.azureAdAuthorityUrl}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    const tokenUrl = `${this.config.azureAdAuthorityUrl}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: this.config.azureAdClientId,
      client_secret: this.config.azureAdClientSecret,
      scope: [
        "openid",
        "profile",
        "offline_access",
        `api://${this.config.azureAdBackendClientId}/.default`,
      ].join(" "),
    });
    const response = await axios.post(tokenUrl, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const { access_token, refresh_token, expires_in, id_token } = response.data;

    if (!id_token) {
      throw new Error("ID token is missing from the token response");
    }

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      idToken: id_token,
    };
  }
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const decoded = jwt.decode(accessToken);
      if (!decoded) {
        throw new Error("Failed to decode access token");
      }
      return decoded;
    } catch (error) {
      console.error("Error decoding access token:", error);
      throw new Error("Invalid access token");
    }
  }
  async refreshToken(refreshToken: string): Promise<any> {
    const tokenUrl = `${this.config.azureAdAuthorityUrl}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.azureAdClientId,
      client_secret: this.config.azureAdClientSecret,
    });
    const response = await axios.post(tokenUrl, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data;
  }
  verifyToken() {
    const API_AUDIENCE = `api://${this.config.azureAdBackendClientId}`;

    // Azure signing keys (v1 + v2 compatible)
    const client = jwksRsa({
      jwksUri: this.config.azureAdJwksUri,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
    });

    const getKey = (header: jwt.JwtHeader, callback: jwt.SignCallback) => {
      client.getSigningKey(header.kid!, function (err, key) {
        if (err) {
          callback(err, undefined);
        } else {
          const signingKey = key?.getPublicKey();
          callback(null, signingKey);
        }
      });
    };
    // Import userStore here to avoid circular dependency
    const { userStore } = require("../../db/stores/user.store");
    const provider = process.env.AUTH_PROVIDER || "azure_ad";
    const issuer = this.config.azureAdIssuer;
    return async (req: Request, res: Response, next: NextFunction) => {
      const auth = req.headers.authorization;
      if (!auth) {
        return res.status(401).json({ error: "No authorization header" });
      }
      const token = auth.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ["RS256"],
          issuer: issuer,
          audience: API_AUDIENCE,
        },
        async (err, decoded: any) => {
          if (err) {
            console.error("JWT VERIFY ERROR:", err);
            return res
              .status(401)
              .json({ error: "Invalid token", details: err.message });
          }
          // Attach decoded token to req.user
          (req as any).user = decoded;
          // Get providerUserId (sub) and provider
          const providerUserId = decoded.oid;
          if (providerUserId) {
            try {
              let [user] = await userStore.getUserById(
                providerUserId,
                provider,
              );

              if (user && user.id) {
                (req as any).user.id = user.id;
              }
              const roles = decoded.realm_access?.roles || decoded.roles || [];
              (req as any).user.roles = roles;
            } catch (dbErr) {
              // Log but do not block auth if DB fails
              logger.error(
                "Failed to fetch/create user from DB in auth middleware:",
                dbErr as Error,
              );
            }
          }
          next();
        },
      );
    };
  }
  requireRoles(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userRoles = user.roles || [];
      const clientRoles: string[] =
        user.resource_access &&
        user.resource_access?.[this.config.azureAdClientId]
          ? user.resource_access[this.config.azureAdClientId].roles
          : [];
      userRoles.push(...clientRoles);
      const hasRole = roles.some((role) => userRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({ error: "Forbidden: Insufficient role" });
      }
      next();
    };
  }
}
