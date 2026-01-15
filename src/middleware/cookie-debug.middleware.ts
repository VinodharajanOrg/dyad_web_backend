/**
 * Cookie Debug Middleware
 * Logs cookie information for debugging purposes
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const cookieDebugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only log on auth routes
  if (req.path.includes('/auth/')) {
    const protocol = req.protocol;
    const isSecure = req.secure;
    const forwardedProto = req.headers['x-forwarded-proto'];
    const host = req.headers.host;
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const cookieHeader = req.headers.cookie;
    
    logger.info('🍪 Cookie Debug - Incoming Request', {
      service: 'cookie-debug',
      method: req.method,
      path: req.path,
      fullUrl: req.url,
      protocol,
      isSecure,
      forwardedProto,
      host,
      origin,
      referer,
      hasCookieHeader: !!cookieHeader,
      cookieHeaderLength: cookieHeader?.length || 0,
      parsedCookies: Object.keys(req.cookies || {}),
      parsedCookieCount: Object.keys(req.cookies || {}).length,
      allHeaders: {
        'user-agent': req.headers['user-agent'],
        'accept': req.headers['accept'],
        'content-type': req.headers['content-type'],
      },
      environmentVars: {
        NODE_ENV: process.env.NODE_ENV,
        USE_HTTPS: process.env.USE_HTTPS,
        FRONTEND_URL: process.env.FRONTEND_URL,
      },
    });
    
    // Log response headers after they're set
    const originalSend = res.send;
    const originalRedirect = res.redirect;
    
    res.send = function(data) {
      const setCookieHeaders = res.getHeader('Set-Cookie');
      if (setCookieHeaders) {
        logger.info('🍪 Cookie Debug - Outgoing Response (send)', {
          service: 'cookie-debug',
          path: req.path,
          statusCode: res.statusCode,
          setCookieHeaders: Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders],
          setCookieCount: Array.isArray(setCookieHeaders) ? setCookieHeaders.length : 1,
        });
      }
      return originalSend.call(this, data);
    };
    
    res.redirect = function(statusOrUrl: any, url?: any) {
      const setCookieHeaders = res.getHeader('Set-Cookie');
      if (setCookieHeaders) {
        logger.info('🍪 Cookie Debug - Outgoing Response (redirect)', {
          service: 'cookie-debug',
          path: req.path,
          statusCode: res.statusCode || 302,
          redirectUrl: url || statusOrUrl,
          setCookieHeaders: Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders],
          setCookieCount: Array.isArray(setCookieHeaders) ? setCookieHeaders.length : 1,
          allResponseHeaders: {
            'content-type': res.getHeader('content-type'),
            'location': res.getHeader('location'),
            'access-control-allow-origin': res.getHeader('access-control-allow-origin'),
            'access-control-allow-credentials': res.getHeader('access-control-allow-credentials'),
          },
        });
      }
      return originalRedirect.call(this, statusOrUrl, url);
    };
  }
  
  next();
};
