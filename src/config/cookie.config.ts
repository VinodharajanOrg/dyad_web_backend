/**
 * Cookie Configuration
 * Centralized cookie options for consistent behavior across the application
 */

import { CookieOptions, Request } from 'express';
import { logger } from '../utils/logger';

/**
 * Get cookie options based on environment and request protocol
 * For production with HTTPS, use secure: true and sameSite: 'none'
 * For development with HTTP, use secure: false and sameSite: 'lax'
 * 
 * @param req - Optional Express request object to detect protocol
 */
export const getCookieOptions = (req?: Request): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const useHttps = process.env.USE_HTTPS === 'true';
  
  // Check if request is HTTPS
  const isSecureRequest = req ? (
    req.secure || 
    req.headers['x-forwarded-proto'] === 'https' ||
    req.protocol === 'https'
  ) : (useHttps || isProduction);

  const cookieOptions: CookieOptions = {
    httpOnly: false, // Set to true for sensitive tokens if you don't need JS access
    secure: isSecureRequest, // true for HTTPS, false for HTTP
    sameSite: isSecureRequest ? 'none' : 'lax', // 'none' requires secure=true
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    // domain: undefined, // Let browser set it automatically for localhost
  };

  // Log cookie configuration for debugging
  logger.info('Cookie Options Generated', {
    service: 'cookie-config',
    isProduction,
    useHttps,
    isSecureRequest,
    requestProtocol: req?.protocol,
    requestSecure: req?.secure,
    forwardedProto: req?.headers['x-forwarded-proto'],
    host: req?.headers.host,
    cookieOptions: {
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      httpOnly: cookieOptions.httpOnly,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    },
  });

  return cookieOptions;
};

/**
 * Get cookie options for clearing cookies
 * @param req - Optional Express request object to detect protocol
 */
export const getClearCookieOptions = (req?: Request): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const useHttps = process.env.USE_HTTPS === 'true';
  
  // Check if request is HTTPS
  const isSecureRequest = req ? (
    req.secure || 
    req.headers['x-forwarded-proto'] === 'https' ||
    req.protocol === 'https'
  ) : (useHttps || isProduction);

  const clearOptions: CookieOptions = {
    path: '/',
    sameSite: isSecureRequest ? 'none' : 'lax',
    secure: isSecureRequest,
  };

  // Log clear cookie configuration for debugging
  logger.info('Clear Cookie Options Generated', {
    service: 'cookie-config',
    isSecureRequest,
    clearOptions,
  });

  return clearOptions;
};
