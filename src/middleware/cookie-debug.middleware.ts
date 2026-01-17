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
    
    // Check CORS configuration
    const corsOrigin = req.headers.origin;
    const expectedOrigin = process.env.FRONTEND_URL;
    logger.info('🔍 CORS Analysis', {
      service: 'cookie-debug',
      requestOrigin: corsOrigin,
      expectedFrontendUrl: expectedOrigin,
      originMatch: corsOrigin === expectedOrigin,
      willAllowCredentials: true,
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
      // Determine if first argument is status code or URL
      const isStatusCode = typeof statusOrUrl === 'number';
      const actualRedirectUrl = isStatusCode ? url : statusOrUrl;
      
      if (setCookieHeaders) {
        logger.info('🍪 Cookie Debug - Outgoing Response (redirect)', {
          service: 'cookie-debug',
          path: req.path,
          statusCode: res.statusCode || 302,
          redirectUrl: actualRedirectUrl,
          setCookieHeaders: Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders],
          setCookieCount: Array.isArray(setCookieHeaders) ? setCookieHeaders.length : 1,
          allResponseHeaders: {
            'content-type': res.getHeader('content-type'),
            'location': res.getHeader('location'),
            'access-control-allow-origin': res.getHeader('access-control-allow-origin'),
            'access-control-allow-credentials': res.getHeader('access-control-allow-credentials'),
          },
        });
        
        // Detailed cookie format analysis
        const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        logger.info('🔍 Detailed Cookie Analysis', {
          service: 'cookie-debug',
          totalCookies: cookieArray.length,
          cookies: cookieArray.map((cookie, idx) => {
            const cookieStr = String(cookie);
            return {
              index: idx + 1,
              name: cookieStr.split('=')[0],
              hasSecure: cookieStr.includes('Secure'),
              hasSameSiteNone: cookieStr.includes('SameSite=None') || cookieStr.includes('SameSite=none'),
              hasPath: cookieStr.includes('Path=/'),
              hasMaxAge: cookieStr.includes('Max-Age'),
              length: cookieStr.length,
            };
          }),
        });
      } else {
        logger.warn('⚠️  No Set-Cookie headers found in redirect response!', {
          service: 'cookie-debug',
          path: req.path,
        });
      }
      // Call original redirect - Express 4 redirect signature is: redirect(url: string) or redirect(status: number, url: string)
      // But TypeScript types may not reflect overloads correctly, so we use any
      if (url !== undefined) {
        // Called with status code: res.redirect(status, url)
        return (originalRedirect as any).call(this, statusOrUrl, url);
      } else {
        // Called with just URL: res.redirect(url)  
        return (originalRedirect as any).call(this, statusOrUrl);
      }
    };
  }
  
  next();
};
