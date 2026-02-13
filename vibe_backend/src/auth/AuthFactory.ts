import { OAuthProvider } from "../auth/providers/oauth.provider";
import { Config } from "../config/index";
import { AuthConfig } from "../types/auth.config.interface";

export class AuthFactory {
    static createAuthProvider(): OAuthProvider {
        const authConfig: AuthConfig = {
            tokenEndpoint: Config.auth.tokenEndpoint,
            userInfoEndpoint: Config.auth.userInfoEndpoint,
            azureAdClientId: Config.auth.azureAdClientId,
            azureAdTenantId: Config.auth.azureAdTenantId,
            azureAdClientSecret: Config.auth.azureAdClientSecret,
            azureAdBackendClientId: Config.auth.azureAdBackendClientId,
            azureAdRedirectUri: Config.auth.azureAdRedirectUri,
            azureAdAuthorityUrl: Config.auth.azureAdAuthorityUrl,
            azureAdJwksUri: Config.auth.azureAdJwksUri,
            azureAdIssuer: Config.auth.azureAdIssuer,
        };
       
        return new OAuthProvider(authConfig);
    }
}