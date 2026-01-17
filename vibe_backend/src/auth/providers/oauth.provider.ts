import axios from 'axios';
import jwt from 'jsonwebtoken';
import jwtClient from 'jwks-rsa';
import { IAuthProvider } from '../IAuthProvider';
import { Request, Response, NextFunction } from 'express';
import { AuthConfig } from '../../types/auth.config.interface';
import { logger } from '../../utils/logger';

export class OAuthProvider implements IAuthProvider {
    private readonly config: AuthConfig;
    private readonly client: jwtClient.JwksClient;

    constructor(config: AuthConfig) {
        this.config = config;
        this.client = jwtClient({
            jwksUri: `${this.config.issuer}/protocol/openid-connect/certs`
        }); 
    }
    private buildUrl(endpoint: string): string {
        return `${this.config.issuer}${endpoint}`;
    }

    getLoginUrl(): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,    
            response_type: 'code',
            scope: 'openid',
            redirect_uri: this.config.redirectUri
        });
        return `${this.config.issuer.replace(/\/$/, '')}/protocol/openid-connect/auth?${params.toString()}`;
    }

//     getLogoutUrl(postLogoutRedirectUri?: string, idTokenHint?: string): string {
//     console.log('Generating logout URL with postLogoutRedirectUri:', postLogoutRedirectUri, 'and idTokenHint:', idTokenHint);
//     const params: any = {};
//     if (postLogoutRedirectUri) {
//         params.post_logout_redirect_uri = postLogoutRedirectUri;
//     }
//     if (idTokenHint) {
//         params.id_token_hint = idTokenHint;
//     }
//     const query = new URLSearchParams(params).toString();
//     return `${this.config.issuer.replace(/\/$/, '')}/protocol/openid-connect/logout${query ? '?' + query : ''}`;
// }

    async exchangeCodeForToken(code: string): Promise<any> {
        const tokenUrl = this.buildUrl(this.config.tokenEndpoint);
        const body = new URLSearchParams({  
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.config.redirectUri,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret
        });
        const response = await axios.post(tokenUrl, body.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded' 
            }
        });
        return response.data;
    }
    async getUserInfo(accessToken: string): Promise<any> {
        const userInfoUrl = this.buildUrl(this.config.userInfoEndpoint);
        const response = await axios.get(userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    }   
    async refreshToken(refreshToken: string): Promise<any> {            
        const tokenUrl = this.buildUrl(this.config.tokenEndpoint);          
        const body = new URLSearchParams({
            grant_type: 'refresh_token',    
            refresh_token: refreshToken,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret
        });
        const response = await axios.post(tokenUrl, body.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    }   
    verifyToken() {
        const jwksurl = `${this.config.issuer}/protocol/openid-connect/certs`;
        const client = jwtClient({
            jwksUri: jwksurl
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
        }   
        // Import userStore here to avoid circular dependency
        const { userStore } = require("../../db/stores/user.store");
        return async (req: Request, res: Response, next: NextFunction) => {
            const auth = req.headers.authorization;
            if (!auth) {
                return res.status(401).json({ error: "No authorization header" });
            }
            const token = auth.split(" ")[1];
            if (!token) {
                return res.status(401).json({ error: "No token provided" });
            }
            jwt.verify(token, getKey, {}, async (err, decoded: any) => {
                if (err) {
                    logger.error("JWT VERIFY ERROR", err as Error, { service: 'oauth-provider' });
                    return res.status(401).json({ error: "Invalid token", details: err.message });
                }
                    // ADD THIS TO CHECK TOKEN ISSUER
                     logger.debug("JWT ISSUER", { service: 'oauth-provider', issuer: decoded.iss });

                // Attach decoded token to req.user
                (req as any).user = decoded;
                // Get providerUserId (sub) and provider
                const providerUserId = decoded.sub;
                const provider = process.env.AUTH_PROVIDER || 'keycloak';
                if (providerUserId) {
                    try {
                        const [user] = await userStore.getUserById(providerUserId, provider);
                        if (user && user.id) {
                            (req as any).user.id = user.id;
                        }
                        const roles = decoded.realm_access?.roles || [];
                        (req as any).user.roles = roles;
                    } catch (dbErr) {
                        // Log but do not block auth if DB fails
                        logger.error('Failed to fetch user from DB in auth middleware', dbErr as Error, { service: 'oauth-provider', providerUserId });
                    }
                }
                next();
            });
        };
    }   
    requireRoles(...roles: string[]){

        return (req: Request , res:Response, next:NextFunction) => {
            const user = (req as any).user;
            if(!user){
                return res.status(401).json({ error: "Unauthorized"});
            }
            const userRoles = user.realm_access?.roles || [];
            const clientRoles: string[] = 
            user.resource_access && user.resource_access?.[this.config.clientId ]
            ? user.resource_access[this.config.clientId].roles
            : [];
            userRoles.push(...clientRoles);
            const hasRole = roles.some(role => userRoles.includes(role));  
        
        if(!hasRole) {
            return res.status(403).json({ error: "Forbidden: Insufficient role"});
        }
        next();
        };
    }
    }