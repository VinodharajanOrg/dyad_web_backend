import dotenv from 'dotenv';
dotenv.config();

export const Config = {
    provider: process.env.AUTH_PROVIDER || 'keycloak',
    port: process.env.PORT || 3000,
    auth:{
    issuerUrl: process.env.AUTH_ISSUER_URL || '',
    clientId: process.env.AUTH_CLIENT_ID || '',
    clientSecret: process.env.AUTH_CLIENT_SECRET || '',
    redirectUri: process.env.AUTH_REDIRECT_URI || '',
    tokenEndpoint: process.env.AUTH_TOKEN_ENDPOINT || '',
    userInfoEndpoint: process.env.AUTH_USERINFO_ENDPOINT || '',
    }
};