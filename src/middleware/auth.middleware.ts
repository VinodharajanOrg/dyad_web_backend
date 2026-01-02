import {authService} from "../services/auth_service";
 
 
 export const requireAuth = authService.verifyAccessToken();