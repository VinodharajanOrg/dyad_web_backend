import { AuthService } from "../services/auth_service";

export const requireRoles = (...roles: string[]) => {
    return AuthService.prototype.requireRoles(...roles);
};