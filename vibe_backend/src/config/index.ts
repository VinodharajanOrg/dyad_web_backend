import dotenv from 'dotenv';
dotenv.config();

const azureAdTenantId = process.env.AZURE_AD_TENANT_ID || '';

export const Config = {
    provider: process.env.AUTH_PROVIDER || 'azure_ad',
    port: process.env.PORT || 3000,
    auth:{
    tokenEndpoint: process.env.AUTH_TOKEN_ENDPOINT || '',
    userInfoEndpoint: process.env.AUTH_USERINFO_ENDPOINT || '',
    azureAdClientId: process.env.AZURE_AD_CLIENT_ID || '',
    azureAdTenantId: azureAdTenantId,
    azureAdClientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
    azureAdBackendClientId: process.env.AZURE_AD_BACKEND_CLIENT_ID || '',
    azureAdRedirectUri: process.env.AZURE_AD_REDIRECT_URI || '',
    azureAdAuthorityUrl: `https://login.microsoftonline.com/${azureAdTenantId}`,
    azureAdJwksUri: `https://login.microsoftonline.com/${azureAdTenantId}/discovery/v2.0/keys`,
    azureAdIssuer: `https://sts.windows.net/${azureAdTenantId}/`,
    }
};