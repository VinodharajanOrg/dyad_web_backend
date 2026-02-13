export interface AuthConfig {
    tokenEndpoint: string;
    userInfoEndpoint: string;
    azureAdClientId: string;
    azureAdTenantId: string;
    azureAdClientSecret: string;
    azureAdBackendClientId: string;
    azureAdRedirectUri: string;
    azureAdAuthorityUrl: string;
    azureAdJwksUri: string;
    azureAdIssuer: string;
}