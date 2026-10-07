/**
 * HttpOnly session cookies for the storefront BFF (`/backend` proxy).
 * Browsers never read these values — Nest still receives Bearer from the proxy.
 */

export const WEB_ACCESS_COOKIE = 'zevooria_access';
export const WEB_REFRESH_COOKIE = 'zevooria_refresh';

/** Access token TTL mirrors API (5 minutes). */
export const WEB_ACCESS_MAX_AGE_SEC = 30 * 60;
/** Refresh token TTL mirrors API (14 days). */
export const WEB_REFRESH_MAX_AGE_SEC = 14 * 24 * 60 * 60;

export type CookieWriteOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
};

export function sessionCookieOptions(maxAge: number): CookieWriteOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function isWebAuthSessionPath(path: string[]): boolean {
  const joined = path.join('/');
  return (
    joined === 'api/auth/login' ||
    joined === 'api/auth/register' ||
    joined === 'api/auth/refresh' ||
    joined === 'api/auth/change-password'
  );
}

export function isWebAuthLogoutPath(path: string[]): boolean {
  return path.join('/') === 'api/auth/logout';
}

export function isWebAuthRefreshPath(path: string[]): boolean {
  return path.join('/') === 'api/auth/refresh';
}

export type StrippedAuthBody = {
  user: unknown;
  expiresAt?: string;
  expiresIn?: number;
};

/**
 * Pull tokens out of an auth JSON body for cookie storage.
 * Returns null when the payload is not an auth session shape.
 */
export function extractAuthTokens(data: unknown): {
  token: string;
  refreshToken: string;
  expiresIn?: number;
  body: StrippedAuthBody;
} | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (
    typeof record.token !== 'string' ||
    typeof record.refreshToken !== 'string' ||
    !record.user
  ) {
    return null;
  }
  const body: StrippedAuthBody = { user: record.user };
  if (typeof record.expiresAt === 'string') {
    body.expiresAt = record.expiresAt;
  }
  if (typeof record.expiresIn === 'number') {
    body.expiresIn = record.expiresIn;
  }
  return {
    token: record.token,
    refreshToken: record.refreshToken,
    expiresIn:
      typeof record.expiresIn === 'number' ? record.expiresIn : undefined,
    body,
  };
}
