import { NextRequest } from 'next/server';

/**
 * Validates the Origin and Referer headers against the host origin to protect
 * mutating endpoints (like POST/PUT/DELETE) from CSRF attacks.
 * 
 * @param request The NextRequest object
 * @returns boolean true if the request is verified as same-origin, false otherwise
 */
export function verifyCsrf(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  
  if (origin) {
    return origin === request.nextUrl.origin;
  }

  // Fallback to Referer check if Origin header is not present
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  // If both Origin and Referer are missing, reject in production
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}
