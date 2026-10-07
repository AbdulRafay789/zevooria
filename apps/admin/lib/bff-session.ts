/**
 * HttpOnly session cookie for the admin BFF (`/backend` proxy).
 */

export const ADMIN_ACCESS_COOKIE = 'zevooria_admin_access';

/** Admin session cookie matches API session TTL (30 minutes). */
export const ADMIN_ACCESS_MAX_AGE_SEC = 30 * 60;

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

export function isAdminAuthLoginPath(path: string[]): boolean {
  return path.join('/') === 'api/admin/auth/login';
}

export function isAdminAuthLogoutPath(path: string[]): boolean {
  return path.join('/') === 'api/admin/auth/logout';
}

export function isAdminSsePath(path: string[]): boolean {
  return path.join('/') === 'api/admin/notifications/stream';
}

/**
 * Pull access token out of admin login JSON for cookie storage.
 */
export function extractAdminAuthToken(data: unknown): {
  token: string;
  body: { user: unknown };
} | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.token !== 'string' || !record.user) {
    return null;
  }
  return {
    token: record.token,
    body: { user: record.user },
  };
}
