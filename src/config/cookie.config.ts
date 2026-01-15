/**
 * Cookie Configuration
 * Centralized cookie options for consistent behavior across the application
 */

import { CookieOptions } from 'express';

/**
 * Get cookie options based on environment
 * For production with HTTPS, use secure: true and sameSite: 'none'
 * For development with HTTP, use secure: false and sameSite: 'lax'
 */
export const getCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = process.env.USE_HTTPS === 'true';

  return {
    httpOnly: false, // Set to true for sensitive tokens if you don't need JS access
    secure: isHttps || isProduction, // true for HTTPS, false for HTTP
    sameSite: (isHttps || isProduction) ? 'none' : 'lax', // 'none' requires secure=true
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    // domain: undefined, // Let browser set it automatically for localhost
  };
};

/**
 * Get cookie options for clearing cookies
 */
export const getClearCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = process.env.USE_HTTPS === 'true';

  return {
    path: '/',
    sameSite: (isHttps || isProduction) ? 'none' : 'lax',
    secure: isHttps || isProduction,
  };
};
