import { AuthFactory } from "../auth/AuthFactory";
const provider = AuthFactory.createAuthProvider();
import { userStore } from "../db/stores/user.store";
import { sessionStore } from "../db/stores/session.store";
import jwt from "jsonwebtoken";

export class AuthService {
  private userStore = userStore;
  private sessionStore = sessionStore;

  public getLoginUrl(): string {
    return provider.getLoginUrl();
  }

  // public getLogoutUrl(postLogoutRedirectUri?: string, idTokenHint?: string): string {
  //   console.log('Generating logout URL with postLogoutRedirectUri:', postLogoutRedirectUri, 'and idTokenHint:', idTokenHint);
  //   return provider.getLogoutUrl()
  // }
  async handleCallback(code: string) {
    try{
    if (!code) {
      throw new Error("Authorization code is required");
    }
    const ssoUser = await provider.exchangeCodeForToken(code);
    const { id_token } = ssoUser; // tokenResponse from Keycloak

    // Decode the ID token (do not verify here, just decode for sub)
    const decoded: any = jwt.decode(id_token);
    const sub = decoded.sub;
    ssoUser.providerUserId = sub;
    //upsert user in db
    //take provider name from local
    const Authprovider = process.env.AUTH_PROVIDER || "keycloak";
    ssoUser.provider = Authprovider;

    let [user] = await userStore.getUserById(
      ssoUser.providerUserId,
      ssoUser.provider
    );

    let created = false;
    if (!user) {
      const newUser = await this.userStore.createUser({
        providerUserId: ssoUser.providerUserId,
        provider: ssoUser.provider,
        username: decoded.name || "Unnamed",
        email: decoded.email,
      });
      user = newUser[0];
      created = true;
    }
    let expiresAtValue = ssoUser.expires_in;
    let expiresAtDate =
      typeof expiresAtValue === "number"
        ? new Date(expiresAtValue * 1000)
        : new Date(expiresAtValue);
    //create session
    await this.sessionStore.createSession({
      userId: user.id,
      provider: process.env.AUTH_PROVIDER || "keycloak",
      accessToken: ssoUser.access_token,
      refreshToken: ssoUser.refresh_token,
      sessionToken: ssoUser.session_state,
      expiresAt: expiresAtDate,
    });

    return { user, created, tokens: ssoUser };
  } catch (error) {
    console.error("Error in handleCallback:", error);
    throw error;
  }
  }

  async getUserInfo(accessToken: string) {
    if (!accessToken) {
      throw new Error("Access token is required");
    }
    return await provider.getUserInfo(accessToken);
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }
    return await provider.refreshToken(refreshToken);
  }

  verifyAccessToken() {
    return provider.verifyToken();
  }
  requireRoles(...roles: string[]) {
    return provider.requireRoles(...roles);
  }
}
export const authService = new AuthService();
