/**
 * Soft-launch rate limits (medium tier).
 * - GET/HEAD: 100 / minute
 * - Auth-sensitive writes: 5 / minute
 * - Other writes (POST/PUT/PATCH/DELETE): 10 / minute
 *
 * Low tier would be 60 / 3 / 5; high tier 300 / 15 / 30.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;

export const RATE_LIMIT_READ_PER_MIN = 100;
export const RATE_LIMIT_WRITE_PER_MIN = 10;
export const RATE_LIMIT_AUTH_PER_MIN = 5;

const AUTH_PATH_MARKERS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/admin/auth/login',
  '/admin/auth/forgot-password',
  '/admin/auth/reset-password',
];

export function normalizeRequestPath(pathOrUrl: string): string {
  const raw = pathOrUrl.split('?')[0] ?? '';
  return raw.replace(/\/+$/, '') || '/';
}

export function isAuthSensitivePath(pathOrUrl: string): boolean {
  const path = normalizeRequestPath(pathOrUrl);
  return AUTH_PATH_MARKERS.some(
    (marker) => path === `/api${marker}` || path.endsWith(marker),
  );
}

export function isReadMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS';
}

export function resolveRateLimitForRequest(input: {
  method: string;
  pathOrUrl: string;
}): { limit: number; bucket: 'read' | 'write' | 'auth' } {
  if (isReadMethod(input.method)) {
    return { limit: RATE_LIMIT_READ_PER_MIN, bucket: 'read' };
  }
  if (isAuthSensitivePath(input.pathOrUrl)) {
    return { limit: RATE_LIMIT_AUTH_PER_MIN, bucket: 'auth' };
  }
  return { limit: RATE_LIMIT_WRITE_PER_MIN, bucket: 'write' };
}

export function isRateLimitExemptPath(pathOrUrl: string): boolean {
  const path = normalizeRequestPath(pathOrUrl);
  return (
    path === '/api/health' ||
    path === '/health' ||
    path.endsWith('/notifications/stream')
  );
}
