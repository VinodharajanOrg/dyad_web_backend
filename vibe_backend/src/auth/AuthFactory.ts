import { OAuthProvider } from "../auth/providers/oauth.provider";
import { Config } from "../config/index";
import { AuthConfig } from "../types/auth.config.interface";

export class AuthFactory {
    static createAuthProvider(): OAuthProvider {
        const authConfig: AuthConfig = {
            issuer: Config.auth.issuerUrl,
            clientId: Config.auth.clientId,
            clientSecret: Config.auth.clientSecret, 
            redirectUri: Config.auth.redirectUri,
            tokenEndpoint: Config.auth.tokenEndpoint,
            userInfoEndpoint: Config.auth.userInfoEndpoint,
        };
       
        return new OAuthProvider(authConfig);
    }
}