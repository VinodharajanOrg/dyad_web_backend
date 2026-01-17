import { Request, Response, NextFunction } from 'express';
export interface IAuthProvider {    
    getLoginUrl(): string;
   // getLogoutUrl?(postLogoutRedirectUri?: string, idTokenHint?: string): string;
    exchangeCodeForToken(code: string): Promise<any>;
    getUserInfo(accessToken: string): Promise<any>;
    refreshToken(refreshToken: string): Promise<any>;
    verifyToken(): (req: Request, res: Response, next: NextFunction) => void;
    requireRoles(...role: string[]): (req: Request, res: Response, next: NextFunction) => void;
}