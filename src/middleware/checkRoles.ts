import { Request, Response, NextFunction } from 'express';

export function checkRole(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = (req as any).user;  // <-- use the field set by verifyToken()
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // 1. Realm roles → simple array
      const realmRoles: string[] = token.realm_access?.roles || [];

      // 2. Client roles → must gather from all clients
      let clientRoles: string[] = [];
      if (token.resource_access) {
        for (const clientId of Object.keys(token.resource_access)) {
          const client = token.resource_access[clientId];
          if (client?.roles) {
            clientRoles.push(...client.roles);
          }
        }
      }

      const allRoles = [...realmRoles, ...clientRoles];

      if (!allRoles.includes(requiredRole)) {
        return res.status(403).json({ error: 'Forbidden: Missing role: ' + requiredRole });
      }

      next();
    } catch (err) {
      console.error(err);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
